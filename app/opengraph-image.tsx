import { ImageResponse } from "next/og";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import { getSiteSettings } from "@/lib/queries";
import { getOgFonts, OG_FONT_FAMILY } from "@/lib/og-fonts";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const settings = await getSiteSettings();
  const title = settings?.site_name || DEFAULT_SITE_NAME;
  const description = settings?.site_description || DEFAULT_SITE_DESCRIPTION;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #f8f5ef 0%, #ebe3d5 55%, #d9cbb8 100%)",
        color: "#201b16",
        padding: 72,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      <div
        style={{
          fontSize: 28,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontWeight: 700,
          color: "#75695d",
        }}
      >
        QuietPress
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 76,
            lineHeight: 0.95,
            letterSpacing: -3,
            fontWeight: 700,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 820,
            fontSize: 32,
            lineHeight: 1.35,
            color: "#5f554c",
          }}
        >
          {description}
        </p>
      </div>
      <div style={{ height: 2, width: 220, background: "#201b16" }} />
    </div>,
    {
      ...size,
      fonts: await getOgFonts(),
    },
  );
}
