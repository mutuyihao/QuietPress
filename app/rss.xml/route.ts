import { getPublishedPosts, getSiteSettings } from '@/lib/queries'
import { getDefaultSiteUrl, normalizeSiteUrl } from '@/lib/env'
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME } from '@/lib/site-defaults'

export async function GET() {
  const [result, settings] = await Promise.all([
    getPublishedPosts(1, 100),
    getSiteSettings(),
  ])

  const posts = result.items

  const baseUrl = normalizeSiteUrl(settings?.base_url || getDefaultSiteUrl())
  const siteName = settings?.site_name || DEFAULT_SITE_NAME
  const siteDescription = settings?.site_description || DEFAULT_SITE_DESCRIPTION

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts.map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/posts/${escapeXml(encodeURIComponent(post.slug))}</link>
      <guid isPermaLink="true">${baseUrl}/posts/${escapeXml(encodeURIComponent(post.slug))}</guid>
      <description>${escapeXml(post.excerpt || post.title)}</description>
      <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
      ${post.tags.map((tag) => `<category>${escapeXml(tag.name)}</category>`).join('\n      ')}
    </item>`).join('')}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
