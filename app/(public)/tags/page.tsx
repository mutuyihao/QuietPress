import Link from 'next/link'
import { getAllTags } from '@/lib/queries'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '标签',
}

export default async function TagsPage() {
  const tags = await getAllTags()

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground/85 mb-12 sm:mb-16 tracking-tight">标签</h1>
      
      {tags.length === 0 ? (
        <p className="text-muted-foreground text-[15px]">暂无标签。</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="animate-fade-up px-5 py-2.5 text-[13px] tracking-wide text-muted-foreground bg-transparent border border-border/50 rounded-full transition-all duration-300 ease-out hover:text-foreground hover:border-foreground/30"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
