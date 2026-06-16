import { createRepositories } from "@/lib/db";
import { getDefaultSiteUrl, normalizeSiteUrl } from "@/lib/env";
import { getActiveStorage } from "@/lib/storage/active";
import type {
  QuietPressExportMedia,
  QuietPressExportV1,
} from "@/lib/migration/types";
import { QUIETPRESS_EXPORT_VERSION } from "@/lib/migration/types";
import {
  addMediaItem,
  isHttpUrl,
  parseMarkdownImageUrls,
} from "@/lib/migration/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

function toNullableIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSocialLinks(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

export async function createQuietPressExport(
  supabase: SupabaseClient,
): Promise<QuietPressExportV1> {
  const repos = createRepositories(supabase);
  const [posts, tags, settings] = await Promise.all([
    repos.posts.listAll(),
    repos.tags.list(),
    repos.settings.get(),
  ]);

  const mediaByUrl = new Map<string, QuietPressExportMedia>();

  if (settings?.default_og_image_url) {
    addMediaItem(mediaByUrl, {
      url: settings.default_og_image_url,
      source: "settings_og",
      post_slug: null,
      path: null,
      name: null,
      size: null,
      content_type: null,
      last_modified: null,
    });
  }

  for (const post of posts) {
    if (post.cover_image_url) {
      addMediaItem(mediaByUrl, {
        url: post.cover_image_url,
        source: "post_cover",
        post_slug: post.slug,
        path: null,
        name: null,
        size: null,
        content_type: null,
        last_modified: null,
      });
    }

    for (const url of parseMarkdownImageUrls(post.content_markdown)) {
      addMediaItem(mediaByUrl, {
        url,
        source: "post_content",
        post_slug: post.slug,
        path: null,
        name: null,
        size: null,
        content_type: null,
        last_modified: null,
      });
    }
  }

  try {
    const { provider } = await getActiveStorage(supabase);
    if (provider.listFiles) {
      const files = await provider.listFiles();
      for (const file of files) {
        addMediaItem(mediaByUrl, {
          url: file.url,
          source: "library",
          post_slug: null,
          path: file.path,
          name: file.name,
          size: file.size,
          content_type: file.contentType,
          last_modified: toNullableIso(file.lastModified),
        });
      }
    }
  } catch {
    // Export should still work when the storage backend cannot be listed.
  }

  const exportedSettings = settings
    ? {
        site_name: settings.site_name,
        site_description: settings.site_description,
        base_url:
          settings.base_url && isHttpUrl(settings.base_url)
            ? normalizeSiteUrl(settings.base_url)
            : null,
        author_name: settings.author_name,
        default_og_image_url: settings.default_og_image_url,
        comments_enabled: settings.comments_enabled,
        image_upload_max_size_mb: settings.image_upload_max_size_mb,
        image_compression_enabled: settings.image_compression_enabled,
        image_compression_quality: settings.image_compression_quality,
        image_max_width: settings.image_max_width,
        image_max_height: settings.image_max_height,
        social_links: normalizeSocialLinks(settings.social_links),
        about_content: settings.about_content,
      }
    : null;

  const exportedPosts = posts.map((post) => ({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content_markdown: post.content_markdown,
    cover_image_url: post.cover_image_url,
    status: post.status,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    canonical_url: post.canonical_url,
    noindex: post.noindex,
    reading_time_minutes: post.reading_time_minutes,
    views_count: post.views_count,
    published_at: toNullableIso(post.published_at),
    created_at: toNullableIso(post.created_at),
    updated_at: toNullableIso(post.updated_at),
    tag_slugs: post.tags.map((tag) => tag.slug),
  }));

  const media = Array.from(mediaByUrl.values());

  return {
    meta: {
      app: "quietpress",
      version: QUIETPRESS_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      source_url:
        exportedSettings?.base_url || normalizeSiteUrl(getDefaultSiteUrl()),
      counts: {
        posts: exportedPosts.length,
        tags: tags.length,
        media: media.length,
      },
    },
    settings: exportedSettings,
    tags: tags.map((tag) => ({
      name: tag.name,
      slug: tag.slug,
      created_at: toNullableIso(tag.created_at),
    })),
    posts: exportedPosts,
    media,
  };
}
