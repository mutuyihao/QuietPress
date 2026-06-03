import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { PostWithTags, Tag } from '@/lib/types'

const RELATED_POSTS_REVALIDATE_SECONDS = 3600

const getRelatedPostsCached = unstable_cache(async (
  currentPostId: string,
  tagKey: string,
  limit = 3,
): Promise<PostWithTags[]> => {
  const tagIds = tagKey ? tagKey.split(',') : []
  if (tagIds.length === 0) return []

  const supabase = createPublicClient()

  // Find posts sharing at least one tag, excluding current post
  const { data: relatedPostTags } = await supabase
    .from('post_tags')
    .select('post_id, tag_id')
    .in('tag_id', tagIds)
    .neq('post_id', currentPostId)

  if (!relatedPostTags || relatedPostTags.length === 0) return []

  // Score posts by number of shared tags
  const postScoreMap = new Map<string, number>()
  relatedPostTags.forEach((pt) => {
    postScoreMap.set(pt.post_id, (postScoreMap.get(pt.post_id) || 0) + 1)
  })

  const topPostIds = [...postScoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)

  if (topPostIds.length === 0) return []

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', topPostIds)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })

  if (!posts || posts.length === 0) return []

  // Batch fetch tags for related posts
  const { data: allPostTags } = await supabase
    .from('post_tags')
    .select('post_id, tag_id')
    .in('post_id', posts.map((p) => p.id))

  const allTagIds = [...new Set((allPostTags || []).map((pt) => pt.tag_id))]

  const { data: allTags } = await supabase
    .from('tags')
    .select('*')
    .in('id', allTagIds)

  const tagMap = new Map<string, Tag>()
  if (allTags) allTags.forEach((t) => tagMap.set(t.id, t))

  const postTagsMap = new Map<string, Tag[]>()
  ;(allPostTags || []).forEach((pt) => {
    const tag = tagMap.get(pt.tag_id)
    if (tag) {
      const arr = postTagsMap.get(pt.post_id) || []
      arr.push(tag)
      postTagsMap.set(pt.post_id, arr)
    }
  })

  const sortedPosts = topPostIds
    .map((id) => posts.find((p) => p.id === id))
    .filter(Boolean)
    .map((post) => ({ ...post!, tags: postTagsMap.get(post!.id) || [] }))

  return sortedPosts
}, ['related-posts'], {
  tags: ['posts', 'tags'],
  revalidate: RELATED_POSTS_REVALIDATE_SECONDS,
})

export const getRelatedPosts = cache((
  currentPostId: string,
  tagIds: string[],
  limit = 3,
) => {
  const tagKey = [...tagIds].sort().join(',')
  return getRelatedPostsCached(currentPostId, tagKey, limit)
})
