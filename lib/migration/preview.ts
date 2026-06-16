import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MigrationPreview,
  QuietPressExportV1,
} from "@/lib/migration/types";
import { isSafeRemoteMediaUrl } from "@/lib/migration/utils";

interface ExistingPostRow {
  slug: string;
  title: string;
}

interface ExistingTagRow {
  slug: string;
  name: string;
}

async function loadExistingPosts(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Map<string, ExistingPostRow>> {
  if (slugs.length === 0) return new Map();

  const { data, error } = await supabase
    .from("posts")
    .select("slug, title")
    .in("slug", slugs);

  if (error) throw new Error(error.message);

  return new Map(
    (data || []).map((row) => [row.slug, { slug: row.slug, title: row.title }]),
  );
}

async function loadExistingTags(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Map<string, ExistingTagRow>> {
  if (slugs.length === 0) return new Map();

  const { data, error } = await supabase
    .from("tags")
    .select("slug, name")
    .in("slug", slugs);

  if (error) throw new Error(error.message);

  return new Map(
    (data || []).map((row) => [row.slug, { slug: row.slug, name: row.name }]),
  );
}

export async function createMigrationPreview(
  supabase: SupabaseClient,
  migrationPackage: QuietPressExportV1,
): Promise<MigrationPreview> {
  const postSlugs = Array.from(
    new Set(migrationPackage.posts.map((post) => post.slug)),
  );
  const tagSlugs = Array.from(
    new Set(migrationPackage.tags.map((tag) => tag.slug)),
  );

  const [existingPosts, existingTags] = await Promise.all([
    loadExistingPosts(supabase, postSlugs),
    loadExistingTags(supabase, tagSlugs),
  ]);

  const postConflicts = migrationPackage.posts
    .filter((post) => existingPosts.has(post.slug))
    .map((post) => ({
      slug: post.slug,
      importedTitle: post.title,
      existingTitle: existingPosts.get(post.slug)?.title || "",
    }));

  const tagConflicts = migrationPackage.tags
    .filter((tag) => {
      const existing = existingTags.get(tag.slug);
      return existing && existing.name !== tag.name;
    })
    .map((tag) => ({
      slug: tag.slug,
      importedName: tag.name,
      existingName: existingTags.get(tag.slug)?.name || "",
    }));

  const invalidMediaUrls = migrationPackage.media.filter(
    (item) => !isSafeRemoteMediaUrl(item.url),
  ).length;
  const warnings: string[] = [];

  if (invalidMediaUrls > 0) {
    warnings.push(
      `${invalidMediaUrls} media URL(s) are not safe public HTTP(S) URLs and will not be re-imported.`,
    );
  }

  if (!migrationPackage.settings) {
    warnings.push("This package does not include site settings.");
  }

  if (migrationPackage.media.length === 0) {
    warnings.push("This package does not include media references.");
  }

  return {
    meta: migrationPackage.meta,
    summary: {
      posts: migrationPackage.posts.length,
      tags: migrationPackage.tags.length,
      media: migrationPackage.media.length,
      settings: Boolean(migrationPackage.settings),
      invalidMediaUrls,
    },
    conflicts: {
      posts: postConflicts,
      tags: tagConflicts,
    },
    warnings,
  };
}
