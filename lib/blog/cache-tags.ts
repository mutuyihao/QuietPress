import { createHash } from "node:crypto";

const MAX_CACHE_TAG_LENGTH = 256;
const POST_CACHE_TAG_PREFIX = "post:";
const MAX_POST_CACHE_TAG_SLUG_LENGTH =
  MAX_CACHE_TAG_LENGTH - POST_CACHE_TAG_PREFIX.length;

export function getPostCacheTag(slug: string): string {
  const normalizedSlug = slug.trim();

  if (normalizedSlug.length <= MAX_POST_CACHE_TAG_SLUG_LENGTH) {
    return `${POST_CACHE_TAG_PREFIX}${normalizedSlug}`;
  }

  return `${POST_CACHE_TAG_PREFIX}${createHash("sha256").update(normalizedSlug).digest("hex")}`;
}
