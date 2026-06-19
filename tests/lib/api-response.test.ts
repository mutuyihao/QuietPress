import { afterEach, describe, expect, it, vi } from "vitest";
import { apiInternalError, apiOk, withApiRoute } from "@/lib/api-response";

describe("api-response helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches a request id to successful API responses", async () => {
    const route = withApiRoute("test.success.GET", async () =>
      apiOk({ saved: true }),
    );

    const response = await route(
      new Request("https://quietpress.test/api", {
        headers: { "x-request-id": "req_test_success" },
      }),
      undefined,
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { saved: true },
    });
    expect(response.headers.get("x-request-id")).toBe("req_test_success");
  });

  it("converts uncaught exceptions into safe 500 envelopes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const route = withApiRoute("test.failure.GET", async () => {
      throw new Error("raw database hostname should not reach clients");
    });

    const response = await route(
      new Request("https://quietpress.test/api", {
        headers: { "x-request-id": "req_test_failure" },
      }),
      undefined,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("req_test_failure");
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("TEST_FAILURE_GET_FAILED");
    expect(body.error.message).toContain("(ref: req_test_failure)");
    expect(body.error.message).not.toContain("raw database hostname");
  });

  it("redacts direct internal error responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = apiInternalError(
      "DATABASE_FAILED",
      new Error("raw postgres://secret-host should not reach clients"),
      "服务器内部错误，请稍后重试。",
      "req_direct_failure",
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("req_direct_failure");
    expect(body.error.message).toContain("(ref: req_direct_failure)");
    expect(body.error.message).not.toContain("secret-host");
  });
});
