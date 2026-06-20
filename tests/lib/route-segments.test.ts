import { describe, expect, it } from "vitest";
import {
  getRouteSegmentVariants,
  postPath,
  tagPath,
} from "@/lib/route-segments";

describe("route segment helpers", () => {
  it("uses hyphenated paths for slugs with spaces", () => {
    expect(postPath("hello world")).toBe("/posts/hello-world");
    expect(tagPath("quiet press")).toBe("/tags/quiet-press");
  });

  it("keeps encoded path separators safe", () => {
    expect(postPath("hello/world")).toBe("/posts/hello%2Fworld");
  });

  it("matches encoded spaces, spaces, and hyphenated legacy slugs", () => {
    expect(getRouteSegmentVariants("hello%20world")).toEqual([
      "hello%20world",
      "hello world",
      "hello-world",
    ]);
    expect(getRouteSegmentVariants("hello-world")).toEqual([
      "hello-world",
      "hello world",
      "hello%20world",
    ]);
  });
});
