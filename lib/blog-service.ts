import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateReadingTime,
  createPostSlug,
  slugify,
} from "@/lib/blog-utils";
import { createRepositories } from "@/lib/db";
import { importQuietPressPackage } from "@/lib/migration/import";
import { createMigrationPreview } from "@/lib/migration/preview";
import { createQuietPressExport } from "@/lib/migration/export";
import type {
  MigrationImportOptions,
  QuietPressExportV1,
} from "@/lib/migration/types";
import type { SiteSettingsUpdateInput } from "@/lib/db/types";
import { getActiveStorage } from "@/lib/storage/active";
import {
  revalidateAllContent,
  revalidateCommentContent,
  revalidatePostContent,
  revalidateSettingsContent,
  revalidateTagContent,
} from "@/lib/blog/revalidation";
import type { PostStatus, PostWithTags, SiteSettings, Tag } from "@/lib/types";

export { uploadBlogMediaFromUrl } from "@/lib/blog/media-service";

export interface BlogServiceContext {
  supabase: SupabaseClient;
  userId: string;
}

export interface CreatePostDraftInput {
  title: string;
  content_markdown: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  noindex?: boolean;
  tag_slugs?: string[];
}

export interface UpdatePostInput {
  id: string;
  title?: string;
  content_markdown?: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  noindex?: boolean;
  tag_slugs?: string[];
}

export interface UpdateSiteSettingsInput {
  site_name?: string;
  site_description?: string;
  base_url?: string | null;
  author_name?: string;
  default_og_image_url?: string | null;
  comments_enabled?: boolean;
  image_upload_max_size_mb?: number;
  image_compression_enabled?: boolean;
  image_compression_quality?: number;
  image_max_width?: number;
  image_max_height?: number;
  about_content?: string;
  social_links?: Record<string, string>;
}

function serializePost(post: PostWithTags) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content_markdown: post.content_markdown,
    cover_image_url: post.cover_image_url,
    status: post.status,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    canonical_url: post.canonical_url,
    noindex: post.noindex,
    reading_time_minutes: post.reading_time_minutes,
    views_count: post.views_count,
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
    tags: post.tags,
  };
}

function getCommentPostSlug(row: unknown): string | undefined {
  const posts = (
    row as { posts?: { slug?: unknown } | Array<{ slug?: unknown }> } | null
  )?.posts;
  const post = Array.isArray(posts) ? posts[0] : posts;
  return typeof post?.slug === "string" ? post.slug : undefined;
}

async function getAllTags(context: BlogServiceContext): Promise<Tag[]> {
  return createRepositories(context.supabase).tags.list();
}

async function resolveTagIds(
  context: BlogServiceContext,
  slugs: string[] | undefined,
): Promise<string[]> {
  if (!slugs || slugs.length === 0) return [];
  const requested = new Set(slugs.map((slug) => slug.trim()).filter(Boolean));
  const tags = await getAllTags(context);
  return tags.filter((tag) => requested.has(tag.slug)).map((tag) => tag.id);
}

async function getUniquePostSlug(
  context: BlogServiceContext,
  base: string,
  excludingId?: string,
): Promise<string> {
  const normalizedBase = base || "untitled";
  const repos = createRepositories(context.supabase);
  const existing = new Set(
    await repos.posts.findSlugsByPrefix(normalizedBase, excludingId),
  );
  let slug = normalizedBase;
  let index = 2;
  while (existing.has(slug)) {
    slug = `${normalizedBase}-${index}`;
    index += 1;
  }
  return slug;
}

export async function searchBlogPosts(
  context: BlogServiceContext,
  input: { query?: string; status?: PostStatus | "all"; limit?: number },
) {
  const query = (input.query || "").trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  const posts = await createRepositories(context.supabase).posts.searchAdmin(
    query,
    input.status,
    limit,
  );

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    status: post.status,
    published_at: post.published_at,
    updated_at: post.updated_at,
    tags: post.tags,
  }));
}

export async function getBlogPost(
  context: BlogServiceContext,
  input: { id?: string; slug?: string },
) {
  const repos = createRepositories(context.supabase);
  const post = input.id
    ? await repos.posts.getById(input.id)
    : input.slug
      ? await repos.posts.getBySlugAny(input.slug)
      : null;

  return post ? serializePost(post) : null;
}

export async function createBlogPostDraft(
  context: BlogServiceContext,
  input: CreatePostDraftInput,
) {
  const repos = createRepositories(context.supabase);
  const [tagIds, slug] = await Promise.all([
    resolveTagIds(context, input.tag_slugs),
    getUniquePostSlug(context, createPostSlug(input.title)),
  ]);
  const readingTime = calculateReadingTime(input.content_markdown);

  const { id } = await repos.posts.create({
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    contentMarkdown: input.content_markdown,
    coverImageUrl: input.cover_image_url || null,
    status: "draft",
    seoTitle: input.seo_title || null,
    seoDescription: input.seo_description || null,
    canonicalUrl: input.canonical_url || null,
    noindex: input.noindex ?? false,
    readingTimeMinutes: readingTime,
    publishedAt: null,
    authorId: context.userId,
    tagIds,
  });

  await repos.posts.saveRevision(id, {
    title: input.title,
    contentMarkdown: input.content_markdown,
    excerpt: input.excerpt || null,
    userId: context.userId,
  });

  revalidatePostContent(slug);
  return getBlogPost(context, { id });
}

export async function updateBlogPost(
  context: BlogServiceContext,
  input: UpdatePostInput,
) {
  const repos = createRepositories(context.supabase);
  const existing = await repos.posts.getById(input.id);
  if (!existing) throw new Error("Post not found");

  const nextTitle = input.title ?? existing.title;
  const nextContent = input.content_markdown ?? existing.content_markdown;
  const update: Parameters<typeof repos.posts.update>[1] = {};

  if (input.title !== undefined) {
    update.title = input.title;
    update.slug = await getUniquePostSlug(
      context,
      createPostSlug(input.title),
      input.id,
    );
  }
  if (input.content_markdown !== undefined) {
    update.contentMarkdown = input.content_markdown;
    update.readingTimeMinutes = calculateReadingTime(input.content_markdown);
  }
  if (input.excerpt !== undefined) update.excerpt = input.excerpt || null;
  if (input.cover_image_url !== undefined)
    update.coverImageUrl = input.cover_image_url || null;
  if (input.seo_title !== undefined) update.seoTitle = input.seo_title || null;
  if (input.seo_description !== undefined)
    update.seoDescription = input.seo_description || null;
  if (input.canonical_url !== undefined)
    update.canonicalUrl = input.canonical_url || null;
  if (input.noindex !== undefined) update.noindex = input.noindex;

  await repos.posts.update(input.id, update);
  if (input.tag_slugs) {
    await repos.posts.setTags(
      input.id,
      await resolveTagIds(context, input.tag_slugs),
    );
  }

  await repos.posts.saveRevision(input.id, {
    title: nextTitle,
    contentMarkdown: nextContent,
    excerpt:
      input.excerpt !== undefined ? input.excerpt || null : existing.excerpt,
    userId: context.userId,
  });

  revalidatePostContent(existing.slug, update.slug);
  if (input.tag_slugs) {
    revalidateTagContent();
  }
  return getBlogPost(context, { id: input.id });
}

export async function setBlogPostStatus(
  context: BlogServiceContext,
  id: string,
  status: PostStatus,
) {
  const repos = createRepositories(context.supabase);
  const existing = await repos.posts.getById(id);
  if (!existing) throw new Error("Post not found");

  await repos.posts.update(id, {
    status,
    publishedAt:
      status === "published"
        ? existing.published_at || new Date().toISOString()
        : existing.published_at,
  });

  revalidatePostContent(existing.slug);
  return getBlogPost(context, { id });
}

export async function deleteBlogPost(context: BlogServiceContext, id: string) {
  const repos = createRepositories(context.supabase);
  const { slug } = await repos.posts.delete(id);
  revalidatePostContent(slug);
  return { id, deleted: true };
}

export async function manageBlogTag(
  context: BlogServiceContext,
  input: { action: "create" | "update" | "delete"; id?: string; name?: string },
) {
  const repos = createRepositories(context.supabase);

  if (input.action === "create") {
    if (!input.name) throw new Error("Tag name is required");
    const tag = await repos.tags.create(input.name, slugify(input.name));
    revalidateTagContent(tag.slug);
    return tag;
  }

  if (input.action === "update") {
    if (!input.id || !input.name)
      throw new Error("Tag id and name are required");
    const tag = await repos.tags.update(
      input.id,
      input.name,
      slugify(input.name),
    );
    revalidateTagContent(tag.slug);
    return tag;
  }

  if (!input.id) throw new Error("Tag id is required");
  const result = await repos.tags.delete(input.id);
  revalidateTagContent(result.slug);
  return { id: input.id, deleted: true, slug: result.slug };
}

export async function listBlogTags(context: BlogServiceContext) {
  return getAllTags(context);
}

export async function moderateBlogComment(
  context: BlogServiceContext,
  input: { id: string; action: "approve" | "spam" | "delete" },
) {
  if (input.action === "delete") {
    const { data: existing } = await context.supabase
      .from("comments")
      .select("posts(slug)")
      .eq("id", input.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("comments")
      .delete()
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    const postSlug = getCommentPostSlug(existing);
    revalidateCommentContent(postSlug);
    return { id: input.id, deleted: true };
  }

  const status = input.action === "approve" ? "approved" : "spam";
  const { data, error } = await context.supabase
    .from("comments")
    .update({ status })
    .eq("id", input.id)
    .select("*, posts(slug)")
    .single();

  if (error) throw new Error(error.message);
  const postSlug = getCommentPostSlug(data);
  revalidateCommentContent(postSlug);
  return data;
}

export async function listBlogComments(
  context: BlogServiceContext,
  input: { status?: "pending" | "approved" | "spam"; limit?: number },
) {
  let query = context.supabase
    .from("comments")
    .select("*, posts(title, slug)")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 100));

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getBlogSettings(
  context: BlogServiceContext,
): Promise<SiteSettings | null> {
  return createRepositories(context.supabase).settings.get();
}

export async function updateBlogSettings(
  context: BlogServiceContext,
  input: UpdateSiteSettingsInput,
) {
  const payload = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as SiteSettingsUpdateInput;
  if (Object.keys(payload).length === 0)
    throw new Error("No settings provided");

  payload.updated_at = new Date().toISOString();
  await createRepositories(context.supabase).settings.upsert(payload);
  revalidateSettingsContent();
  return getBlogSettings(context);
}

export async function listBlogMedia(context: BlogServiceContext) {
  const activeStorage = await getActiveStorage(context.supabase);
  if (!activeStorage.provider.listFiles) {
    return {
      provider: activeStorage.providerName,
      files: [],
      message: "The active storage provider does not support listing files.",
    };
  }

  return {
    provider: activeStorage.providerName,
    files: await activeStorage.provider.listFiles(),
  };
}

export async function exportBlogMigrationPackage(context: BlogServiceContext) {
  return createQuietPressExport(context.supabase);
}

export async function previewBlogMigrationPackage(
  context: BlogServiceContext,
  migrationPackage: QuietPressExportV1,
) {
  return createMigrationPreview(context.supabase, migrationPackage);
}

export async function importBlogMigrationPackage(
  context: BlogServiceContext,
  migrationPackage: QuietPressExportV1,
  options: MigrationImportOptions,
) {
  const result = await importQuietPressPackage(
    context.supabase,
    migrationPackage,
    options,
  );
  revalidateAllContent();
  return result;
}

export async function getBlogAnalyticsSummary(context: BlogServiceContext) {
  const [posts, comments, settings] = await Promise.all([
    context.supabase.from("posts").select("status, views_count"),
    context.supabase.from("comments").select("status"),
    getBlogSettings(context),
  ]);

  const postRows = posts.data || [];
  const commentRows = comments.data || [];
  return {
    posts: {
      total: postRows.length,
      published: postRows.filter((post) => post.status === "published").length,
      draft: postRows.filter((post) => post.status === "draft").length,
      archived: postRows.filter((post) => post.status === "archived").length,
      scheduled: postRows.filter((post) => post.status === "scheduled").length,
      total_views: postRows.reduce(
        (sum, post) => sum + (post.views_count || 0),
        0,
      ),
    },
    comments: {
      total: commentRows.length,
      pending: commentRows.filter((comment) => comment.status === "pending")
        .length,
      approved: commentRows.filter((comment) => comment.status === "approved")
        .length,
      spam: commentRows.filter((comment) => comment.status === "spam").length,
    },
    settings: {
      site_name: settings?.site_name,
      base_url: settings?.base_url,
      comments_enabled: settings?.comments_enabled,
    },
  };
}
