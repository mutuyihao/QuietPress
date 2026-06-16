import Link from "next/link";
import { formatDate } from "@/lib/blog-utils";
import { postPath } from "@/lib/route-segments";
import type { PostWithTags } from "@/lib/types";

interface RelatedPostsProps {
  posts: PostWithTags[];
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-16 sm:mt-20 pt-10 border-t border-border/40">
      <h2 className="font-serif text-lg font-semibold text-foreground mb-6">
        相关文章
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={postPath(post.slug)}
            className="group block bg-card border border-border/50 rounded-lg p-4 hover:border-foreground/20 transition-all duration-300 hover:shadow-sm"
          >
            <h3 className="font-sans text-[14px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>
            {post.excerpt && (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground/70 line-clamp-2">
                {post.excerpt}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground/50">
              <time dateTime={post.published_at || post.created_at}>
                {formatDate(post.published_at || post.created_at)}
              </time>
              {post.tags.length > 0 && (
                <>
                  <span>·</span>
                  <span>{post.tags.map((t) => t.name).join(", ")}</span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
