import { requireAdmin } from '@/lib/admin-auth'
import { createRepositories } from '@/lib/db'
import type { PostWithTags, Tag, SiteSettings } from '@/lib/types'

async function getAdminRepos() {
  const { supabase } = await requireAdmin()
  return createRepositories(supabase)
}

export async function getAllPostsAdmin(): Promise<PostWithTags[]> {
  const { posts } = await getAdminRepos()
  return posts.listAll()
}

export async function getPostByIdAdmin(id: string): Promise<PostWithTags | null> {
  const { posts } = await getAdminRepos()
  return posts.getById(id)
}

export async function getAllTagsAdmin(): Promise<Tag[]> {
  const { tags } = await getAdminRepos()
  return tags.list()
}

export async function getSiteSettingsAdmin(): Promise<SiteSettings | null> {
  const { settings } = await getAdminRepos()
  return settings.get()
}
