import { describe, expect, it } from "vitest";
import { buildProtectedRouteCsp, isProtectedPageRoute } from "@/proxy";

describe("protected route CSP", () => {
  it("uses nonce CSP without allowing cdnjs", () => {
    const csp = buildProtectedRouteCsp("nonce-test");

    expect(csp).toContain("script-src 'self' 'nonce-nonce-test'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("https://va.vercel-scripts.com");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("https://cloudflareinsights.com");
    expect(csp).not.toContain("cdnjs.cloudflare.com");
  });

  it("limits nonce CSP to admin and auth pages", () => {
    expect(isProtectedPageRoute("/admin")).toBe(true);
    expect(isProtectedPageRoute("/admin/posts/new")).toBe(true);
    expect(isProtectedPageRoute("/auth/login")).toBe(true);
    expect(isProtectedPageRoute("/posts/example")).toBe(false);
    expect(isProtectedPageRoute("/api/admin/comments")).toBe(false);
  });
});
