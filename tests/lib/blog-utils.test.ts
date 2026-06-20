import { describe, expect, it } from "vitest";
import {
  createPostSlug,
  removeDuplicateLeadingTitleHeading,
  renderMarkdown,
  slugify,
} from "@/lib/blog-utils";

describe("blog slug generation", () => {
  it("replaces title spaces with hyphens for post slugs", () => {
    expect(createPostSlug("记录一次字节 OD 前端(React)岗位面试记录")).toBe(
      "记录一次字节-od-前端react岗位面试记录",
    );
  });

  it("normalizes repeated separators in generic slugs", () => {
    expect(slugify("  Hello   QuietPress_blog  ")).toBe(
      "hello-quietpress-blog",
    );
  });
});

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

  it("preserves Shiki token styles for highlighted code blocks", async () => {
    const { html } = await renderMarkdown("```ts\nconst value = 1\n```");

    expect(html).toContain('class="shiki');
    expect(html).toContain("--shiki-dark:");
    expect(html).toContain("color:#");
    expect(html).toContain('<span class="line">');
  });

  it("removes a duplicate leading title heading before rendering", async () => {
    const markdown = removeDuplicateLeadingTitleHeading(
      "# My Post ###\n\nIntro text.\n\n## Section",
      "My Post",
    );
    const { headings, html } = await renderMarkdown(markdown);

    expect(html).not.toContain("<h1");
    expect(html).toContain("<p>Intro text.</p>");
    expect(headings).toEqual([{ id: "section", text: "Section", level: 2 }]);
  });

  it("keeps non-duplicate and non-leading title headings", () => {
    expect(
      removeDuplicateLeadingTitleHeading("# Other Post\n\nBody", "My Post"),
    ).toBe("# Other Post\n\nBody");
    expect(
      removeDuplicateLeadingTitleHeading("Intro\n\n# My Post", "My Post"),
    ).toBe("Intro\n\n# My Post");
    expect(
      removeDuplicateLeadingTitleHeading("## My Post\n\nBody", "My Post"),
    ).toBe("## My Post\n\nBody");
    expect(
      removeDuplicateLeadingTitleHeading(
        "# Use in SQL\n\nBody",
        "Use * in SQL",
      ),
    ).toBe("# Use in SQL\n\nBody");
  });
});
