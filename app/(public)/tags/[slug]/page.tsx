import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllTags, getPostsByTag, getTagBySlug } from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import type { Metadata } from "next";

export const revalidate = 3600;
export const dynamicParams = true;

interface TagPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);

  if (!tag) return { title: "Tag Not Found" };

  return {
    title: `${tag.name}`,
    description: `查看所有带有 ${tag.name} 标签的文章`,
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);

  if (!tag) {
    notFound();
  }

  const posts = await getPostsByTag(slug);

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <header className="mb-12 sm:mb-16">
        <p className="text-[13px] tracking-wide text-muted-foreground mb-3">
          标签
        </p>
        <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground tracking-tight">
          {tag.name}
        </h1>
      </header>

      {posts.length === 0 ? (
        <p className="text-muted-foreground text-[15px]">该标签下暂无文章。</p>
      ) : (
        <div className="space-y-14 sm:space-y-16">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </div>
      )}

      <footer className="mt-16 sm:mt-20 pt-10 border-t border-border/40">
        <Link
          href="/tags"
          className="nav-link inline-flex items-center gap-2 text-[13px] tracking-wide text-muted-foreground transition-editorial hover:text-foreground group"
        >
          <span
            className="transition-transform duration-300 ease-out group-hover:-translate-x-1"
            aria-hidden="true"
          >
            ←
          </span>
          <span>所有标签</span>
        </Link>
      </footer>
    </div>
  );
}
