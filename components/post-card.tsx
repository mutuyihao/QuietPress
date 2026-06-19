/* eslint-disable @next/next/no-img-element -- Post covers can be custom storage URLs not known to next/image. */

import Link from "next/link";
import type { PostWithTags } from "@/lib/types";
import { formatDate } from "@/lib/blog-utils";
import { postPath, tagPath } from "@/lib/route-segments";

interface PostCardProps {
  post: PostWithTags;
  index?: number;
  fallbackImageUrl?: string | null;
}

export function PostCard({
  post,
  index = 0,
  fallbackImageUrl = null,
}: PostCardProps) {
  const imageUrl = post.cover_image_url || fallbackImageUrl;

  return (
    <article
      className="animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Link href={postPath(post.slug)} className="post-card-link group">
        <div
          className={
            imageUrl
              ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-start sm:gap-5"
              : ""
          }
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] tracking-wide text-muted-foreground tabular-nums">
              <time dateTime={post.published_at || post.created_at}>
                {formatDate(post.published_at || post.created_at)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{post.reading_time_minutes} 分钟阅读</span>
              {post.views_count !== undefined && post.views_count > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{post.views_count} 次浏览</span>
                </>
              )}
            </div>
            <h2 className="mt-3 w-full font-serif text-[1.375rem] leading-snug font-semibold tracking-tight text-foreground/85 transition-editorial group-hover:text-foreground/65">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            )}
          </div>
          {imageUrl && (
            <div className="hidden aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-lg border border-border/35 bg-muted/60 shadow-[0_10px_28px_rgba(0,0,0,0.04)] sm:block">
              <img
                src={imageUrl}
                alt=""
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-85"
              />
            </div>
          )}
        </div>
      </Link>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {post.tags.map((tag) => (
            <Link
              key={tag.id}
              href={tagPath(tag.slug)}
              className="nav-link text-[12px] tracking-wide text-muted-foreground transition-editorial hover:text-foreground"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
