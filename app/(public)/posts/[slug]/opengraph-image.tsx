import { ImageResponse } from "next/og";
import { DEFAULT_SITE_NAME } from "@/lib/site-defaults";
import { getPostBySlug, getSiteSettings } from "@/lib/queries";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface OpenGraphImageProps {
  params: Promise<{ slug: string }>;
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    getPostBySlug(slug),
    getSiteSettings(),
  ]);
  const siteName = settings?.site_name || DEFAULT_SITE_NAME;
  const title = post?.title || "文章未找到";
  const excerpt = post?.seo_description || post?.excerpt || siteName;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(145deg, #171411 0%, #2a211b 52%, #806d58 100%)",
        color: "#fbf7ef",
        padding: 72,
        fontFamily: "serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 24,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: "#d9cbb8",
        }}
      >
        <span>{siteName}</span>
        <span>Article</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 940,
            fontSize: 68,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 780,
            fontSize: 28,
            lineHeight: 1.35,
            color: "#d9cbb8",
          }}
        >
          {excerpt}
        </p>
      </div>
      <div style={{ height: 2, width: 260, background: "#fbf7ef" }} />
    </div>,
    size,
  );
}
