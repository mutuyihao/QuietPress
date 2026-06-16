import type { Metadata } from "next";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import { getPublishedPosts, getSiteSettings } from "@/lib/queries";
import { PublicPostIndex } from "@/components/public-post-index";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: {
      absolute: settings?.site_name || DEFAULT_SITE_NAME,
    },
    description: settings?.site_description || DEFAULT_SITE_DESCRIPTION,
  };
}

export default async function HomePage() {
  const [result, settings] = await Promise.all([
    getPublishedPosts(1, 10),
    getSiteSettings(),
  ]);
  return <PublicPostIndex result={result} settings={settings} />;
}
