import { Pagination } from "@/components/pagination";
import { PostCard } from "@/components/post-card";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import type { PaginatedResult } from "@/lib/db/types";
import type { PostWithTags, SiteSettings } from "@/lib/types";

interface PublicPostIndexProps {
  result: PaginatedResult<PostWithTags>;
  settings: SiteSettings | null;
}

export function PublicPostIndex({ result, settings }: PublicPostIndexProps) {
  const siteName = settings?.site_name || DEFAULT_SITE_NAME;
  const siteDescription =
    settings?.site_description || DEFAULT_SITE_DESCRIPTION;

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
        <Pagination
          currentPage={result.page}
          totalPages={result.totalPages}
          basePath="/"
          mode="path"
        />
      )}
    </div>
  );
}
