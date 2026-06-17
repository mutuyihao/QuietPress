import Link from "next/link";
import { getArchivePosts } from "@/lib/queries";
import { DEFAULT_LOCALE } from "@/lib/date-format";
import { postPath } from "@/lib/route-segments";
import type { ArchivePost } from "@/lib/types";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "归档",
  description: "按时间浏览已发布文章。",
};

interface ArchiveMonthGroup {
  key: string;
  label: string;
  posts: ArchivePost[];
}

interface ArchiveYearGroup {
  year: string;
  months: ArchiveMonthGroup[];
}

function getPostDate(post: ArchivePost): Date {
  const date = new Date(post.published_at || post.created_at);
  return Number.isNaN(date.getTime()) ? new Date(post.created_at) : date;
}

function groupArchivePosts(posts: ArchivePost[]): ArchiveYearGroup[] {
  const years: ArchiveYearGroup[] = [];
  const yearMap = new Map<string, ArchiveYearGroup>();

  for (const post of posts) {
    const date = getPostDate(post);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;

    let yearGroup = yearMap.get(year);
    if (!yearGroup) {
      yearGroup = { year, months: [] };
      yearMap.set(year, yearGroup);
      years.push(yearGroup);
    }

    let monthGroup = yearGroup.months.find((item) => item.key === monthKey);
    if (!monthGroup) {
      monthGroup = {
        key: monthKey,
        label: new Intl.DateTimeFormat(DEFAULT_LOCALE, {
          month: "long",
        }).format(date),
        posts: [],
      };
      yearGroup.months.push(monthGroup);
    }

    monthGroup.posts.push(post);
  }

  return years;
}

function formatArchiveDate(post: ArchivePost): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: "2-digit",
    day: "2-digit",
  }).format(getPostDate(post));
}

export default async function ArchivePage() {
  const posts = await getArchivePosts();
  const groups = groupArchivePosts(posts);

  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20">
      <header className="mb-12 sm:mb-16">
        <p className="text-[13px] tracking-wide text-muted-foreground mb-3 uppercase">
          Archive
        </p>
        <h1 className="font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground/85 tracking-tight">
          归档
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          共 {posts.length} 篇已发布文章，按发布时间倒序整理。
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center text-[15px] text-muted-foreground">
          暂无已发布文章。
        </div>
      ) : (
        <div className="space-y-12 sm:space-y-14">
          {groups.map((yearGroup) => (
            <section key={yearGroup.year} className="animate-fade-up">
              <h2 className="font-serif text-[1.5rem] font-semibold tracking-tight text-foreground/85">
                {yearGroup.year}
              </h2>
              <div className="mt-6 space-y-8">
                {yearGroup.months.map((monthGroup) => (
                  <div
                    key={monthGroup.key}
                    className="grid gap-4 sm:grid-cols-[5.5rem_1fr]"
                  >
                    <div className="text-[13px] tracking-wide text-muted-foreground">
                      {monthGroup.label}
                    </div>
                    <div className="space-y-4 border-l border-border/50 pl-5">
                      {monthGroup.posts.map((post, index) => (
                        <Link
                          key={post.id}
                          href={postPath(post.slug)}
                          className="group block"
                          style={{
                            animationDelay: `${Math.min(index, 10) * 40}ms`,
                          }}
                        >
                          <article className="animate-fade-up">
                            <time
                              dateTime={post.published_at || post.created_at}
                              className="text-[12px] tabular-nums tracking-wide text-muted-foreground/70"
                            >
                              {formatArchiveDate(post)}
                            </time>
                            <h3 className="mt-1 font-serif text-[1.125rem] font-semibold leading-snug text-foreground/85 transition-editorial group-hover:text-foreground/60">
                              {post.title}
                            </h3>
                          </article>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
