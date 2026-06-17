import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag, TagWithPostCount } from "@/lib/types";
import type { TagRepository } from "../types";
import { getRouteSegmentVariants } from "@/lib/route-segments";

const TAG_COUNT_PAGE_SIZE = 1000;

interface PublishedPostTagRow {
  tag_id: string;
  posts?: { id: string } | { id: string }[] | null;
}

function hasPublishedPost(row: PublishedPostTagRow): boolean {
  const post = row.posts;
  return Array.isArray(post) ? post.length > 0 : Boolean(post);
}

export class SupabaseTagRepository implements TagRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(): Promise<Tag[]> {
    const { data: tags, error } = await this.supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error || !tags) return [];
    return tags;
  }

  async listWithPostCounts(): Promise<TagWithPostCount[]> {
    const tags = await this.list();
    if (tags.length === 0) return [];

    const counts = new Map<string, number>();
    const now = new Date().toISOString();

    for (let from = 0; ; from += TAG_COUNT_PAGE_SIZE) {
      const to = from + TAG_COUNT_PAGE_SIZE - 1;
      const { data: rows, error } = await this.supabase
        .from("post_tags")
        .select("tag_id, posts!inner(id)")
        .eq("posts.status", "published")
        .lte("posts.published_at", now)
        .range(from, to);

      if (error || !rows) break;

      for (const row of rows as PublishedPostTagRow[]) {
        if (!hasPublishedPost(row)) continue;
        counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
      }

      if (rows.length < TAG_COUNT_PAGE_SIZE) break;
    }

    return tags.map((tag) => ({
      ...tag,
      post_count: counts.get(tag.id) ?? 0,
    }));
  }

  async getBySlug(slug: string): Promise<Tag | null> {
    const slugVariants = getRouteSegmentVariants(slug);

    const { data: tag, error } = await this.supabase
      .from("tags")
      .select("*")
      .in("slug", slugVariants)
      .limit(1)
      .maybeSingle();

    if (error || !tag) return null;
    return tag;
  }

  async create(name: string, slug: string): Promise<Tag> {
    const { data: tag, error } = await this.supabase
      .from("tags")
      .insert({ name, slug })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return tag;
  }

  async update(id: string, name: string, slug: string): Promise<Tag> {
    const { data: tag, error } = await this.supabase
      .from("tags")
      .update({ name, slug })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return tag;
  }

  async delete(id: string): Promise<{ slug: string | null }> {
    const { data: tag } = await this.supabase
      .from("tags")
      .select("slug")
      .eq("id", id)
      .single();

    const { error } = await this.supabase.from("tags").delete().eq("id", id);

    if (error) throw new Error(error.message);
    return { slug: tag?.slug ?? null };
  }
}
