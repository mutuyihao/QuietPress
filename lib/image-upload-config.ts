import type { SiteSettings } from '@/lib/types'

export interface ImageUploadConfig {
  maxSizeMb: number
  compressionEnabled: boolean
  compressionQuality: number
  maxWidth: number
  maxHeight: number
}

export const DEFAULT_IMAGE_UPLOAD_CONFIG: ImageUploadConfig = {
  maxSizeMb: 10,
  compressionEnabled: true,
  compressionQuality: 82,
  maxWidth: 1920,
  maxHeight: 1920,
}

type ImageUploadSettingsSource = Partial<Pick<
  SiteSettings,
  | 'image_upload_max_size_mb'
  | 'image_compression_enabled'
  | 'image_compression_quality'
  | 'image_max_width'
  | 'image_max_height'
>>

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function getImageUploadConfig(settings?: ImageUploadSettingsSource | null): ImageUploadConfig {
  return {
    maxSizeMb: clampNumber(
      settings?.image_upload_max_size_mb,
      1,
      10,
      DEFAULT_IMAGE_UPLOAD_CONFIG.maxSizeMb,
    ),
    compressionEnabled: settings?.image_compression_enabled ?? DEFAULT_IMAGE_UPLOAD_CONFIG.compressionEnabled,
    compressionQuality: clampNumber(
      settings?.image_compression_quality,
      40,
      95,
      DEFAULT_IMAGE_UPLOAD_CONFIG.compressionQuality,
    ),
    maxWidth: clampNumber(settings?.image_max_width, 640, 4096, DEFAULT_IMAGE_UPLOAD_CONFIG.maxWidth),
    maxHeight: clampNumber(settings?.image_max_height, 640, 4096, DEFAULT_IMAGE_UPLOAD_CONFIG.maxHeight),
  }
}

export function getImageUploadMaxSizeBytes(config: ImageUploadConfig): number {
  return config.maxSizeMb * 1024 * 1024
}
