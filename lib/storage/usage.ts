import type { StorageProviderName } from './config'

export type StorageQuotaSource = 'manual' | 'supabase-free-default' | 'env-default'

export interface StorageUsageOverview {
  activeProvider: StorageProviderName
  usedBytes: number | null
  objectCount: number | null
  quotaBytes: number | null
  quotaSource: StorageQuotaSource | null
  availableBytes: number | null
  maxUploadBytes: number
  bucketFileSizeLimitBytes: number | null
  usageSource: string | null
  usageError: string | null
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null) return '未知'
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function getStorageUsagePercent(usedBytes: number | null, quotaBytes: number | null): number {
  if (usedBytes === null || quotaBytes === null || quotaBytes <= 0) return 0
  return Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
}

export function getStorageUsageSourceLabel(source: string | null): string {
  switch (source) {
    case 'supabase-storage-objects':
      return 'Supabase storage.objects 聚合'
    case 'supabase-storage-api-scan':
      return 'Supabase Storage API 扫描'
    case 's3-list-objects':
      return 'S3 ListObjectsV2 扫描'
    default:
      return '未知统计来源'
  }
}

export function getStorageQuotaSourceLabel(source: StorageQuotaSource | null): string {
  switch (source) {
    case 'manual':
      return '后台手动配置'
    case 'supabase-free-default':
      return 'Supabase Free 默认 1GB'
    case 'env-default':
      return '环境变量默认配额'
    default:
      return '未设置配额'
  }
}
