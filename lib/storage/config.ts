export const STORAGE_PROVIDER_NAMES = ['supabase', 's3', 'r2'] as const

export type StorageProviderName = (typeof STORAGE_PROVIDER_NAMES)[number]

export interface StorageProviderEnvironmentStatus {
  provider: StorageProviderName
  label: string
  configured: boolean
  requiredEnv: string[]
  missingEnv: string[]
  description: string
}

const PROVIDER_LABELS: Record<StorageProviderName, string> = {
  supabase: 'Supabase Storage',
  s3: 'S3-compatible',
  r2: 'Cloudflare R2',
}

const PROVIDER_DESCRIPTIONS: Record<StorageProviderName, string> = {
  supabase: '默认存储桶 blog-images，适合快速部署和小型站点。',
  s3: '兼容 AWS S3、MinIO、Backblaze B2 等 S3 API 服务。',
  r2: 'Cloudflare R2，使用 S3 兼容 API，适合配合自定义 CDN 域名。',
}

const PROVIDER_REQUIRED_ENV: Record<StorageProviderName, string[]> = {
  supabase: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  s3: ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_PUBLIC_URL_BASE'],
  r2: ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_PUBLIC_URL_BASE'],
}

export function normalizeStorageProvider(value: unknown): StorageProviderName {
  return STORAGE_PROVIDER_NAMES.includes(value as StorageProviderName)
    ? value as StorageProviderName
    : 'supabase'
}

export function getStorageProviderLabel(provider: StorageProviderName): string {
  return PROVIDER_LABELS[provider]
}

export function getStorageProviderEnvironmentStatus(
  provider: StorageProviderName,
): StorageProviderEnvironmentStatus {
  const requiredEnv = PROVIDER_REQUIRED_ENV[provider]
  const missingEnv = requiredEnv.filter((key) => !process.env[key])

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    configured: missingEnv.length === 0,
    requiredEnv,
    missingEnv,
    description: PROVIDER_DESCRIPTIONS[provider],
  }
}

export function getAllStorageProviderEnvironmentStatuses(): StorageProviderEnvironmentStatus[] {
  return STORAGE_PROVIDER_NAMES.map((provider) => getStorageProviderEnvironmentStatus(provider))
}
