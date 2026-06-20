import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostWithTags } from "@/lib/types";
import { createRepositories } from "@/lib/db";
import { revalidatePostContent } from "@/lib/blog/revalidation";
import { updateBlogPost } from "@/lib/blog-service";

vi.mock("@/lib/db", () => ({
  createRepositories: vi.fn(),
}));

vi.mock("@/lib/blog/revalidation", () => ({
  revalidateAllContent: vi.fn(),
  revalidateCommentContent: vi.fn(),
  revalidatePostContent: vi.fn(),
  revalidateSettingsContent: vi.fn(),
  revalidateTagContent: vi.fn(),
}));

function createExistingPost(): PostWithTags {
  return {
    id: "post-id",
    title: "Original title",
    slug: "stable-slug",
    excerpt: null,
    content_markdown: "Original content",
    cover_image_url: null,
    status: "draft",
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    noindex: false,
    reading_time_minutes: 1,
    views_count: 0,
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    author_id: "user-id",
    tags: [],
  };
}

describe("updateBlogPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates slug on title change and stores the old slug as a redirect", async () => {
    const existingPost = createExistingPost();
    const posts = {
      getById: vi.fn().mockResolvedValue(existingPost),
      findSlugsByPrefix: vi.fn().mockResolvedValue([]),
      addSlugRedirect: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      saveRevision: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(createRepositories).mockReturnValue({
      posts,
      tags: { list: vi.fn().mockResolvedValue([]) },
      settings: {},
    } as never);

    await updateBlogPost(
      { supabase: {} as never, userId: "user-id" },
      { id: "post-id", title: "New Title" },
    );

    expect(posts.addSlugRedirect).toHaveBeenCalledWith(
      "post-id",
      "stable-slug",
    );
    expect(posts.update).toHaveBeenCalledWith("post-id", {
      title: "New Title",
      slug: "new-title",
    });
    expect(revalidatePostContent).toHaveBeenCalledWith(
      "new-title",
      "stable-slug",
    );
  });
});
