import { getDefaultSiteUrl, normalizeSiteUrl } from "@/lib/env";
import type { MetadataRoute } from "next";

export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = normalizeSiteUrl(getDefaultSiteUrl());

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/auth/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
