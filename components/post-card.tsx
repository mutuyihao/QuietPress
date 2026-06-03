import Link from 'next/link'
import type { PostWithTags } from '@/lib/types'
import { formatDate, calculateReadingTime } from '@/lib/blog-utils'
import { postPath } from '@/lib/route-segments'

interface PostCardProps {
  post: PostWithTags
  index?: number
}

export function PostCard({ post, index = 0 }: PostCardProps) {
  const readingTime = calculateReadingTime(post.content_markdown)

  return (
    <article
      className="animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Link href={postPath(post.slug)} className="post-card-link group">
        <div className="flex items-center gap-2 text-[13px] tracking-wide text-muted-foreground tabular-nums">
          <time dateTime={post.published_at || post.created_at}>
            {formatDate(post.published_at || post.created_at)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{readingTime} 分钟阅读</span>
          {post.views_count !== undefined && post.views_count > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.views_count} 次浏览</span>
            </>
          )}
        </div>
        <h2 className="mt-3 w-full font-serif text-[1.375rem] leading-snug font-semibold text-foreground/85 group-hover:text-foreground/65 transition-editorial tracking-tight">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed line-clamp-2">
            {post.excerpt}
          </p>
        )}
      </Link>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {post.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="nav-link text-[12px] tracking-wide text-muted-foreground transition-editorial hover:text-foreground"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
