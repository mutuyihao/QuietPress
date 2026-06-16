import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { mapNestedPost, POST_WITH_TAGS_SELECT } from "@/lib/db/supabase/posts";
import type { PostWithTags } from "@/lib/types";

const RELATED_POSTS_REVALIDATE_SECONDS = 3600;

const getRelatedPostsCached = unstable_cache(
  async (
    currentPostId: string,
    tagKey: string,
    limit = 3,
  ): Promise<PostWithTags[]> => {
    const tagIds = tagKey ? tagKey.split(",") : [];
    if (tagIds.length === 0) return [];

    const supabase = createPublicClient();

    // Find posts sharing at least one tag, excluding current post
    const { data: relatedPostTags } = await supabase
      .from("post_tags")
      .select("post_id, tag_id")
      .in("tag_id", tagIds)
      .neq("post_id", currentPostId)
      .limit(500);

    if (!relatedPostTags || relatedPostTags.length === 0) return [];

    // Score posts by number of shared tags
    const postScoreMap = new Map<string, number>();
    relatedPostTags.forEach((pt) => {
      postScoreMap.set(pt.post_id, (postScoreMap.get(pt.post_id) || 0) + 1);
    });

    const topPostIds = [...postScoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topPostIds.length === 0) return [];

    const { data: posts } = await supabase
      .from("posts")
      .select(POST_WITH_TAGS_SELECT)
      .in("id", topPostIds)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });

    if (!posts || posts.length === 0) return [];

    const postsById = new Map(
      posts.map((post) => [post.id, mapNestedPost(post)]),
    );
    return topPostIds
      .map((id) => postsById.get(id))
      .filter(Boolean)
      .slice(0, limit) as PostWithTags[];
  },
  ["related-posts"],
  {
    tags: ["posts", "tags"],
    revalidate: RELATED_POSTS_REVALIDATE_SECONDS,
  },
);

export const getRelatedPosts = cache(
  (currentPostId: string, tagIds: string[], limit = 3) => {
    const tagKey = [...tagIds].sort().join(",");
    return getRelatedPostsCached(currentPostId, tagKey, limit);
  },
);
