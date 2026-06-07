import { randomUUID } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateReadingTime, createPostSlug, slugify } from '@/lib/blog-utils'
import { createRepositories } from '@/lib/db'
import { getImageUploadConfig, getImageUploadMaxSizeBytes } from '@/lib/image-upload-config'
import { importQuietPressPackage } from '@/lib/migration/import'
import { createMigrationPreview } from '@/lib/migration/preview'
import { createQuietPressExport } from '@/lib/migration/export'
import { detectImageMime, getAllowedImportImageMimeTypes, getImageExtension, isSafeRemoteMediaUrl } from '@/lib/migration/utils'
import type { MigrationImportOptions, QuietPressExportV1 } from '@/lib/migration/types'
import { postPath } from '@/lib/route-segments'
import { getActiveStorage } from '@/lib/storage/active'
import type { PostStatus, PostWithTags, SiteSettings, Tag } from '@/lib/types'

export interface BlogServiceContext {
  supabase: SupabaseClient
  userId: string
}

export interface CreatePostDraftInput {
  title: string
  content_markdown: string
  excerpt?: string | null
  cover_image_url?: string | null
  seo_title?: string | null
  seo_description?: string | null
  canonical_url?: string | null
  noindex?: boolean
  tag_slugs?: string[]
}

export interface UpdatePostInput {
  id: string
  title?: string
  content_markdown?: string
  excerpt?: string | null
  cover_image_url?: string | null
  seo_title?: string | null
  seo_description?: string | null
  canonical_url?: string | null
  noindex?: boolean
  tag_slugs?: string[]
}

export interface UpdateSiteSettingsInput {
  site_name?: string
  site_description?: string
  base_url?: string | null
  author_name?: string
  default_og_image_url?: string | null
  comments_enabled?: boolean
  image_upload_max_size_mb?: number
  image_compression_enabled?: boolean
  image_compression_quality?: number
  image_max_width?: number
  image_max_height?: number
  about_content?: string
  social_links?: Record<string, string>
}

function revalidateContent() {
  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/admin/posts/[id]', 'page')
  revalidatePath('/admin/tags')
  revalidatePath('/admin/comments')
  revalidatePath('/admin/settings')
  revalidatePath('/about')
  revalidatePath('/tags')
  revalidatePath('/posts/[slug]', 'page')
  revalidatePath('/rss.xml')
  revalidatePath('/sitemap.xml')
  revalidatePath('/robots.txt')
  revalidateTag('posts', 'max')
  revalidateTag('tags', 'max')
  revalidateTag('settings', 'max')
}

function serializePost(post: PostWithTags) {
  return {
    id: post.id,
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
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
    tags: post.tags,
  }
}

async function getAllPosts(context: BlogServiceContext): Promise<PostWithTags[]> {
  return createRepositories(context.supabase).posts.listAll()
}

async function getAllTags(context: BlogServiceContext): Promise<Tag[]> {
  return createRepositories(context.supabase).tags.list()
}

async function resolveTagIds(context: BlogServiceContext, slugs: string[] | undefined): Promise<string[]> {
  if (!slugs || slugs.length === 0) return []
  const requested = new Set(slugs.map((slug) => slug.trim()).filter(Boolean))
  const tags = await getAllTags(context)
  return tags.filter((tag) => requested.has(tag.slug)).map((tag) => tag.id)
}

async function getUniquePostSlug(context: BlogServiceContext, base: string, excludingId?: string): Promise<string> {
  const posts = await getAllPosts(context)
  const existing = new Set(posts.filter((post) => post.id !== excludingId).map((post) => post.slug))
  let slug = base || 'untitled'
  let index = 2
  while (existing.has(slug)) {
    slug = `${base || 'untitled'}-${index}`
    index += 1
  }
  return slug
}

export async function searchBlogPosts(
  context: BlogServiceContext,
  input: { query?: string; status?: PostStatus | 'all'; limit?: number },
) {
  const query = (input.query || '').trim().toLowerCase()
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const posts = await getAllPosts(context)

  return posts
    .filter((post) => input.status && input.status !== 'all' ? post.status === input.status : true)
    .filter((post) => {
      if (!query) return true
      return [
        post.title,
        post.slug,
        post.excerpt || '',
        post.content_markdown,
      ].some((value) => value.toLowerCase().includes(query))
    })
    .slice(0, limit)
    .map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      status: post.status,
      published_at: post.published_at,
      updated_at: post.updated_at,
      tags: post.tags,
    }))
}

export async function getBlogPost(
  context: BlogServiceContext,
  input: { id?: string; slug?: string },
) {
  const repos = createRepositories(context.supabase)
  const post = input.id
    ? await repos.posts.getById(input.id)
    : (await getAllPosts(context)).find((candidate) => candidate.slug === input.slug) || null

  return post ? serializePost(post) : null
}

export async function createBlogPostDraft(context: BlogServiceContext, input: CreatePostDraftInput) {
  const repos = createRepositories(context.supabase)
  const tagIds = await resolveTagIds(context, input.tag_slugs)
  const slug = await getUniquePostSlug(context, createPostSlug(input.title))
  const readingTime = calculateReadingTime(input.content_markdown)

  const { id } = await repos.posts.create({
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    contentMarkdown: input.content_markdown,
    coverImageUrl: input.cover_image_url || null,
    status: 'draft',
    seoTitle: input.seo_title || null,
    seoDescription: input.seo_description || null,
    canonicalUrl: input.canonical_url || null,
    noindex: input.noindex ?? false,
    readingTimeMinutes: readingTime,
    publishedAt: null,
    authorId: context.userId,
    tagIds,
  })

  await repos.posts.saveRevision(id, {
    title: input.title,
    contentMarkdown: input.content_markdown,
    excerpt: input.excerpt || null,
    userId: context.userId,
  })

  revalidateContent()
  return getBlogPost(context, { id })
}

export async function updateBlogPost(context: BlogServiceContext, input: UpdatePostInput) {
  const repos = createRepositories(context.supabase)
  const existing = await repos.posts.getById(input.id)
  if (!existing) throw new Error('Post not found')

  const nextTitle = input.title ?? existing.title
  const nextContent = input.content_markdown ?? existing.content_markdown
  const update: Parameters<typeof repos.posts.update>[1] = {}

  if (input.title !== undefined) {
    update.title = input.title
    update.slug = await getUniquePostSlug(context, createPostSlug(input.title), input.id)
  }
  if (input.content_markdown !== undefined) {
    update.contentMarkdown = input.content_markdown
    update.readingTimeMinutes = calculateReadingTime(input.content_markdown)
  }
  if (input.excerpt !== undefined) update.excerpt = input.excerpt || null
  if (input.cover_image_url !== undefined) update.coverImageUrl = input.cover_image_url || null
  if (input.seo_title !== undefined) update.seoTitle = input.seo_title || null
  if (input.seo_description !== undefined) update.seoDescription = input.seo_description || null
  if (input.canonical_url !== undefined) update.canonicalUrl = input.canonical_url || null
  if (input.noindex !== undefined) update.noindex = input.noindex

  await repos.posts.update(input.id, update)
  if (input.tag_slugs) {
    await repos.posts.setTags(input.id, await resolveTagIds(context, input.tag_slugs))
  }

  await repos.posts.saveRevision(input.id, {
    title: nextTitle,
    contentMarkdown: nextContent,
    excerpt: input.excerpt !== undefined ? input.excerpt || null : existing.excerpt,
    userId: context.userId,
  })

  revalidatePath(postPath(existing.slug))
  revalidateContent()
  return getBlogPost(context, { id: input.id })
}

export async function setBlogPostStatus(context: BlogServiceContext, id: string, status: PostStatus) {
  const repos = createRepositories(context.supabase)
  const existing = await repos.posts.getById(id)
  if (!existing) throw new Error('Post not found')

  await repos.posts.update(id, {
    status,
    publishedAt: status === 'published'
      ? existing.published_at || new Date().toISOString()
      : existing.published_at,
  })

  revalidatePath(postPath(existing.slug))
  revalidateContent()
  return getBlogPost(context, { id })
}

export async function deleteBlogPost(context: BlogServiceContext, id: string) {
  const repos = createRepositories(context.supabase)
  const { slug } = await repos.posts.delete(id)
  if (slug) revalidatePath(postPath(slug))
  revalidateContent()
  return { id, deleted: true }
}

export async function manageBlogTag(
  context: BlogServiceContext,
  input: { action: 'create' | 'update' | 'delete'; id?: string; name?: string },
) {
  const repos = createRepositories(context.supabase)

  if (input.action === 'create') {
    if (!input.name) throw new Error('Tag name is required')
    const tag = await repos.tags.create(input.name, slugify(input.name))
    revalidateContent()
    return tag
  }

  if (input.action === 'update') {
    if (!input.id || !input.name) throw new Error('Tag id and name are required')
    const tag = await repos.tags.update(input.id, input.name, slugify(input.name))
    revalidateContent()
    return tag
  }

  if (!input.id) throw new Error('Tag id is required')
  const result = await repos.tags.delete(input.id)
  revalidateContent()
  return { id: input.id, deleted: true, slug: result.slug }
}

export async function listBlogTags(context: BlogServiceContext) {
  return getAllTags(context)
}

export async function moderateBlogComment(
  context: BlogServiceContext,
  input: { id: string; action: 'approve' | 'spam' | 'delete' },
) {
  if (input.action === 'delete') {
    const { error } = await context.supabase.from('comments').delete().eq('id', input.id)
    if (error) throw new Error(error.message)
    revalidateContent()
    return { id: input.id, deleted: true }
  }

  const status = input.action === 'approve' ? 'approved' : 'spam'
  const { data, error } = await context.supabase
    .from('comments')
    .update({ status })
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  revalidateContent()
  return data
}

export async function listBlogComments(
  context: BlogServiceContext,
  input: { status?: 'pending' | 'approved' | 'spam'; limit?: number },
) {
  let query = context.supabase
    .from('comments')
    .select('*, posts(title, slug)')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 100))

  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export async function getBlogSettings(context: BlogServiceContext): Promise<SiteSettings | null> {
  return createRepositories(context.supabase).settings.get()
}

export async function updateBlogSettings(context: BlogServiceContext, input: UpdateSiteSettingsInput) {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) payload[key] = value
  }
  if (Object.keys(payload).length === 0) throw new Error('No settings provided')

  payload.updated_at = new Date().toISOString()
  await createRepositories(context.supabase).settings.upsert(payload)
  revalidateContent()
  return getBlogSettings(context)
}

async function fetchRemoteImage(url: string, maxSizeBytes: number) {
  if (!isSafeRemoteMediaUrl(url)) {
    throw new Error('URL must be a public HTTP(S) image URL')
  }

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxSizeBytes) {
    throw new Error('Remote image is larger than the configured limit')
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > maxSizeBytes) {
    throw new Error('Remote image is larger than the configured limit')
  }

  const contentType = detectImageMime(buffer)
  if (!contentType || !getAllowedImportImageMimeTypes().includes(contentType)) {
    throw new Error('Remote file is not a supported image')
  }

  return { buffer, contentType }
}

export async function uploadBlogMediaFromUrl(
  context: BlogServiceContext,
  input: { url: string; folder?: string },
) {
  const activeStorage = await getActiveStorage(context.supabase)
  const uploadConfig = getImageUploadConfig(activeStorage.settings)
  const maxSizeBytes = getImageUploadMaxSizeBytes(uploadConfig)
  const { buffer, contentType } = await fetchRemoteImage(input.url, maxSizeBytes)
  const validationError = activeStorage.provider.validate(
    { type: contentType, size: buffer.byteLength },
    { maxSizeBytes, allowedMimeTypes: getAllowedImportImageMimeTypes() },
  )

  if (validationError) throw new Error(validationError)

  const filename = `${Date.now()}-${randomUUID()}.${getImageExtension(contentType)}`
  const result = await activeStorage.provider.upload(buffer, filename, contentType, input.folder || 'mcp')

  return {
    originalUrl: input.url,
    url: result.url,
    path: result.path,
    contentType,
    size: buffer.byteLength,
    provider: activeStorage.providerName,
  }
}

export async function listBlogMedia(context: BlogServiceContext) {
  const activeStorage = await getActiveStorage(context.supabase)
  if (!activeStorage.provider.listFiles) {
    return {
      provider: activeStorage.providerName,
      files: [],
      message: 'The active storage provider does not support listing files.',
    }
  }

  return {
    provider: activeStorage.providerName,
    files: await activeStorage.provider.listFiles(),
  }
}

export async function exportBlogMigrationPackage(context: BlogServiceContext) {
  return createQuietPressExport(context.supabase)
}

export async function previewBlogMigrationPackage(context: BlogServiceContext, migrationPackage: QuietPressExportV1) {
  return createMigrationPreview(context.supabase, migrationPackage)
}

export async function importBlogMigrationPackage(
  context: BlogServiceContext,
  migrationPackage: QuietPressExportV1,
  options: MigrationImportOptions,
) {
  const result = await importQuietPressPackage(context.supabase, migrationPackage, options)
  revalidateContent()
  return result
}

export async function getBlogAnalyticsSummary(context: BlogServiceContext) {
  const [posts, comments, settings] = await Promise.all([
    getAllPosts(context),
    context.supabase.from('comments').select('status'),
    getBlogSettings(context),
  ])

  const commentRows = comments.data || []
  return {
    posts: {
      total: posts.length,
      published: posts.filter((post) => post.status === 'published').length,
      draft: posts.filter((post) => post.status === 'draft').length,
      archived: posts.filter((post) => post.status === 'archived').length,
      scheduled: posts.filter((post) => post.status === 'scheduled').length,
      total_views: posts.reduce((sum, post) => sum + post.views_count, 0),
    },
    comments: {
      total: commentRows.length,
      pending: commentRows.filter((comment) => comment.status === 'pending').length,
      approved: commentRows.filter((comment) => comment.status === 'approved').length,
      spam: commentRows.filter((comment) => comment.status === 'spam').length,
    },
    settings: {
      site_name: settings?.site_name,
      base_url: settings?.base_url,
      comments_enabled: settings?.comments_enabled,
    },
  }
}
