import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostWithTags, Tag } from '@/lib/types'
import type { PostRepository, CreatePostInput, UpdatePostInput, PaginatedResult } from '../types'
import { getRouteSegmentVariants } from '@/lib/route-segments'
import { slugify } from '@/lib/blog-utils'

function getPostSlugVariants(slug: string): string[] {
  const routeVariants = getRouteSegmentVariants(slug)
  const legacySlugVariants = routeVariants.map((variant) => slugify(variant))
  return Array.from(new Set([...routeVariants, ...legacySlugVariants]))
}

function getNestedTags(value: unknown): Tag[] {
  if (!Array.isArray(value)) return []

  const tags: Tag[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue

    const nested = (item as { tags?: Tag | Tag[] | null }).tags
    if (Array.isArray(nested)) {
      for (const tag of nested) {
        if (tag) tags.push(tag)
      }
    } else if (nested) {
      tags.push(nested)
    }
  }

  return tags
}

function mapNestedPost(post: Record<string, unknown>): PostWithTags {
  const { post_tags: postTags, ...postData } = post
  return {
    ...postData,
    tags: getNestedTags(postTags),
  } as PostWithTags
}

async function attachTags(
  supabase: SupabaseClient,
  posts: Record<string, unknown>[],
): Promise<PostWithTags[]> {
  if (posts.length === 0) return []

  const postIds = posts.map((p) => p.id as string)

  const { data: allPostTags } = await supabase
    .from('post_tags')
    .select('post_id, tags(*)')
    .in('post_id', postIds)

  const postTagsMap = new Map<string, Tag[]>()
  if (allPostTags) {
    allPostTags.forEach((pt: Record<string, unknown>) => {
      const tag = pt.tags as Tag | null
      if (tag) {
        const arr = postTagsMap.get(pt.post_id as string) || []
        arr.push(tag)
        postTagsMap.set(pt.post_id as string, arr)
      }
    })
  }

  return posts.map((post) => ({
    ...post,
    tags: postTagsMap.get(post.id as string) || [],
  })) as PostWithTags[]
}

export class SupabasePostRepository implements PostRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(page = 1, pageSize = 10): Promise<PaginatedResult<PostWithTags>> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const now = new Date().toISOString()

    const { data: posts, count, error } = await this.supabase
      .from('posts')
      .select('*, post_tags(tags(*))', { count: 'exact' })
      .eq('status', 'published')
      .lte('published_at', now)
      .order('published_at', { ascending: false })
      .range(from, to)

    if (error || !posts) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const total = count ?? posts.length
    return {
      items: posts.map((post) => mapNestedPost(post)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async listAll(): Promise<PostWithTags[]> {
    const { data: posts, error } = await this.supabase
      .from('posts')
      .select('*, post_tags(tags(*))')
      .order('updated_at', { ascending: false })

    if (error || !posts) return []
    return posts.map((post) => mapNestedPost(post))
  }

  async getBySlug(slug: string): Promise<PostWithTags | null> {
    const slugVariants = getPostSlugVariants(slug)

    const { data: post, error } = await this.supabase
      .from('posts')
      .select('*, post_tags(tags(*))')
      .in('slug', slugVariants)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !post) return null

    return mapNestedPost(post)
  }

  async getById(id: string): Promise<PostWithTags | null> {
    const { data: post, error } = await this.supabase
      .from('posts')
      .select('*, post_tags(tags(*))')
      .eq('id', id)
      .single()

    if (error || !post) return null

    return mapNestedPost(post)
  }

  async listByTag(tagSlug: string): Promise<PostWithTags[]> {
    const tagSlugVariants = getRouteSegmentVariants(tagSlug)

    const { data: tag } = await this.supabase
      .from('tags')
      .select('*')
      .in('slug', tagSlugVariants)
      .limit(1)
      .maybeSingle()

    if (!tag) return []

    const { data: postTags } = await this.supabase
      .from('post_tags')
      .select('post_id')
      .eq('tag_id', tag.id)

    if (!postTags || postTags.length === 0) return []

    const { data: posts } = await this.supabase
      .from('posts')
      .select('*')
      .in('id', postTags.map((pt) => pt.post_id))
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })

    if (!posts) return []
    return attachTags(this.supabase, posts)
  }

  async search(query: string): Promise<PostWithTags[]> {
    const normalized = query.replace(/\s+/g, ' ').trim().slice(0, 200)
    const { data: posts, error } = await this.supabase.rpc('search_posts', {
      search_query: normalized,
      limit_count: 20,
    })

    if (error || !posts) return []
    return attachTags(this.supabase, posts)
  }

  async create(input: CreatePostInput): Promise<{ id: string }> {
    const { tagIds, ...postData } = input

    const { data: post, error } = await this.supabase
      .from('posts')
      .insert({
        title: postData.title,
        slug: postData.slug,
        excerpt: postData.excerpt,
        content_markdown: postData.contentMarkdown,
        cover_image_url: postData.coverImageUrl,
        status: postData.status,
        seo_title: postData.seoTitle,
        seo_description: postData.seoDescription,
        canonical_url: postData.canonicalUrl,
        noindex: postData.noindex,
        reading_time_minutes: postData.readingTimeMinutes,
        published_at: postData.publishedAt,
        author_id: postData.authorId,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    if (tagIds.length > 0) {
      await this.supabase.from('post_tags').insert(
        tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })),
      )
    }

    return { id: post.id }
  }

  async update(id: string, input: UpdatePostInput): Promise<void> {
    const payload: Record<string, unknown> = {}

    if (input.title !== undefined) payload.title = input.title
    if (input.slug !== undefined) payload.slug = input.slug
    if (input.excerpt !== undefined) payload.excerpt = input.excerpt
    if (input.contentMarkdown !== undefined) payload.content_markdown = input.contentMarkdown
    if (input.coverImageUrl !== undefined) payload.cover_image_url = input.coverImageUrl
    if (input.status !== undefined) payload.status = input.status
    if (input.seoTitle !== undefined) payload.seo_title = input.seoTitle
    if (input.seoDescription !== undefined) payload.seo_description = input.seoDescription
    if (input.canonicalUrl !== undefined) payload.canonical_url = input.canonicalUrl
    if (input.noindex !== undefined) payload.noindex = input.noindex
    if (input.readingTimeMinutes !== undefined) payload.reading_time_minutes = input.readingTimeMinutes
    if (input.publishedAt !== undefined) payload.published_at = input.publishedAt

    if (Object.keys(payload).length > 0) {
      const { error } = await this.supabase
        .from('posts')
        .update(payload)
        .eq('id', id)

      if (error) throw new Error(error.message)
    }
  }

  async delete(id: string): Promise<{ slug: string | null }> {
    const { data: post } = await this.supabase
      .from('posts')
      .select('slug')
      .eq('id', id)
      .single()

    const { error } = await this.supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return { slug: post?.slug ?? null }
  }

  async updateStatus(ids: string[], status: string): Promise<void> {
    const updateData: Record<string, unknown> = { status }
    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
    }

    const { error } = await this.supabase
      .from('posts')
      .update(updateData)
      .in('id', ids)

    if (error) throw new Error(error.message)
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('posts')
      .delete()
      .in('id', ids)

    if (error) throw new Error(error.message)
  }

  async incrementViews(id: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_post_views', { post_id: id })
    if (error) {
      console.error('Failed to increment post views:', error)
    }
  }

  async setTags(postId: string, tagIds: string[]): Promise<void> {
    await this.supabase.from('post_tags').delete().eq('post_id', postId)

    if (tagIds.length > 0) {
      await this.supabase.from('post_tags').insert(
        tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })),
      )
    }
  }

  async getSlug(id: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('posts')
      .select('slug')
      .eq('id', id)
      .single()

    return data?.slug ?? null
  }

  /** For revision saving — direct access needed beyond the PostRepository interface */
  async saveRevision(postId: string, data: { title: string; contentMarkdown: string; excerpt: string | null; userId: string }): Promise<void> {
    await this.supabase.from('post_revisions').insert({
      post_id: postId,
      title: data.title,
      content_markdown: data.contentMarkdown,
      excerpt: data.excerpt,
      created_by: data.userId,
    })
  }
}
