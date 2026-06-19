import { describe, expect, it } from "vitest";
import { isValidCronAuthorization } from "@/app/api/cron/publish-scheduled/route";

describe("cron route authorization", () => {
  it("accepts only matching bearer tokens", () => {
    expect(isValidCronAuthorization("Bearer test-secret", "test-secret")).toBe(
      true,
    );
    expect(isValidCronAuthorization("bearer test-secret", "test-secret")).toBe(
      true,
    );
    expect(isValidCronAuthorization("Bearer wrong", "test-secret")).toBe(false);
    expect(isValidCronAuthorization(null, "test-secret")).toBe(false);
  });
});
