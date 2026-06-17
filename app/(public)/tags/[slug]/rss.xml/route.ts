import { getPostsByTag, getSiteSettings, getTagBySlug } from "@/lib/queries";
import { getDefaultSiteUrl, normalizeSiteUrl } from "@/lib/env";
import { DEFAULT_LOCALE } from "@/lib/date-format";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import { postUrl, tagUrl } from "@/lib/route-segments";
import { withApiRoute } from "@/lib/api-response";
import { escapeXml } from "@/lib/rss";

export const revalidate = 300;

interface TagRssRouteContext {
  params: Promise<{ slug: string }>;
}

export const GET = withApiRoute<Request, TagRssRouteContext>(
  "tag-rss.GET",
  async (_request, { params }) => {
    const { slug } = await params;
    const [tag, settings] = await Promise.all([
      getTagBySlug(slug),
      getSiteSettings(),
    ]);

    if (!tag) {
      return new Response("Not Found", { status: 404 });
    }

    const posts = await getPostsByTag(tag.slug);
    const baseUrl = normalizeSiteUrl(settings?.base_url || getDefaultSiteUrl());
    const siteName = settings?.site_name || DEFAULT_SITE_NAME;
    const siteDescription =
      settings?.site_description || DEFAULT_SITE_DESCRIPTION;
    const tagPageUrl = tagUrl(baseUrl, tag.slug);
    const feedUrl = `${tagPageUrl}/rss.xml`;
    const feedTitle = `${tag.name} - ${siteName}`;
    const feedDescription = `${siteDescription} 标签：${tag.name}`;

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(tagPageUrl)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>${escapeXml(DEFAULT_LOCALE)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    ${posts
      .map(
        (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl(baseUrl, post.slug))}</link>
      <guid isPermaLink="true">${escapeXml(postUrl(baseUrl, post.slug))}</guid>
      <description>${escapeXml(post.excerpt || post.title)}</description>
      <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
      ${post.tags.map((postTag) => `<category>${escapeXml(postTag.name)}</category>`).join("\n      ")}
    </item>`,
      )
      .join("")}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  },
);
