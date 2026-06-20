import { describe, expect, it } from "vitest";
import { SupabasePostRepository } from "@/lib/db/supabase/posts";

function createSearchAdminSupabaseMock() {
  let capturedOr = "";

  const query = {
    data: [],
    error: null,
    select() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    eq() {
      return this;
    },
    or(value: string) {
      capturedOr = value;
      return this;
    },
  };

  return {
    supabase: {
      from() {
        return query;
      },
    },
    getCapturedOr() {
      return capturedOr;
    },
  };
}

describe("SupabasePostRepository.searchAdmin", () => {
  it("keeps comma punctuation inside PostgREST or filter values", async () => {
    const { supabase, getCapturedOr } = createSearchAdminSupabaseMock();
    const repository = new SupabasePostRepository(supabase as never);

    await repository.searchAdmin("hello, world (v2)");

    expect(getCapturedOr()).toBe(
      [
        'title.ilike."%hello, world (v2)%"',
        'slug.ilike."%hello, world (v2)%"',
        'excerpt.ilike."%hello, world (v2)%"',
        'content_markdown.ilike."%hello, world (v2)%"',
      ].join(","),
    );
  });

  it("escapes ilike wildcards while preserving punctuation", async () => {
    const { supabase, getCapturedOr } = createSearchAdminSupabaseMock();
    const repository = new SupabasePostRepository(supabase as never);

    await repository.searchAdmin("100%_done, ok");

    expect(getCapturedOr()).toContain('title.ilike."%100\\\\%\\\\_done, ok%"');
  });
});

function createGetBySlugSupabaseMock(matchSlug: string) {
  const capturedSlugEqValues: string[] = [];
  const post = {
    id: "post-id",
    title: "Title",
    slug: matchSlug,
    excerpt: null,
    content_markdown: "",
    cover_image_url: null,
    status: "published",
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    noindex: false,
    reading_time_minutes: 1,
    views_count: 0,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    post_tags: [],
  };

  const query = {
    select() {
      return this;
    },
    eq(column: string, value: string) {
      if (column === "slug") capturedSlugEqValues.push(value);
      return this;
    },
    lte() {
      return this;
    },
    maybeSingle() {
      const currentSlug = capturedSlugEqValues.at(-1);
      return Promise.resolve({
        data: currentSlug === matchSlug ? post : null,
        error: null,
      });
    },
  };

  return {
    supabase: {
      from() {
        return query;
      },
    },
    getCapturedSlugEqValues() {
      return capturedSlugEqValues;
    },
  };
}

function createRedirectSupabaseMock() {
  const post = {
    id: "post-id",
    title: "New title",
    slug: "new-title",
    excerpt: null,
    content_markdown: "",
    cover_image_url: null,
    status: "published",
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    noindex: false,
    reading_time_minutes: 1,
    views_count: 0,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    post_tags: [],
  };

  function createQuery(table: string) {
    const filters = new Map<string, string>();

    return {
      select() {
        return this;
      },
      eq(column: string, value: string) {
        filters.set(column, value);
        return this;
      },
      lte() {
        return this;
      },
      maybeSingle() {
        if (table === "post_slug_redirects") {
          return Promise.resolve({
            data:
              filters.get("slug") === "old-title"
                ? { post_id: "post-id", slug: "old-title" }
                : null,
            error: null,
          });
        }

        if (table === "posts" && filters.get("id") === "post-id") {
          return Promise.resolve({ data: post, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      },
    };
  }

  return {
    supabase: {
      from(table: string) {
        return createQuery(table);
      },
    },
  };
}

describe("SupabasePostRepository.getBySlug", () => {
  it("queries comma-containing slug variants with equality filters", async () => {
    const slug = "hello\uFF0Cworld";
    const { supabase, getCapturedSlugEqValues } =
      createGetBySlugSupabaseMock(slug);
    const repository = new SupabasePostRepository(supabase as never);

    const post = await repository.getBySlug("hello%EF%BC%8Cworld");

    expect(post?.slug).toBe(slug);
    expect(getCapturedSlugEqValues()).toEqual([
      "hello%EF%BC%8Cworld",
      slug,
    ]);
  });

  it("resolves old slugs through the slug redirect table", async () => {
    const { supabase } = createRedirectSupabaseMock();
    const repository = new SupabasePostRepository(supabase as never);

    const post = await repository.getBySlug("old-title");

    expect(post?.slug).toBe("new-title");
  });
});
