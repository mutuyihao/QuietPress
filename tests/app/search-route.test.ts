import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/search/route";
import { createPublicClient } from "@/lib/supabase/public";

const SEARCH_QUERY = "\u6df1\u8272";
const SEARCH_TITLE =
  "\u9875\u9762\u52a0\u8f7d\u65f6\uff0c\u6df1\u8272\u6a21\u5f0f\u95ea\u767d\u7684\u95ee\u9898\u89e3\u51b3";
const SEARCH_EXCERPT =
  "\u89e3\u51b3\u9875\u9762\u52a0\u8f7d\u65f6\u7684\u4e3b\u9898\u95ea\u70c1\u3002";

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: vi.fn(),
}));

function createSearchRequest(query: string): NextRequest {
  return new NextRequest(
    `https://quietpress.test/api/search?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "user-agent": "vitest",
        "x-forwarded-for": "203.0.113.10",
      },
    },
  );
}

function mockSearchResults() {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: SEARCH_TITLE,
        slug: "fix-dark-mode-flash",
        excerpt: SEARCH_EXCERPT,
      },
    ],
    error: null,
  });

  vi.mocked(createPublicClient).mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof createPublicClient>);

  return { rpc };
}

describe("search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("falls back when rate-limit fingerprinting is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IP_HASH_SECRET", "");
    const supabase = mockSearchResults();

    const response = await GET(createSearchRequest(SEARCH_QUERY), undefined);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: SEARCH_TITLE,
          slug: "fix-dark-mode-flash",
          excerpt: SEARCH_EXCERPT,
        },
      ],
    });
    expect(supabase.rpc).toHaveBeenCalledWith("search_posts", {
      search_query: SEARCH_QUERY,
      limit_count: 50,
    });
  });
});
