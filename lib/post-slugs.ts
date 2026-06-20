import { createPostSlug } from "@/lib/blog-utils";
import type { PostRepository } from "@/lib/db/types";

export const POST_SLUG_BASE_MAX_LENGTH = 200;

function trimSlugSeparators(slug: string): string {
  return slug.replace(/^-+|-+$/g, "") || "untitled";
}

export function normalizePostSlugBase(source: string): string {
  return trimSlugSeparators(
    createPostSlug(source).slice(0, POST_SLUG_BASE_MAX_LENGTH),
  );
}

export async function getUniquePostSlug(
  posts: Pick<PostRepository, "findSlugsByPrefix">,
  source: string,
  excludingId?: string,
): Promise<string> {
  const base = normalizePostSlugBase(source);
  const existing = new Set(await posts.findSlugsByPrefix(base, excludingId));
  let slug = base;
  let index = 2;

  while (existing.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }

  return slug;
}
