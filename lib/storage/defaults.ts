import type { StorageProviderName } from './config'
import type { StorageQuotaSource } from './usage'

export const SUPABASE_FREE_STORAGE_QUOTA_MB = 1024
export const SUPABASE_FREE_MAX_UPLOAD_MB = 50

interface DefaultStorageQuota {
  quotaMb: number
  source: Exclude<StorageQuotaSource, 'manual'>
}

function parseQuotaMb(value: string | undefined): number | null {
  if (!value) return null
  const quotaMb = Number(value)
  return Number.isFinite(quotaMb) && quotaMb > 0 ? Math.floor(quotaMb) : null
}

export function getDefaultStorageQuota(provider: StorageProviderName): DefaultStorageQuota | null {
  if (provider !== 'supabase') return null

  const envQuotaMb = parseQuotaMb(process.env.DEFAULT_SUPABASE_STORAGE_QUOTA_MB)
  if (envQuotaMb !== null) {
    return {
      quotaMb: envQuotaMb,
      source: 'env-default',
    }
  }

  return {
    quotaMb: SUPABASE_FREE_STORAGE_QUOTA_MB,
    source: 'supabase-free-default',
  }
}
