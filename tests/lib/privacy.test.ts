import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getClientAddress,
  hashSensitiveValue,
  newRequestId,
} from "@/lib/privacy";
import { getIpHashSecret } from "@/lib/env";

const originalEnv = { ...process.env };

function restoreEnv() {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
}

describe("privacy helpers", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("uses a stable secret-scoped hash without exposing the input", () => {
    process.env.IP_HASH_SECRET = "test-secret";

    const first = hashSensitiveValue("203.0.113.10", "ip");
    const second = hashSensitiveValue("203.0.113.10", "ip");
    const otherScope = hashSensitiveValue("203.0.113.10", "comment-ip");

    expect(first).toBe(second);
    expect(first).not.toContain("203.0.113.10");
    expect(first).not.toBe(otherScope);
  });

  it("reads client IP from the trusted right side of x-forwarded-for", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const oneHop = new Request("https://quietpress.test", {
      headers: {
        "x-forwarded-for": "198.51.100.10, 203.0.113.20",
        "x-real-ip": "192.0.2.30",
      },
    });
    expect(getClientAddress(oneHop)).toBe("203.0.113.20");

    process.env.TRUSTED_PROXY_HOPS = "2";
    const twoHops = new Request("https://quietpress.test", {
      headers: {
        "x-forwarded-for": "198.51.100.10, 203.0.113.20",
      },
    });
    expect(getClientAddress(twoHops)).toBe("198.51.100.10");
  });

  it("requires IP_HASH_SECRET in production", () => {
    vi.stubEnv("IP_HASH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getIpHashSecret()).toThrow("IP_HASH_SECRET");
  });

  it("generates UUID request ids", () => {
    expect(newRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
