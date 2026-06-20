"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { createRepositories } from "@/lib/db";
import { slugify, calculateReadingTime } from "@/lib/blog-utils";
import { getUniquePostSlug } from "@/lib/post-slugs";
import {
  createPostSchema,
  updatePostSchema,
  tagNameSchema,
  siteSettingsSchema,
  storageSettingsSchema,
  adminPasswordSchema,
} from "@/lib/validation";
import {
  getStorageProviderEnvironmentStatus,
  resetStorageProvider,
} from "@/lib/storage";
import { logAdminAction } from "@/lib/audit-log";
import {
  revalidatePostContent,
  revalidateSettingsContent,
  revalidateTagContent,
} from "@/lib/blog/revalidation";
import type { PostStatus } from "@/lib/types";
import { logger } from "@/lib/logger";

type ActionResult<T extends object = Record<string, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };
type ActionFailure = Extract<ActionResult, { success: false }>;

async function getAdminRepos() {
  const { supabase, user } = await requireAdmin();
  return { supabase, repos: createRepositories(supabase), userId: user.id };
}

function validationError(errors: { message: string }[]): ActionFailure {
  return {
    success: false,
    error: errors.map((error) => error.message).join("；"),
  };
}

function getActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function runAction<T extends object>(
  operation: () => Promise<ActionResult<T>>,
  fallback: string,
): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch (error) {
    logger.error("server action failed", {
      actionMessage: fallback,
      err: error,
    });
    return { success: false, error: getActionError(error, fallback) };
  }
}

async function auditAdminAction(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) {
  await logAdminAction(supabase, {
    userId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

export async function createPost(formData: FormData) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();

    const raw = {
      title: formData.get("title") as string,
      content_markdown: formData.get("content_markdown") as string,
      excerpt: formData.get("excerpt") as string,
      status: formData.get("status") as PostStatus,
      cover_image_url: formData.get("cover_image_url") as string,
      seo_title: formData.get("seo_title") as string,
      seo_description: formData.get("seo_description") as string,
      canonical_url: formData.get("canonical_url") as string,
      noindex: formData.get("noindex") === "true",
      tags: formData.getAll("tags") as string[],
    };

    const parsed = createPostSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.errors);

    const {
      title,
      content_markdown,
      excerpt,
      status,
      cover_image_url,
      seo_title,
      seo_description,
      canonical_url,
      noindex,
      tags: tagIds,
    } = parsed.data;
    const slug = await getUniquePostSlug(repos.posts, title ?? "");
    const reading_time_minutes = calculateReadingTime(content_markdown);
    const published_at =
      status === "published" ? new Date().toISOString() : null;

    const { id: postId } = await repos.posts.create({
      title,
      slug,
      excerpt: excerpt || null,
      contentMarkdown: content_markdown,
      coverImageUrl: cover_image_url || null,
      status,
      seoTitle: seo_title || null,
      seoDescription: seo_description || null,
      canonicalUrl: canonical_url || null,
      noindex,
      readingTimeMinutes: reading_time_minutes,
      publishedAt: published_at,
      authorId: userId,
      tagIds,
    });

    await repos.posts.saveRevision(postId, {
      title,
      contentMarkdown: content_markdown,
      excerpt: excerpt || null,
      userId,
    });

    await auditAdminAction(supabase, userId, "create", "post", postId, {
      slug,
      status,
    });
    revalidatePostContent(slug);

    return { success: true, postId };
  }, "创建文章失败");
}

export async function updatePost(postId: string, formData: FormData) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();

    const raw = {
      title: formData.get("title") as string,
      content_markdown: formData.get("content_markdown") as string,
      excerpt: formData.get("excerpt") as string,
      status: formData.get("status") as PostStatus,
      cover_image_url: formData.get("cover_image_url") as string,
      seo_title: formData.get("seo_title") as string,
      seo_description: formData.get("seo_description") as string,
      canonical_url: formData.get("canonical_url") as string,
      noindex: formData.get("noindex") === "true",
      tags: formData.getAll("tags") as string[],
    };

    const parsed = updatePostSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.errors);

    const {
      title,
      content_markdown,
      excerpt,
      status,
      cover_image_url,
      seo_title,
      seo_description,
      canonical_url,
      noindex,
      tags: tagIds,
    } = parsed.data;
    const existingPost = await repos.posts.getById(postId);
    if (!existingPost) return { success: false, error: "Post not found" };

    const slug = await getUniquePostSlug(repos.posts, title, postId);
    const slugChanged = slug !== existingPost.slug;
    const reading_time_minutes = calculateReadingTime(content_markdown);

    let published_at = existingPost?.published_at ?? null;
    if (status === "published" && existingPost?.status !== "published") {
      published_at = new Date().toISOString();
    }

    if (slugChanged) {
      await repos.posts.addSlugRedirect(postId, existingPost.slug);
    }

    await repos.posts.update(postId, {
      title,
      slug,
      excerpt: excerpt || null,
      contentMarkdown: content_markdown,
      coverImageUrl: cover_image_url || null,
      status,
      seoTitle: seo_title || null,
      seoDescription: seo_description || null,
      canonicalUrl: canonical_url || null,
      noindex,
      readingTimeMinutes: reading_time_minutes,
      publishedAt: published_at,
    });

    await repos.posts.setTags(postId, tagIds ?? []);
    await repos.posts.saveRevision(postId, {
      title,
      contentMarkdown: content_markdown,
      excerpt: excerpt || null,
      userId,
    });

    await auditAdminAction(supabase, userId, "update", "post", postId, {
      previousSlug: slugChanged ? existingPost.slug : undefined,
      slug,
      status,
    });
    revalidatePostContent(slug, existingPost.slug);

    return { success: true };
  }, "更新文章失败");
}

export async function deletePost(postId: string) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    const { slug } = await repos.posts.delete(postId);

    await auditAdminAction(supabase, userId, "delete", "post", postId, {
      slug,
    });
    revalidatePostContent(slug);

    return { success: true };
  }, "删除文章失败");
}

export async function createTag(name: string) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    const parsed = tagNameSchema.safeParse({ name });
    if (!parsed.success) return validationError(parsed.error.errors);

    const slug = slugify(parsed.data.name);
    const tag = await repos.tags.create(parsed.data.name, slug);

    await auditAdminAction(supabase, userId, "create", "tag", tag.id, {
      slug,
      name: tag.name,
    });
    revalidateTagContent(slug);

    return { success: true, tag };
  }, "创建标签失败");
}

export async function deleteTag(tagId: string) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    const { slug } = await repos.tags.delete(tagId);

    await auditAdminAction(supabase, userId, "delete", "tag", tagId, { slug });
    revalidateTagContent(slug);

    return { success: true };
  }, "删除标签失败");
}

export async function updateTag(tagId: string, name: string) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    const parsed = tagNameSchema.safeParse({ name });
    if (!parsed.success) return validationError(parsed.error.errors);

    const slug = slugify(parsed.data.name);
    const tag = await repos.tags.update(tagId, parsed.data.name, slug);

    await auditAdminAction(supabase, userId, "update", "tag", tagId, {
      slug,
      name: tag.name,
    });
    revalidateTagContent(tag?.slug);

    return { success: true, tag };
  }, "更新标签失败");
}

export async function updateSiteSettings(formData: FormData) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();

    const raw = {
      site_name: formData.get("site_name") as string,
      site_description: formData.get("site_description") as string,
      base_url: formData.get("base_url") as string,
      author_name: formData.get("author_name") as string,
      default_og_image_url: formData.get("default_og_image_url") as string,
      comments_enabled: formData.has("comments_enabled")
        ? formData.get("comments_enabled") === "true"
        : true,
      image_upload_max_size_mb:
        formData.get("image_upload_max_size_mb") ?? "10",
      image_compression_enabled: formData.has("image_compression_enabled")
        ? formData.get("image_compression_enabled") === "true"
        : true,
      image_compression_quality:
        formData.get("image_compression_quality") ?? "82",
      image_max_width: formData.get("image_max_width") ?? "1920",
      image_max_height: formData.get("image_max_height") ?? "1920",
      about_content: formData.get("about_content") as string,
      social_twitter: formData.get("social_twitter") as string,
      social_github: formData.get("social_github") as string,
      social_linkedin: formData.get("social_linkedin") as string,
      social_instagram: formData.get("social_instagram") as string,
    };

    const parsed = siteSettingsSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.errors);

    const {
      site_name,
      site_description,
      base_url,
      author_name,
      default_og_image_url,
      comments_enabled,
      image_upload_max_size_mb,
      image_compression_enabled,
      image_compression_quality,
      image_max_width,
      image_max_height,
      about_content,
      social_twitter,
      social_github,
      social_linkedin,
      social_instagram,
    } = parsed.data;

    const social_links: Record<string, string> = {};
    if (social_twitter) social_links.twitter = social_twitter;
    if (social_github) social_links.github = social_github;
    if (social_linkedin) social_links.linkedin = social_linkedin;
    if (social_instagram) social_links.instagram = social_instagram;

    await repos.settings.upsert({
      site_name,
      site_description,
      base_url: base_url || null,
      author_name,
      default_og_image_url: default_og_image_url || null,
      comments_enabled,
      image_upload_max_size_mb,
      image_compression_enabled,
      image_compression_quality,
      image_max_width,
      image_max_height,
      social_links,
      about_content,
      updated_at: new Date().toISOString(),
    });

    await auditAdminAction(supabase, userId, "update", "site_settings");
    revalidateSettingsContent();

    return { success: true };
  }, "更新站点设置失败");
}

export async function updateStorageSettings(formData: FormData) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();

    const raw = {
      storage_provider: formData.get("storage_provider") ?? "supabase",
      storage_quota_mb: formData.get("storage_quota_mb") ?? "0",
    };

    const parsed = storageSettingsSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.errors);

    const { storage_provider, storage_quota_mb } = parsed.data;
    const envStatus = getStorageProviderEnvironmentStatus(storage_provider);

    if (!envStatus.configured) {
      return {
        success: false,
        error: `当前 ${envStatus.label} 还缺少环境变量：${envStatus.missingEnv.join(", ")}`,
      };
    }

    await repos.settings.upsert({
      storage_provider,
      storage_quota_mb: storage_quota_mb > 0 ? storage_quota_mb : null,
      updated_at: new Date().toISOString(),
    });

    await auditAdminAction(
      supabase,
      userId,
      "update",
      "storage_settings",
      null,
      {
        storageProvider: storage_provider,
        storageQuotaMb: storage_quota_mb,
      },
    );
    resetStorageProvider();
    revalidatePath("/admin/storage");
    revalidatePath("/admin/posts/new");
    revalidatePath("/admin/posts/[id]", "page");
    revalidateTag("settings", "max");

    return { success: true };
  }, "更新存储设置失败");
}

export async function updateAdminPassword(formData: FormData) {
  return runAction(async () => {
    const { supabase, user } = await requireAdmin();

    const parsed = adminPasswordSchema.safeParse({
      current_password: formData.get("current_password"),
      new_password: formData.get("new_password"),
      confirm_password: formData.get("confirm_password"),
    });

    if (!parsed.success) return validationError(parsed.error.errors);

    if (!user.email) {
      return { success: false, error: "当前用户没有邮箱地址。" };
    }

    const { current_password, new_password } = parsed.data;
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: current_password,
      });

    if (signInError || !signInData.user) {
      return { success: false, error: "当前密码不正确。" };
    }

    const nextMetadata = {
      ...(signInData.user.user_metadata || user.user_metadata || {}),
      must_change_password: false,
    };
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
      data: nextMetadata,
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await auditAdminAction(
      supabase,
      user.id,
      "update",
      "admin_password",
      user.id,
    );
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/account");

    return { success: true };
  }, "更新管理员密码失败");
}

export async function batchUpdatePosts(postIds: string[], status: PostStatus) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    if (postIds.length === 0) return { success: true, count: 0 };

    await repos.posts.updateStatus(postIds, status);
    await auditAdminAction(
      supabase,
      userId,
      "batch_update_status",
      "post",
      null,
      {
        postIds,
        status,
        count: postIds.length,
      },
    );
    revalidatePostContent();

    return { success: true, count: postIds.length };
  }, "批量更新文章失败");
}

export async function batchDeletePosts(postIds: string[]) {
  return runAction(async () => {
    const { supabase, repos, userId } = await getAdminRepos();
    if (postIds.length === 0) return { success: true, count: 0 };

    await repos.posts.deleteBatch(postIds);
    await auditAdminAction(supabase, userId, "batch_delete", "post", null, {
      postIds,
      count: postIds.length,
    });
    revalidatePostContent();

    return { success: true, count: postIds.length };
  }, "批量删除文章失败");
}
