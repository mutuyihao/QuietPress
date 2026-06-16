import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createRepositories } from "@/lib/db";
import { getPostCacheTag } from "@/lib/blog/cache-tags";
import type { PostWithTags, Tag, SiteSettings } from "@/lib/types";
import type { PaginatedResult } from "@/lib/db/types";

const POSTS_REVALIDATE_SECONDS = 300;
const TAXONOMY_REVALIDATE_SECONDS = 3600;
const SETTINGS_REVALIDATE_SECONDS = 3600;

const getPublicRepos = cache(async () => {
  const supabase = createPublicClient();
  return createRepositories(supabase);
});

const getPublishedPostsCached = unstable_cache(
  async (page = 1, pageSize = 10): Promise<PaginatedResult<PostWithTags>> => {
    const { posts } = await getPublicRepos();
    return posts.list(page, pageSize);
  },
  ["published-posts"],
  {
    tags: ["posts"],
    revalidate: POSTS_REVALIDATE_SECONDS,
  },
);

export const getPublishedPosts = cache((page = 1, pageSize = 10) =>
  getPublishedPostsCached(page, pageSize),
);

const getPublishedPostSlugsCached = unstable_cache(
  async (): Promise<string[]> => {
    const { posts } = await getPublicRepos();
    return posts.listPublishedSlugs();
  },
  ["published-post-slugs"],
  {
    tags: ["posts"],
    revalidate: POSTS_REVALIDATE_SECONDS,
  },
);

export const getPublishedPostSlugs = cache(() => getPublishedPostSlugsCached());

export const getPostBySlug = cache((slug: string) =>
  unstable_cache(
    async (): Promise<PostWithTags | null> => {
      const { posts } = await getPublicRepos();
      return posts.getBySlug(slug);
    },
    ["post-by-slug", slug],
    {
      tags: [getPostCacheTag(slug)],
      revalidate: POSTS_REVALIDATE_SECONDS,
    },
  )(),
);

const getPostsByTagCached = unstable_cache(
  async (tagSlug: string): Promise<PostWithTags[]> => {
    const { posts } = await getPublicRepos();
    return posts.listByTag(tagSlug);
  },
  ["posts-by-tag"],
  {
    tags: ["posts", "tags"],
    revalidate: POSTS_REVALIDATE_SECONDS,
  },
);

export const getPostsByTag = cache((tagSlug: string) =>
  getPostsByTagCached(tagSlug),
);

const getAllTagsCached = unstable_cache(
  async (): Promise<Tag[]> => {
    const { tags } = await getPublicRepos();
    return tags.list();
  },
  ["all-tags"],
  {
    tags: ["tags"],
    revalidate: TAXONOMY_REVALIDATE_SECONDS,
  },
);

export const getAllTags = cache(() => getAllTagsCached());

const getTagBySlugCached = unstable_cache(
  async (slug: string): Promise<Tag | null> => {
    const { tags } = await getPublicRepos();
    return tags.getBySlug(slug);
  },
  ["tag-by-slug"],
  {
    tags: ["tags"],
    revalidate: TAXONOMY_REVALIDATE_SECONDS,
  },
);

export const getTagBySlug = cache((slug: string) => getTagBySlugCached(slug));

const getSiteSettingsCached = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    const { settings } = await getPublicRepos();
    return settings.get();
  },
  ["site-settings"],
  {
    tags: ["settings"],
    revalidate: SETTINGS_REVALIDATE_SECONDS,
  },
);

export const getSiteSettings = cache(() => getSiteSettingsCached());
