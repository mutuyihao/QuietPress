import { describe, expect, it } from "vitest";
import { getOgFonts, OG_FONT_FAMILY } from "@/lib/og-fonts";

describe("Open Graph fonts", () => {
  it("loads local CJK fonts for ImageResponse", async () => {
    const fonts = await getOgFonts();

    expect(fonts).toHaveLength(2);
    expect(fonts.map((font) => font.name)).toEqual([
      OG_FONT_FAMILY,
      OG_FONT_FAMILY,
    ]);
    expect(fonts.map((font) => font.weight).sort()).toEqual([400, 700]);
    expect(fonts.every((font) => font.data.byteLength > 1_000_000)).toBe(true);
  });
});
