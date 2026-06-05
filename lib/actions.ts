'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createRepositories } from '@/lib/db'
import { createPostSlug, slugify, calculateReadingTime } from '@/lib/blog-utils'
import { postPath } from '@/lib/route-segments'
import { createPostSchema, updatePostSchema, tagNameSchema, siteSettingsSchema, storageSettingsSchema, adminPasswordSchema } from '@/lib/validation'
import { getStorageProviderEnvironmentStatus, resetStorageProvider } from '@/lib/storage'
import type { PostStatus } from '@/lib/types'
import type { Repositories } from '@/lib/db'

async function getAdminRepos(): Promise<{ repos: Repositories; userId: string }> {
  const { supabase, user } = await requireAdmin()
  return { repos: createRepositories(supabase), userId: user.id }
}

export async function createPost(formData: FormData) {
  const { repos, userId } = await getAdminRepos()

  const raw = {
    title: formData.get('title') as string,
    content_markdown: formData.get('content_markdown') as string,
    excerpt: formData.get('excerpt') as string,
    status: formData.get('status') as PostStatus,
    cover_image_url: formData.get('cover_image_url') as string,
    seo_title: formData.get('seo_title') as string,
    seo_description: formData.get('seo_description') as string,
    canonical_url: formData.get('canonical_url') as string,
    noindex: formData.get('noindex') === 'true',
    tags: formData.getAll('tags') as string[],
  }

  const parsed = createPostSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('；') }
  }

  const { title, content_markdown, excerpt, status, cover_image_url, seo_title, seo_description, canonical_url, noindex, tags: tagIds } = parsed.data

  const slug = createPostSlug(title ?? '')
  const reading_time_minutes = calculateReadingTime(content_markdown)
  const published_at = status === 'published' ? new Date().toISOString() : null

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
  })

  await repos.posts.saveRevision(postId, {
    title,
    contentMarkdown: content_markdown,
    excerpt: excerpt || null,
    userId,
  })

  revalidatePath('/')
  revalidatePath('/admin')
  revalidateTag('posts', 'max')

  return { success: true, postId }
}

export async function updatePost(postId: string, formData: FormData) {
  const { repos, userId } = await getAdminRepos()

  const raw = {
    title: formData.get('title') as string,
    content_markdown: formData.get('content_markdown') as string,
    excerpt: formData.get('excerpt') as string,
    status: formData.get('status') as PostStatus,
    cover_image_url: formData.get('cover_image_url') as string,
    seo_title: formData.get('seo_title') as string,
    seo_description: formData.get('seo_description') as string,
    canonical_url: formData.get('canonical_url') as string,
    noindex: formData.get('noindex') === 'true',
    tags: formData.getAll('tags') as string[],
  }

  const parsed = updatePostSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('；') }
  }

  const { title, content_markdown, excerpt, status, cover_image_url, seo_title, seo_description, canonical_url, noindex, tags: tagIds } = parsed.data

  const existingPost = await repos.posts.getById(postId)

  const slug = createPostSlug(title)
  const reading_time_minutes = calculateReadingTime(content_markdown)

  let published_at = existingPost?.published_at ?? null
  if (status === 'published' && existingPost?.status !== 'published') {
    published_at = new Date().toISOString()
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
  })

  await repos.posts.setTags(postId, tagIds ?? [])

  // Save revision
  await repos.posts.saveRevision(postId, {
    title,
    contentMarkdown: content_markdown,
    excerpt: excerpt || null,
    userId,
  })

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(postPath(slug))
  if (existingPost?.slug && existingPost.slug !== slug) {
    revalidatePath(postPath(existingPost.slug))
  }
  revalidateTag('posts', 'max')

  return { success: true }
}

export async function deletePost(postId: string) {
  const { repos } = await getAdminRepos()

  const { slug } = await repos.posts.delete(postId)

  revalidatePath('/')
  revalidatePath('/admin')
  if (slug) {
    revalidatePath(postPath(slug))
  }
  revalidateTag('posts', 'max')

  return { success: true }
}

export async function createTag(name: string) {
  const { repos } = await getAdminRepos()

  const parsed = tagNameSchema.safeParse({ name })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('；') }
  }

  const slug = slugify(parsed.data.name)
  const tag = await repos.tags.create(parsed.data.name, slug)

  revalidatePath('/admin/tags')
  revalidatePath('/tags')
  revalidateTag('tags', 'max')
  revalidateTag('posts', 'max')

  return { success: true, tag }
}

export async function deleteTag(tagId: string) {
  const { repos } = await getAdminRepos()

  const { slug } = await repos.tags.delete(tagId)

  revalidatePath('/admin/tags')
  revalidatePath('/tags')
  if (slug) {
    revalidatePath(`/tags/${slug}`)
  }
  revalidateTag('tags', 'max')
  revalidateTag('posts', 'max')

  return { success: true }
}

export async function updateTag(tagId: string, name: string) {
  const { repos } = await getAdminRepos()

  const parsed = tagNameSchema.safeParse({ name })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('；') }
  }

  const slug = slugify(parsed.data.name)
  const tag = await repos.tags.update(tagId, parsed.data.name, slug)

  revalidatePath('/admin/tags')
  revalidatePath('/tags')
  if (tag?.slug) {
    revalidatePath(`/tags/${tag.slug}`)
  }
  revalidateTag('tags', 'max')
  revalidateTag('posts', 'max')

  return { success: true, tag }
}

export async function updateSiteSettings(formData: FormData) {
  const { repos } = await getAdminRepos()

  const raw = {
    site_name: formData.get('site_name') as string,
    site_description: formData.get('site_description') as string,
    base_url: formData.get('base_url') as string,
    author_name: formData.get('author_name') as string,
    default_og_image_url: formData.get('default_og_image_url') as string,
    comments_enabled: formData.has('comments_enabled') ? formData.get('comments_enabled') === 'true' : true,
    image_upload_max_size_mb: formData.get('image_upload_max_size_mb') ?? '10',
    image_compression_enabled: formData.has('image_compression_enabled') ? formData.get('image_compression_enabled') === 'true' : true,
    image_compression_quality: formData.get('image_compression_quality') ?? '82',
    image_max_width: formData.get('image_max_width') ?? '1920',
    image_max_height: formData.get('image_max_height') ?? '1920',
    about_content: formData.get('about_content') as string,
    social_twitter: formData.get('social_twitter') as string,
    social_github: formData.get('social_github') as string,
    social_linkedin: formData.get('social_linkedin') as string,
    social_instagram: formData.get('social_instagram') as string,
  }

  const parsed = siteSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('；') }
  }

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
  } = parsed.data

  const social_links: Record<string, string> = {}
  if (social_twitter) social_links.twitter = social_twitter
  if (social_github) social_links.github = social_github
  if (social_linkedin) social_links.linkedin = social_linkedin
  if (social_instagram) social_links.instagram = social_instagram

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
  })

  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/about')
  revalidatePath('/posts/[slug]', 'page')
  revalidatePath('/rss.xml')
  revalidatePath('/sitemap.xml')
  revalidatePath('/robots.txt')
  revalidatePath('/admin/settings')
  revalidateTag('settings', 'max')

  return { success: true }
}

export async function updateStorageSettings(formData: FormData) {
  const { repos } = await getAdminRepos()

  const raw = {
    storage_provider: formData.get('storage_provider') ?? 'supabase',
    storage_quota_mb: formData.get('storage_quota_mb') ?? '0',
  }

  const parsed = storageSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('，') }
  }

  const { storage_provider, storage_quota_mb } = parsed.data
  const envStatus = getStorageProviderEnvironmentStatus(storage_provider)

  if (!envStatus.configured) {
    return {
      success: false,
      error: `当前 ${envStatus.label} 还缺少环境变量：${envStatus.missingEnv.join(', ')}`,
    }
  }

  await repos.settings.upsert({
    storage_provider,
    storage_quota_mb: storage_quota_mb > 0 ? storage_quota_mb : null,
    updated_at: new Date().toISOString(),
  })

  resetStorageProvider()
  revalidatePath('/admin/storage')
  revalidatePath('/admin/posts/new')
  revalidatePath('/admin/posts/[id]', 'page')
  revalidateTag('settings', 'max')

  return { success: true }
}

export async function updateAdminPassword(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const parsed = adminPasswordSchema.safeParse({
    current_password: formData.get('current_password'),
    new_password: formData.get('new_password'),
    confirm_password: formData.get('confirm_password'),
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join('; ') }
  }

  if (!user.email) {
    return { success: false, error: '当前用户没有邮箱地址。' }
  }

  const { current_password, new_password } = parsed.data
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  })

  if (signInError || !signInData.user) {
    return { success: false, error: '当前密码不正确。' }
  }

  const nextMetadata = {
    ...(signInData.user.user_metadata || user.user_metadata || {}),
    must_change_password: false,
  }
  const { error: updateError } = await supabase.auth.updateUser({
    password: new_password,
    data: nextMetadata,
  })

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/account')

  return { success: true }
}

export async function batchUpdatePosts(postIds: string[], status: PostStatus) {
  const { repos } = await getAdminRepos()

  await repos.posts.updateStatus(postIds, status)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidateTag('posts', 'max')

  return { success: true, count: postIds.length }
}

export async function batchDeletePosts(postIds: string[]) {
  const { repos } = await getAdminRepos()

  await repos.posts.deleteBatch(postIds)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidateTag('posts', 'max')

  return { success: true, count: postIds.length }
}
