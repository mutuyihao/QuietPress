import { describe, expect, it } from "vitest";
import {
  detectImageMime,
  isSafeRemoteMediaUrl,
  mapWithConcurrency,
} from "@/lib/migration/utils";

describe("migration utilities", () => {
  it("rejects localhost and private network media URLs", () => {
    expect(isSafeRemoteMediaUrl("https://example.com/image.png")).toBe(true);
    expect(isSafeRemoteMediaUrl("http://example.com/image.png")).toBe(true);
    expect(isSafeRemoteMediaUrl("https://localhost/image.png")).toBe(false);
    expect(isSafeRemoteMediaUrl("https://127.0.0.1/image.png")).toBe(false);
    expect(isSafeRemoteMediaUrl("https://10.0.0.1/image.png")).toBe(false);
    expect(isSafeRemoteMediaUrl("https://192.168.1.10/image.png")).toBe(false);
    expect(isSafeRemoteMediaUrl("ftp://example.com/image.png")).toBe(false);
  });

  it("detects supported image magic bytes", () => {
    expect(
      detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00])),
    ).toBe(null);
    expect(
      detectImageMime(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x00,
        ]),
      ),
    ).toBe("image/png");
    expect(detectImageMime(Buffer.from("RIFF0000WEBP0000", "ascii"))).toBe(
      "image/webp",
    );
  });

  it("maps with bounded concurrency while preserving result order", async () => {
    let active = 0;
    let maxActive = 0;

    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (item) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return item * 2;
      },
    );

    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
