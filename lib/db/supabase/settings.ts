import type { SupabaseClient } from '@supabase/supabase-js'
import type { SiteSettings } from '@/lib/types'
import type { SettingsRepository } from '../types'

export class SupabaseSettingsRepository implements SettingsRepository {
  constructor(private supabase: SupabaseClient) {}

  async get(): Promise<SiteSettings | null> {
    const { data: settings, error } = await this.supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'main')
      .single()

    if (error || !settings) return null
    return settings
  }

  async upsert(data: Record<string, unknown>): Promise<void> {
    const { data: existing, error: updateError } = await this.supabase
      .from('site_settings')
      .update(data)
      .eq('id', 'main')
      .select('id')
      .maybeSingle()

    if (updateError) throw new Error(updateError.message)

    if (!existing) {
      const { error: insertError } = await this.supabase
        .from('site_settings')
        .insert({ id: 'main', ...data })

      if (insertError) {
        throw new Error(
          `站点设置初始化行不存在，且当前数据库未允许管理员创建设置行。请运行 supabase/migrations/202606020001_initial_release.sql 后重试。原始错误：${insertError.message}`,
        )
      }
    }
  }
}
