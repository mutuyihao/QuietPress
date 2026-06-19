import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/blog-utils";

describe("blog markdown rendering", () => {
  it("sanitizes unsafe HTML and URLs", async () => {
    const { html } = await renderMarkdown(
      '<script>alert("xss")</script>\n\n<a href="javascript:alert(1)" target="_blank">bad</a>',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders code blocks with Shiki metadata and falls back safely", async () => {
    const { html } = await renderMarkdown(
      "```not-a-real-language\nconst value = 1\n```",
    );

    expect(html).toContain("<pre");
    expect(html).toContain('data-language="not-a-real-language"');
    expect(html).toContain("const value = 1");
  });
});
