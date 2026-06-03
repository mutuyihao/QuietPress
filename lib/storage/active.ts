import { getImageUploadConfig } from '@/lib/image-upload-config'
import type { SiteSettings } from '@/lib/types'
import {
  getStorageProvider,
  getStorageProviderEnvironmentStatus,
  normalizeStorageProvider,
  type StorageProviderName,
} from '@/lib/storage'
import type { StorageProvider } from '@/lib/storage/types'

export interface ActiveStorage {
  providerName: StorageProviderName
  provider: StorageProvider
  settings: SiteSettings | null
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: SiteSettings | null; error: unknown }>
      }
    }
  }
}

export async function getActiveStorage(supabaseClient: unknown): Promise<ActiveStorage> {
  const supabase = supabaseClient as SupabaseLike

  const { data: settings } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'main')
    .maybeSingle()

  const providerName = normalizeStorageProvider(settings?.storage_provider || process.env.STORAGE_PROVIDER || 'supabase')
  const providerStatus = getStorageProviderEnvironmentStatus(providerName)

  if (!providerStatus.configured) {
    throw new Error(`${providerStatus.label} is not configured: ${providerStatus.missingEnv.join(', ')}`)
  }

  return {
    providerName,
    provider: await getStorageProvider(providerName),
    settings,
  }
}

export function getActiveUploadConfig(settings: SiteSettings | null) {
  return getImageUploadConfig(settings)
}
