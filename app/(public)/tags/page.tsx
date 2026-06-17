import Link from "next/link";
import { getTagsWithPostCounts } from "@/lib/queries";
import { tagPath } from "@/lib/route-segments";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "标签",
  description: "按标签浏览文章。",
};

export default async function TagsPage() {
  const tags = await getTagsWithPostCounts();

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <header className="mb-12 sm:mb-16">
        <p className="text-[13px] tracking-wide text-muted-foreground mb-3 uppercase">
          Tags
        </p>
        <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground/85 tracking-tight">
          标签
        </h1>
      </header>

      {tags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center text-[15px] text-muted-foreground">
          暂无标签。
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={tagPath(tag.slug)}
              className="animate-fade-up inline-flex items-center gap-2 px-5 py-2.5 text-[13px] tracking-wide text-muted-foreground bg-transparent border border-border/50 rounded-full transition-all duration-300 ease-out hover:text-foreground hover:border-foreground/30"
              style={{ animationDelay: `${index * 50}ms` }}
              aria-label={`${tag.name}，${tag.post_count} 篇文章`}
            >
              <span>{tag.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground/70">
                {tag.post_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
