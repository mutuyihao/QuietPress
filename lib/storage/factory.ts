import type { StorageProvider } from './types'
import { normalizeStorageProvider, type StorageProviderName } from './config'

let cachedProvider: StorageProvider | null = null
let cachedProviderName: string | null = null

export async function getStorageProvider(providerOverride?: StorageProviderName): Promise<StorageProvider> {
  const provider = normalizeStorageProvider(providerOverride || process.env.STORAGE_PROVIDER || 'supabase')

  if (provider === 'supabase') {
    const { SupabaseStorage } = await import('./supabase')
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    return new SupabaseStorage(supabase)
  }

  if (cachedProvider && cachedProviderName === provider) {
    return cachedProvider
  }

  switch (provider) {
    case 's3':
    case 'r2': {
      const { S3Storage } = await import('./s3')
      const endpoint = process.env.S3_ENDPOINT
      const region = process.env.S3_REGION || 'auto'
      const accessKeyId = process.env.S3_ACCESS_KEY_ID
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
      const bucket = process.env.S3_BUCKET
      const publicUrlBase = process.env.S3_PUBLIC_URL_BASE

      if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
        throw new Error(
          'STORAGE_PROVIDER=s3|r2 requires S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_PUBLIC_URL_BASE. S3_REGION is optional and defaults to auto.',
        )
      }

      const providerInstance = new S3Storage(
        { endpoint, region, accessKeyId, secretAccessKey, bucket, publicUrlBase },
        provider,
      )
      cachedProvider = providerInstance
      cachedProviderName = provider
      return providerInstance
    }
  }

  throw new Error(`Unsupported storage provider: ${provider}`)
}

export function resetStorageProvider(): void {
  cachedProvider = null
  cachedProviderName = null
}
