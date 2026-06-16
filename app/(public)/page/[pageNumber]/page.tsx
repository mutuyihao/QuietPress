import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicPostIndex } from "@/components/public-post-index";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import { getPublishedPosts, getSiteSettings } from "@/lib/queries";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ pageNumber: string }>;
}

function parsePageNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

export async function generateStaticParams() {
  const result = await getPublishedPosts(1, 10);
  return Array.from(
    { length: Math.max(0, result.totalPages - 1) },
    (_, index) => ({
      pageNumber: String(index + 2),
    }),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { pageNumber } = await params;
  const page = parsePageNumber(pageNumber);

  if (!page) return { title: "Page Not Found" };

  const [settings, result] = await Promise.all([
    getSiteSettings(),
    getPublishedPosts(page, 10),
  ]);
  const siteName = settings?.site_name || DEFAULT_SITE_NAME;
  const description = settings?.site_description || DEFAULT_SITE_DESCRIPTION;

  return {
    title: `${siteName} - 第 ${page} 页`,
    description,
    alternates: {
      canonical: `/page/${page}`,
    },
    pagination: {
      previous: page > 2 ? `/page/${page - 1}` : "/",
      next: result.totalPages > page ? `/page/${page + 1}` : null,
    },
  };
}

export default async function PaginatedHomePage({ params }: PageProps) {
  const { pageNumber } = await params;
  const page = parsePageNumber(pageNumber);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect("/");
  }

  const [result, settings] = await Promise.all([
    getPublishedPosts(page, 10),
    getSiteSettings(),
  ]);

  if (result.totalPages > 0 && page > result.totalPages) {
    notFound();
  }

  return <PublicPostIndex result={result} settings={settings} />;
}
