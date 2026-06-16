import { getPublishedPosts, getAllTags, getSiteSettings } from "@/lib/queries";
import { getDefaultSiteUrl, normalizeSiteUrl } from "@/lib/env";
import { postPath, tagPath } from "@/lib/route-segments";
import type { MetadataRoute } from "next";

const SITEMAP_PAGE_SIZE = 500;

async function getAllPublishedPostsForSitemap() {
  const firstPage = await getPublishedPosts(1, SITEMAP_PAGE_SIZE);
  const posts = [...firstPage.items];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await getPublishedPosts(page, SITEMAP_PAGE_SIZE);
    posts.push(...result.items);
  }

  return posts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags, settings] = await Promise.all([
    getAllPublishedPostsForSitemap(),
    getAllTags(),
    getSiteSettings(),
  ]);

  const baseUrl = normalizeSiteUrl(settings?.base_url || getDefaultSiteUrl());

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}${postPath(post.slug)}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const tagPages: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${baseUrl}${tagPath(tag.slug)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...postPages, ...tagPages];
}
