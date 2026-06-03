import type { PostWithTags, SiteSettings } from '@/lib/types'
import { safeJsonLd } from '@/lib/json-ld'

function baseUrl(settings: SiteSettings | null): string {
  const url = settings?.base_url || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return url.replace(/\/+$/, '')
}

export function OrganizationLD({ settings }: { settings: SiteSettings | null }) {
  const siteName = settings?.site_name || 'Blog'
  const url = baseUrl(settings)
  const json = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url,
    ...(settings?.default_og_image_url ? { logo: settings.default_og_image_url } : {}),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(json) }}
    />
  )
}

export function WebSiteLD({ settings }: { settings: SiteSettings | null }) {
  const siteName = settings?.site_name || 'Blog'
  const description = settings?.site_description || ''
  const url = baseUrl(settings)
  const json = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    description,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${url}/posts/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(json) }}
    />
  )
}

export function ArticleLD({
  post,
  settings,
}: {
  post: PostWithTags
  settings: SiteSettings | null
}) {
  const siteName = settings?.site_name || 'Blog'
  const url = baseUrl(settings)
  const json = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || '',
    image: post.cover_image_url || settings?.default_og_image_url || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: settings?.author_name || siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      ...(settings?.default_og_image_url ? { logo: { '@type': 'ImageObject', url: settings.default_og_image_url } } : {}),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}/posts/${encodeURIComponent(post.slug)}`,
    },
    ...(post.tags.length > 0
      ? { keywords: post.tags.map((t) => t.name).join(', ') }
      : {}),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(json) }}
    />
  )
}

export function BreadcrumbLD({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(json) }}
    />
  )
}
