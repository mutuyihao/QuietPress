import { requireAdmin } from "@/lib/admin-auth";
import { createRepositories } from "@/lib/db";
import type { PostWithTags, Tag, SiteSettings } from "@/lib/types";
import type { PaginatedResult } from "@/lib/db/types";

export interface AdminPostSummary {
  totalPosts: number;
  totalViews: number;
  draftsCount: number;
  totalTags: number;
  topPosts: Pick<PostWithTags, "id" | "title" | "slug" | "views_count">[];
}

interface AdminPostSummaryRpc {
  totalPosts?: unknown;
  totalViews?: unknown;
  draftsCount?: unknown;
  totalTags?: unknown;
  topPosts?: unknown;
}

async function getAdminRepos() {
  const { supabase } = await requireAdmin();
  return createRepositories(supabase);
}

export async function getAllPostsAdmin(
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<PostWithTags>> {
  const { posts } = await getAdminRepos();
  return posts.listAdmin(page, pageSize);
}

export async function getAdminPostSummary(): Promise<AdminPostSummary> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_admin_post_summary");

  if (!error && data && typeof data === "object") {
    const summary = data as AdminPostSummaryRpc;
    return {
      totalPosts: Number(summary.totalPosts ?? 0),
      totalViews: Number(summary.totalViews ?? 0),
      draftsCount: Number(summary.draftsCount ?? 0),
      totalTags: Number(summary.totalTags ?? 0),
      topPosts: Array.isArray(summary.topPosts)
        ? (summary.topPosts as AdminPostSummary["topPosts"])
        : [],
    };
  }

  const { posts, tags } = await getAdminRepos();
  const [postResult, allTags] = await Promise.all([
    posts.listAdmin(1, 100),
    tags.list(),
  ]);
  const topPosts = [...postResult.items]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 3);

  return {
    totalPosts: postResult.total,
    totalViews: postResult.items.reduce(
      (sum, post) => sum + (post.views_count || 0),
      0,
    ),
    draftsCount: postResult.items.filter((post) => post.status === "draft")
      .length,
    totalTags: allTags.length,
    topPosts,
  };
}

export async function getPostByIdAdmin(
  id: string,
): Promise<PostWithTags | null> {
  const { posts } = await getAdminRepos();
  return posts.getById(id);
}

export async function getAllTagsAdmin(): Promise<Tag[]> {
  const { tags } = await getAdminRepos();
  return tags.list();
}

export async function getSiteSettingsAdmin(): Promise<SiteSettings | null> {
  const { settings } = await getAdminRepos();
  return settings.get();
}
