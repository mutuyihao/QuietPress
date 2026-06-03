import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tag } from '@/lib/types'
import type { TagRepository } from '../types'
import { getRouteSegmentVariants } from '@/lib/route-segments'

export class SupabaseTagRepository implements TagRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(): Promise<Tag[]> {
    const { data: tags, error } = await this.supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true })

    if (error || !tags) return []
    return tags
  }

  async getBySlug(slug: string): Promise<Tag | null> {
    const slugVariants = getRouteSegmentVariants(slug)

    const { data: tag, error } = await this.supabase
      .from('tags')
      .select('*')
      .in('slug', slugVariants)
      .limit(1)
      .maybeSingle()

    if (error || !tag) return null
    return tag
  }

  async create(name: string, slug: string): Promise<Tag> {
    const { data: tag, error } = await this.supabase
      .from('tags')
      .insert({ name, slug })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return tag
  }

  async update(id: string, name: string, slug: string): Promise<Tag> {
    const { data: tag, error } = await this.supabase
      .from('tags')
      .update({ name, slug })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return tag
  }

  async delete(id: string): Promise<{ slug: string | null }> {
    const { data: tag } = await this.supabase
      .from('tags')
      .select('slug')
      .eq('id', id)
      .single()

    const { error } = await this.supabase
      .from('tags')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return { slug: tag?.slug ?? null }
  }
}
