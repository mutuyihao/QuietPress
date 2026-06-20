import { describe, expect, it, vi } from "vitest";
import {
  getUniquePostSlug,
  normalizePostSlugBase,
  POST_SLUG_BASE_MAX_LENGTH,
} from "@/lib/post-slugs";

describe("post slug policy", () => {
  it("creates URL slugs from titles without preserving punctuation", () => {
    expect(normalizePostSlugBase("Hello\uFF0C World!")).toBe("hello-world");
  });

  it("falls back when the title contains no slug-safe content", () => {
    expect(normalizePostSlugBase("!!!")).toBe("untitled");
  });

  it("caps base slug length before uniqueness suffixes are applied", () => {
    expect(normalizePostSlugBase("a".repeat(250))).toHaveLength(
      POST_SLUG_BASE_MAX_LENGTH,
    );
  });

  it("deduplicates against existing slugs", async () => {
    const posts = {
      findSlugsByPrefix: vi
        .fn()
        .mockResolvedValue(["hello-world", "hello-world-2"]),
    };

    await expect(getUniquePostSlug(posts, "Hello\uFF0C World!")).resolves.toBe(
      "hello-world-3",
    );
    expect(posts.findSlugsByPrefix).toHaveBeenCalledWith(
      "hello-world",
      undefined,
    );
  });
});
