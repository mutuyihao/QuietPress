import { getPublishedPosts, getAllTags, getSiteSettings } from '@/lib/queries'
import { getDefaultSiteUrl, normalizeSiteUrl } from '@/lib/env'
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [result, tags, settings] = await Promise.all([
    getPublishedPosts(1, 1000),
    getAllTags(),
    getSiteSettings(),
  ])

  const posts = result.items

  const baseUrl = normalizeSiteUrl(settings?.base_url || getDefaultSiteUrl())

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tags`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/posts/${encodeURIComponent(post.slug)}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  const tagPages: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${baseUrl}/tags/${encodeURIComponent(tag.slug)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...postPages, ...tagPages]
}
