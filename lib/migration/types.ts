import { z } from 'zod'

export const QUIETPRESS_EXPORT_VERSION = 1
export const MAX_IMPORT_JSON_BYTES = 10 * 1024 * 1024

export const migrationPostActionSchema = z.enum(['skip', 'overwrite', 'duplicate'])
export const migrationTagActionSchema = z.enum(['reuse', 'overwrite'])

export const quietPressExportMetaSchema = z.object({
  app: z.literal('quietpress'),
  version: z.literal(QUIETPRESS_EXPORT_VERSION),
  exported_at: z.string().datetime(),
  source_url: z.string().url().nullable(),
  counts: z.object({
    posts: z.number().int().min(0),
    tags: z.number().int().min(0),
    media: z.number().int().min(0),
  }),
})

export const quietPressExportSettingsSchema = z.object({
  site_name: z.string().min(1).max(100),
  site_description: z.string().max(300),
  base_url: z.string().url().nullable(),
  author_name: z.string().max(100),
  default_og_image_url: z.string().url().nullable(),
  comments_enabled: z.boolean(),
  image_upload_max_size_mb: z.number().int().min(1).max(10),
  image_compression_enabled: z.boolean(),
  image_compression_quality: z.number().int().min(40).max(95),
  image_max_width: z.number().int().min(640).max(4096),
  image_max_height: z.number().int().min(640).max(4096),
  social_links: z.record(z.string()),
  about_content: z.string(),
})

export const quietPressExportTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(200),
  created_at: z.string().datetime().nullable(),
})

export const quietPressExportPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(300),
  excerpt: z.string().max(500).nullable(),
  content_markdown: z.string().min(1),
  cover_image_url: z.string().url().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  seo_title: z.string().max(120).nullable(),
  seo_description: z.string().max(300).nullable(),
  canonical_url: z.string().url().nullable(),
  noindex: z.boolean(),
  reading_time_minutes: z.number().int().min(1),
  views_count: z.number().int().min(0),
  published_at: z.string().datetime().nullable(),
  created_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime().nullable(),
  tag_slugs: z.array(z.string().min(1).max(200)),
})

export const quietPressExportMediaSchema = z.object({
  url: z.string().url(),
  source: z.enum(['post_cover', 'post_content', 'settings_og', 'library']),
  post_slug: z.string().nullable(),
  path: z.string().nullable(),
  name: z.string().nullable(),
  size: z.number().int().min(0).nullable(),
  content_type: z.string().nullable(),
  last_modified: z.string().datetime().nullable(),
})

export const quietPressExportV1Schema = z.object({
  meta: quietPressExportMetaSchema,
  settings: quietPressExportSettingsSchema.nullable(),
  tags: z.array(quietPressExportTagSchema),
  posts: z.array(quietPressExportPostSchema),
  media: z.array(quietPressExportMediaSchema),
})

export const migrationImportOptionsSchema = z.object({
  importSettings: z.boolean().default(true),
  importMedia: z.boolean().default(true),
  postActions: z.record(migrationPostActionSchema).default({}),
  tagActions: z.record(migrationTagActionSchema).default({}),
})

export const migrationImportRequestSchema = z.object({
  package: quietPressExportV1Schema,
  options: migrationImportOptionsSchema,
})

export type QuietPressExportV1 = z.infer<typeof quietPressExportV1Schema>
export type QuietPressExportPost = z.infer<typeof quietPressExportPostSchema>
export type QuietPressExportTag = z.infer<typeof quietPressExportTagSchema>
export type QuietPressExportMedia = z.infer<typeof quietPressExportMediaSchema>
export type MigrationPostAction = z.infer<typeof migrationPostActionSchema>
export type MigrationTagAction = z.infer<typeof migrationTagActionSchema>
export type MigrationImportOptions = z.infer<typeof migrationImportOptionsSchema>

export interface MigrationPostConflict {
  slug: string
  importedTitle: string
  existingTitle: string
}

export interface MigrationTagConflict {
  slug: string
  importedName: string
  existingName: string
}

export interface MigrationPreview {
  meta: QuietPressExportV1['meta']
  summary: {
    posts: number
    tags: number
    media: number
    settings: boolean
    invalidMediaUrls: number
  }
  conflicts: {
    posts: MigrationPostConflict[]
    tags: MigrationTagConflict[]
  }
  warnings: string[]
}

export interface ImportedMediaResult {
  originalUrl: string
  importedUrl?: string
  path?: string
  error?: string
}
