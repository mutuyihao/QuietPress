import { createHash } from "node:crypto";

const MAX_CACHE_TAG_LENGTH = 256;
const POST_CACHE_TAG_PREFIX = "post:";
const MAX_POST_CACHE_TAG_SLUG_LENGTH =
  MAX_CACHE_TAG_LENGTH - POST_CACHE_TAG_PREFIX.length;
const SAFE_CACHE_TAG_SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

function hashSlug(slug: string): string {
  return createHash("sha256").update(slug).digest("hex");
}

export function getPostCacheTag(slug: string): string {
  const normalizedSlug = slug.trim();

  if (
    normalizedSlug.length <= MAX_POST_CACHE_TAG_SLUG_LENGTH &&
    SAFE_CACHE_TAG_SLUG_PATTERN.test(normalizedSlug)
  ) {
    return `${POST_CACHE_TAG_PREFIX}${normalizedSlug}`;
  }

  return `${POST_CACHE_TAG_PREFIX}${hashSlug(normalizedSlug)}`;
}
