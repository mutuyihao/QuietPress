import { revalidatePath, revalidateTag } from "next/cache";
import { getPostCacheTag } from "@/lib/blog/cache-tags";
import { postPath, tagPath } from "@/lib/route-segments";

export function revalidateAllContent() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/posts/[id]", "page");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/migration");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/migration");
  revalidatePath("/about");
  revalidatePath("/page/[pageNumber]", "page");
  revalidatePath("/tags");
  revalidatePath("/posts/[slug]", "page");
  revalidatePath("/rss.xml");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidateTag("posts", "max");
  revalidateTag("tags", "max");
  revalidateTag("settings", "max");
}

export function revalidatePostContent(
  ...slugs: Array<string | null | undefined>
) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/page/[pageNumber]", "page");
  revalidatePath("/rss.xml");
  revalidatePath("/sitemap.xml");
  revalidateTag("posts", "max");

  const uniqueSlugs = Array.from(
    new Set(slugs.filter((slug): slug is string => Boolean(slug))),
  );

  for (const slug of uniqueSlugs) {
    revalidatePath(postPath(slug));
    revalidateTag(getPostCacheTag(slug), "max");
  }
}

export function revalidateTagContent(
  ...slugs: Array<string | null | undefined>
) {
  revalidatePath("/admin/tags");
  revalidatePath("/tags");
  revalidateTag("tags", "max");
  revalidateTag("posts", "max");

  for (const slug of slugs) {
    if (slug) revalidatePath(tagPath(slug));
  }
}

export function revalidateCommentContent(slug?: string | null) {
  revalidatePath("/admin/comments");
  if (slug) revalidatePath(postPath(slug));
}

export function revalidateSettingsContent() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/page/[pageNumber]", "page");
  revalidatePath("/rss.xml");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidatePath("/admin/settings");
  revalidateTag("settings", "max");
}
