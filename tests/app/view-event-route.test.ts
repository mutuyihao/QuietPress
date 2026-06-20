import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/view-event/route";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/public";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitForRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: vi.fn(),
}));

const POST_ID = "550e8400-e29b-41d4-a716-446655440000";

function createViewEventRequest(postId = POST_ID): Request {
  return new Request("https://quietpress.test/api/view-event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://quietpress.test",
    },
    body: JSON.stringify({ postId }),
  });
}

function postViewEvent(request = createViewEventRequest()) {
  return POST(request as Parameters<typeof POST>[0], undefined);
}

function mockSupabase({
  rpcData = true,
  rpcError = null,
  insertError = null,
}: {
  rpcData?: unknown;
  rpcError?: unknown;
  insertError?: unknown;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const from = vi.fn().mockReturnValue({ insert });

  vi.mocked(createPublicClient).mockReturnValue({
    rpc,
    from,
  } as unknown as ReturnType<typeof createPublicClient>);

  return { from, insert, rpc };
}

describe("view-event route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(checkRateLimitForRequest).mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetAt: Date.now() + 60_000,
      retryAfter: 0,
    });
  });

  it("records a view event when analytics dependencies are available", async () => {
    const supabase = mockSupabase({});

    const response = await postViewEvent();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { analyticsLogged: true, viewsIncremented: true },
    });
    expect(supabase.rpc).toHaveBeenCalledWith("increment_post_views", {
      post_id: POST_ID,
    });
    expect(supabase.from).toHaveBeenCalledWith("view_events");
  });

  it("does not fail the page when rate limiting is temporarily unavailable", async () => {
    vi.mocked(checkRateLimitForRequest).mockRejectedValue(
      new Error("IP_HASH_SECRET missing"),
    );
    mockSupabase({});

    const response = await postViewEvent();

    expect(response.status).toBe(200);
  });

  it("returns a best-effort success when the increment RPC fails", async () => {
    mockSupabase({
      rpcData: null,
      rpcError: { code: "PGRST202", message: "function not found" },
    });

    const response = await postViewEvent();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { analyticsLogged: false, viewsIncremented: false },
    });
  });

  it("still reports not found when the boolean RPC confirms no published post", async () => {
    mockSupabase({ rpcData: false });

    const response = await postViewEvent();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("POST_NOT_FOUND");
  });
});
