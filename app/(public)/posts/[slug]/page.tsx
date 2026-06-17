import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getPostBySlug,
  getPublishedPostSlugs,
  getSiteSettings,
} from "@/lib/queries";
import {
  renderMarkdown,
  formatDate,
  calculateReadingTime,
} from "@/lib/blog-utils";
import { DEFAULT_SITE_NAME } from "@/lib/site-defaults";
import { CodeBlockEnhancer } from "@/components/code-block-enhancer";
import { ViewCounter } from "@/components/view-counter";
import { ShareButton } from "@/components/share-button";
import { TOC } from "@/components/toc";
import { ArticleLD, BreadcrumbLD } from "@/components/json-ld";
import { RelatedPosts } from "@/components/related-posts";
import { CommentSection } from "@/components/comment-section";
import { getRelatedPosts } from "@/lib/related-posts";
import { postUrl, tagPath } from "@/lib/route-segments";
import type { Metadata } from "next";

export const revalidate = 86400;
export const dynamicParams = true;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPublishedPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const settings = await getSiteSettings();

  if (!post) return { title: "Post Not Found" };

  const title = post.seo_title || post.title;
  const description =
    post.seo_description ||
    post.excerpt ||
    `${post.title} - ${settings?.site_name || DEFAULT_SITE_NAME}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.published_at || undefined,
      images: post.cover_image_url
        ? [{ url: post.cover_image_url, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
    robots: post.noindex ? { index: false } : undefined,
    alternates: post.canonical_url
      ? { canonical: post.canonical_url }
      : undefined,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const settings = await getSiteSettings();
  const commentsEnabled = settings?.comments_enabled ?? true;
  const renderedContent = await renderMarkdown(post.content_markdown);
  const siteUrl =
    settings?.base_url ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const tagIds = post.tags.map((t) => t.id);
  const relatedPosts = await getRelatedPosts(post.id, tagIds, 3);

  return (
    <article className="max-w-[640px] mx-auto px-6 py-16 sm:py-20 relative">
      <ArticleLD post={post} settings={settings} />
      <BreadcrumbLD
        items={[
          {
            name: settings?.site_name || DEFAULT_SITE_NAME,
            url: siteUrl.replace(/\/+$/, ""),
          },
          { name: post.title, url: postUrl(siteUrl, post.slug) },
        ]}
      />
      <CodeBlockEnhancer />
      <ViewCounter postId={post.id} />
      <TOC headings={renderedContent.headings} />
      <header className="mb-12 sm:mb-16">
        <div className="flex items-center gap-2 text-[13px] tracking-wide text-muted-foreground tabular-nums">
          <time dateTime={post.published_at || post.created_at}>
            {formatDate(post.published_at || post.created_at)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{calculateReadingTime(post.content_markdown)} 分钟阅读</span>
          {post.views_count !== undefined && post.views_count > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.views_count} 次浏览</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <ShareButton />
        </div>
        <h1 className="mt-4 w-full font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground/85 leading-tight tracking-tight">
          {post.title}
        </h1>
        {post.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
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
      </header>

      {post.cover_image_url && (
        <div className="mb-12 sm:mb-16 overflow-hidden rounded-lg border border-border/30 aspect-video relative">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
            priority
            sizes="(max-width: 768px) 100vw, 720px"
          />
        </div>
      )}

      <div
        className="prose-editorial"
        dangerouslySetInnerHTML={{ __html: renderedContent.html }}
      />

      <RelatedPosts posts={relatedPosts} />
      {commentsEnabled && <CommentSection postId={post.id} />}

      <footer className="mt-16 sm:mt-20 pt-10 border-t border-border/40">
        <Link
          href="/"
          className="nav-link inline-flex items-center gap-2 text-[13px] tracking-wide text-muted-foreground transition-editorial hover:text-foreground group"
        >
          <span
            className="transition-transform duration-300 ease-out group-hover:-translate-x-1"
            aria-hidden="true"
          >
            ←
          </span>
          <span>返回</span>
        </Link>
      </footer>
    </article>
  );
}
