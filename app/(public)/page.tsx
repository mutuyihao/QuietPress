import type { Metadata } from 'next'
import { PostCard } from '@/components/post-card'
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME } from '@/lib/site-defaults'
import { getPublishedPosts, getSiteSettings } from '@/lib/queries'
import { Pagination } from '@/components/pagination'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    title: {
      absolute: settings?.site_name || DEFAULT_SITE_NAME,
    },
    description: settings?.site_description || DEFAULT_SITE_DESCRIPTION,
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const [result, settings] = await Promise.all([
    getPublishedPosts(page, 10),
    getSiteSettings(),
  ])
  const siteName = settings?.site_name || DEFAULT_SITE_NAME
  const siteDescription = settings?.site_description || DEFAULT_SITE_DESCRIPTION

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <section className="mb-16 sm:mb-20">
        <h1 className="sr-only">{siteName}</h1>
        <p className="font-serif text-lg sm:text-xl text-muted-foreground leading-relaxed text-balance tracking-tight">
          {siteDescription}
        </p>
      </section>

      {result.items.length === 0 ? (
        <section>
          <p className="text-muted-foreground text-[15px]">暂无文章。</p>
        </section>
      ) : (
        <section className="space-y-14 sm:space-y-16">
          {result.items.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </section>
      )}

      {result.totalPages > 1 && (
        <Pagination currentPage={result.page} totalPages={result.totalPages} />
      )}
    </div>
  )
}
