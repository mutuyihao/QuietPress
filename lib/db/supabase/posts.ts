import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArchivePost, PostStatus, PostWithTags, Tag } from "@/lib/types";
import type {
  PostRepository,
  CreatePostInput,
  UpdatePostInput,
  PaginatedResult,
} from "../types";
import { getRouteSegmentVariants } from "@/lib/route-segments";
import { slugify } from "@/lib/blog-utils";
import { normalizePostSlugBase } from "@/lib/post-slugs";
import { logger } from "@/lib/logger";

export const POST_WITH_TAGS_SELECT = "*, post_tags(tags(*))";
const PUBLIC_ARCHIVE_PAGE_SIZE = 1000;

type PostRow = Omit<PostWithTags, "tags">;

interface PostTagRow {
  post_id: string;
  tags?: Tag | Tag[] | null;
}

export interface NestedPostRow extends PostRow {
  post_tags?: PostTagRow[] | null;
}

interface PostTagWithPostRow {
  posts?: NestedPostRow | NestedPostRow[] | null;
}

interface SlugRedirectRow {
  post_id: string;
  slug: string;
}

type PostUpdatePayload = Partial<{
  title: string;
  slug: string;
  excerpt: string | null;
  content_markdown: string;
  cover_image_url: string | null;
  status: PostStatus;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  reading_time_minutes: number;
  published_at: string | null;
}>;

function getPostSlugVariants(slug: string): string[] {
  const routeVariants = getRouteSegmentVariants(slug);
  const legacySlugVariants = routeVariants.map((variant) => slugify(variant));
  return Array.from(new Set([...routeVariants, ...legacySlugVariants]));
}

function isArchivePost(value: unknown): value is ArchivePost {
  if (!value || typeof value !== "object") return false;

  const row = value as Partial<ArchivePost>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.slug === "string" &&
    (typeof row.published_at === "string" || row.published_at === null) &&
    typeof row.created_at === "string"
  );
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getNestedTags(value: unknown): Tag[] {
  if (!Array.isArray(value)) return [];

  const tags: Tag[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const nested = (item as PostTagRow).tags;
    if (Array.isArray(nested)) {
      for (const tag of nested) {
        if (tag) tags.push(tag);
      }
    } else if (nested) {
      tags.push(nested);
    }
  }

  return tags;
}

export function mapNestedPost(post: NestedPostRow): PostWithTags {
  const { post_tags: postTags, ...postData } = post;
  return {
    ...postData,
    tags: getNestedTags(postTags),
  } as PostWithTags;
}

function getEmbeddedPost(row: PostTagWithPostRow): NestedPostRow | null {
  const post = row.posts;
  return Array.isArray(post) ? (post[0] ?? null) : (post ?? null);
}

async function attachTags(
  supabase: SupabaseClient,
  posts: PostRow[],
): Promise<PostWithTags[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id as string);

  const { data: allPostTags } = await supabase
    .from("post_tags")
    .select("post_id, tags(*)")
    .in("post_id", postIds);

  const postTagsMap = new Map<string, Tag[]>();
  if (allPostTags) {
    allPostTags.forEach((pt: PostTagRow) => {
      const tag = Array.isArray(pt.tags) ? pt.tags[0] : pt.tags;
      if (tag) {
        const arr = postTagsMap.get(pt.post_id) || [];
        arr.push(tag);
        postTagsMap.set(pt.post_id, arr);
      }
    });
  }

  return posts.map((post) => ({
    ...post,
    tags: postTagsMap.get(post.id) || [],
  }));
}

export class SupabasePostRepository implements PostRepository {
  constructor(private supabase: SupabaseClient) {}

  private async getPostByIdInternal(
    id: string,
    publishedOnly: boolean,
  ): Promise<PostWithTags | null> {
    let request = this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT)
      .eq("id", id);

    if (publishedOnly) {
      request = request
        .eq("status", "published")
        .lte("published_at", new Date().toISOString());
    }

    const { data: post, error } = await request.maybeSingle();
    if (error || !post) return null;
    return mapNestedPost(post);
  }

  private async getPostBySlugVariants(
    slugVariants: string[],
    publishedOnly: boolean,
  ): Promise<PostWithTags | null> {
    for (const slugVariant of slugVariants) {
      let request = this.supabase
        .from("posts")
        .select(POST_WITH_TAGS_SELECT)
        .eq("slug", slugVariant);

      if (publishedOnly) {
        request = request
          .eq("status", "published")
          .lte("published_at", new Date().toISOString());
      }

      const { data: post, error } = await request.maybeSingle();

      if (error) continue;
      if (post) return mapNestedPost(post);
    }

    return null;
  }

  private async getPostByRedirectSlugVariants(
    slugVariants: string[],
    publishedOnly: boolean,
  ): Promise<PostWithTags | null> {
    for (const slugVariant of slugVariants) {
      const { data: redirect, error } = await this.supabase
        .from("post_slug_redirects")
        .select("post_id, slug")
        .eq("slug", slugVariant)
        .maybeSingle();

      if (error || !redirect) continue;

      const postId = (redirect as SlugRedirectRow).post_id;
      const post = await this.getPostByIdInternal(postId, publishedOnly);
      if (post) return post;
    }

    return null;
  }

  async list(page = 1, pageSize = 10): Promise<PaginatedResult<PostWithTags>> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const now = new Date().toISOString();

    const {
      data: posts,
      count,
      error,
    } = await this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT, { count: "exact" })
      .eq("status", "published")
      .lte("published_at", now)
      .order("published_at", { ascending: false })
      .range(from, to);

    if (error || !posts) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const total = count ?? posts.length;
    return {
      items: posts.map((post) => mapNestedPost(post)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listAll(): Promise<PostWithTags[]> {
    const { data: posts, error } = await this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT)
      .order("updated_at", { ascending: false });

    if (error || !posts) return [];
    return posts.map((post) => mapNestedPost(post));
  }

  async listArchive(): Promise<ArchivePost[]> {
    const now = new Date().toISOString();
    const archivePosts: ArchivePost[] = [];

    for (let from = 0; ; from += PUBLIC_ARCHIVE_PAGE_SIZE) {
      const to = from + PUBLIC_ARCHIVE_PAGE_SIZE - 1;
      const { data: posts, error } = await this.supabase
        .from("posts")
        .select("id, title, slug, published_at, created_at")
        .eq("status", "published")
        .lte("published_at", now)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (error || !posts) return [];

      archivePosts.push(...posts.filter(isArchivePost));
      if (posts.length < PUBLIC_ARCHIVE_PAGE_SIZE) break;
    }

    return archivePosts;
  }

  async listPublishedSlugs(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("posts")
      .select("slug")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(1000);

    if (error || !data) return [];
    return data
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string");
  }

  async listAdmin(
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<PostWithTags>> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const {
      data: posts,
      count,
      error,
    } = await this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error || !posts) {
      return {
        items: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        totalPages: 0,
      };
    }

    const total = count ?? posts.length;
    return {
      items: posts.map((post) => mapNestedPost(post)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async findSlugsByPrefix(
    prefix: string,
    excludingId?: string,
  ): Promise<string[]> {
    const safePrefix = normalizePostSlugBase(prefix);
    let query = this.supabase
      .from("posts")
      .select("slug")
      .or(`slug.eq.${safePrefix},slug.like.${safePrefix}-%`)
      .limit(1000);

    if (excludingId) {
      query = query.neq("id", excludingId);
    }

    const { data, error } = await query;
    const postSlugs =
      error || !data
        ? []
        : data
            .map((row) => row.slug)
            .filter((slug): slug is string => typeof slug === "string");

    let redirectQuery = this.supabase
      .from("post_slug_redirects")
      .select("slug, post_id")
      .or(`slug.eq.${safePrefix},slug.like.${safePrefix}-%`)
      .limit(1000);

    if (excludingId) {
      redirectQuery = redirectQuery.neq("post_id", excludingId);
    }

    const { data: redirects } = await redirectQuery;
    const redirectSlugs = (redirects || [])
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string");

    return Array.from(new Set([...postSlugs, ...redirectSlugs]));
  }

  async getBySlug(slug: string): Promise<PostWithTags | null> {
    const slugVariants = getPostSlugVariants(slug);

    return (
      (await this.getPostBySlugVariants(slugVariants, true)) ||
      (await this.getPostByRedirectSlugVariants(slugVariants, true))
    );
  }

  async getBySlugAny(slug: string): Promise<PostWithTags | null> {
    const slugVariants = getPostSlugVariants(slug);

    return (
      (await this.getPostBySlugVariants(slugVariants, false)) ||
      (await this.getPostByRedirectSlugVariants(slugVariants, false))
    );
  }

  async getById(id: string): Promise<PostWithTags | null> {
    const { data: post, error } = await this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT)
      .eq("id", id)
      .single();

    if (error || !post) return null;

    return mapNestedPost(post);
  }

  async listByTag(tagSlug: string): Promise<PostWithTags[]> {
    const tagSlugVariants = getRouteSegmentVariants(tagSlug);
    let tag: Tag | null = null;

    for (const tagSlugVariant of tagSlugVariants) {
      const { data } = await this.supabase
        .from("tags")
        .select("*")
        .eq("slug", tagSlugVariant)
        .maybeSingle();

      if (data) {
        tag = data;
        break;
      }
    }

    if (!tag) return [];

    const { data: rows } = await this.supabase
      .from("post_tags")
      .select("posts!inner(*, post_tags(tags(*)))")
      .eq("tag_id", tag.id)
      .eq("posts.status", "published")
      .lte("posts.published_at", new Date().toISOString())
      .limit(200);

    if (!rows) return [];

    return rows
      .map((row) => getEmbeddedPost(row))
      .filter((post): post is NestedPostRow => Boolean(post))
      .map((post) => mapNestedPost(post))
      .sort(
        (a, b) =>
          new Date(b.published_at || 0).getTime() -
          new Date(a.published_at || 0).getTime(),
      );
  }

  async search(query: string): Promise<PostWithTags[]> {
    const normalized = query.replace(/\s+/g, " ").trim().slice(0, 200);
    const { data: posts, error } = await this.supabase.rpc("search_posts", {
      search_query: normalized,
      limit_count: 20,
    });

    if (error || !posts) return [];
    return attachTags(this.supabase, posts);
  }

  async searchAdmin(
    query: string,
    status: PostStatus | "all" = "all",
    limit = 20,
  ): Promise<PostWithTags[]> {
    const normalized = query
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    let request = this.supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT)
      .order("updated_at", { ascending: false })
      .limit(safeLimit);

    if (status && status !== "all") {
      request = request.eq("status", status);
    }

    if (normalized) {
      const pattern = quotePostgrestFilterValue(
        `%${escapeIlikePattern(normalized)}%`,
      );
      request = request.or(
        [
          `title.ilike.${pattern}`,
          `slug.ilike.${pattern}`,
          `excerpt.ilike.${pattern}`,
          `content_markdown.ilike.${pattern}`,
        ].join(","),
      );
    }

    const { data: posts, error } = await request;
    if (error || !posts) return [];
    return posts.map((post) => mapNestedPost(post));
  }

  async create(input: CreatePostInput): Promise<{ id: string }> {
    const { tagIds, ...postData } = input;

    const { data: post, error } = await this.supabase
      .from("posts")
      .insert({
        title: postData.title,
        slug: postData.slug,
        excerpt: postData.excerpt,
        content_markdown: postData.contentMarkdown,
        cover_image_url: postData.coverImageUrl,
        status: postData.status,
        seo_title: postData.seoTitle,
        seo_description: postData.seoDescription,
        canonical_url: postData.canonicalUrl,
        noindex: postData.noindex,
        reading_time_minutes: postData.readingTimeMinutes,
        published_at: postData.publishedAt,
        author_id: postData.authorId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (tagIds.length > 0) {
      await this.supabase
        .from("post_tags")
        .insert(tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })));
    }

    return { id: post.id };
  }

  async update(id: string, input: UpdatePostInput): Promise<void> {
    const payload: PostUpdatePayload = {};

    if (input.title !== undefined) payload.title = input.title;
    if (input.slug !== undefined) payload.slug = input.slug;
    if (input.excerpt !== undefined) payload.excerpt = input.excerpt;
    if (input.contentMarkdown !== undefined)
      payload.content_markdown = input.contentMarkdown;
    if (input.coverImageUrl !== undefined)
      payload.cover_image_url = input.coverImageUrl;
    if (input.status !== undefined) payload.status = input.status;
    if (input.seoTitle !== undefined) payload.seo_title = input.seoTitle;
    if (input.seoDescription !== undefined)
      payload.seo_description = input.seoDescription;
    if (input.canonicalUrl !== undefined)
      payload.canonical_url = input.canonicalUrl;
    if (input.noindex !== undefined) payload.noindex = input.noindex;
    if (input.readingTimeMinutes !== undefined)
      payload.reading_time_minutes = input.readingTimeMinutes;
    if (input.publishedAt !== undefined)
      payload.published_at = input.publishedAt;

    if (Object.keys(payload).length > 0) {
      const { error } = await this.supabase
        .from("posts")
        .update(payload)
        .eq("id", id);

      if (error) throw new Error(error.message);
    }
  }

  async addSlugRedirect(postId: string, slug: string): Promise<void> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) return;

    const { error } = await this.supabase.from("post_slug_redirects").upsert(
      {
        post_id: postId,
        slug: normalizedSlug,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    );

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<{ slug: string | null }> {
    const { data: post } = await this.supabase
      .from("posts")
      .select("slug")
      .eq("id", id)
      .single();

    const { error } = await this.supabase.from("posts").delete().eq("id", id);

    if (error) throw new Error(error.message);
    return { slug: post?.slug ?? null };
  }

  async updateStatus(ids: string[], status: PostStatus): Promise<void> {
    const updateData: PostUpdatePayload = { status };
    if (status === "published") {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from("posts")
      .update(updateData)
      .in("id", ids);

    if (error) throw new Error(error.message);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const { error } = await this.supabase.from("posts").delete().in("id", ids);

    if (error) throw new Error(error.message);
  }

  async incrementViews(id: string): Promise<void> {
    const { error } = await this.supabase.rpc("increment_post_views", {
      post_id: id,
    });
    if (error) {
      logger.warn("failed to increment post views", { err: error, postId: id });
    }
  }

  async setTags(postId: string, tagIds: string[]): Promise<void> {
    await this.supabase.from("post_tags").delete().eq("post_id", postId);

    if (tagIds.length > 0) {
      await this.supabase
        .from("post_tags")
        .insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
    }
  }

  async getSlug(id: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("posts")
      .select("slug")
      .eq("id", id)
      .single();

    return data?.slug ?? null;
  }

  /** For revision saving — direct access needed beyond the PostRepository interface */
  async saveRevision(
    postId: string,
    data: {
      title: string;
      contentMarkdown: string;
      excerpt: string | null;
      userId: string;
    },
  ): Promise<void> {
    await this.supabase.from("post_revisions").insert({
      post_id: postId,
      title: data.title,
      content_markdown: data.contentMarkdown,
      excerpt: data.excerpt,
      created_by: data.userId,
    });
  }
}
