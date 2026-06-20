import { describe, expect, it } from "vitest";
import { getPostCacheTag } from "@/lib/blog/cache-tags";

describe("post cache tags", () => {
  it("keeps simple slugs readable", () => {
    expect(getPostCacheTag("hello-world")).toBe("post:hello-world");
  });

  it("hashes slugs containing punctuation or non-ascii characters", () => {
    const slug = "hello\uFF0Cworld";
    const tag = getPostCacheTag(slug);

    expect(tag).toMatch(/^post:[a-f0-9]{64}$/);
    expect(tag).not.toContain("\uFF0C");
  });
});
