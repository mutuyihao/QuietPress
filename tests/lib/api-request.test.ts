import { describe, expect, it } from "vitest";
import { isUuid, readJsonObject } from "@/lib/api-request";

describe("api-request helpers", () => {
  it("accepts valid UUIDs and rejects malformed identifiers", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("550e8400-e29b-61d4-a716-446655440000")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("reads JSON objects and rejects arrays or invalid JSON", async () => {
    await expect(
      readJsonObject(
        new Request("https://quietpress.test/api", {
          method: "POST",
          body: JSON.stringify({ ok: true }),
        }),
      ),
    ).resolves.toEqual({ ok: true });

    await expect(
      readJsonObject(
        new Request("https://quietpress.test/api", {
          method: "POST",
          body: JSON.stringify(["not", "object"]),
        }),
      ),
    ).resolves.toBeNull();

    await expect(
      readJsonObject(
        new Request("https://quietpress.test/api", {
          method: "POST",
          body: "{",
        }),
      ),
    ).resolves.toBeNull();
  });
});
