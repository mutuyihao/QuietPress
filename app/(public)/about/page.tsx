import { getSiteSettings } from '@/lib/queries'
import { markdownToHtml } from '@/lib/blog-utils'
import type { Metadata } from 'next'

export const revalidate = 86400

export const metadata: Metadata = {
  title: '关于',
}

export default async function AboutPage() {
  const settings = await getSiteSettings()
  const aboutHtml = await markdownToHtml(settings?.about_content || '欢迎来到我的博客。')

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground mb-12 sm:mb-16 tracking-tight">关于</h1>
      
      <div 
        className="prose-editorial"
        dangerouslySetInnerHTML={{ __html: aboutHtml }}
      />

      {settings?.author_name && (
        <p className="mt-12 text-[15px] text-muted-foreground tracking-wide">
          — {settings.author_name}
        </p>
      )}
    </div>
  )
}
