import { z } from 'zod'

function isUrlWithProtocol(value: string, protocols: string[]): boolean {
  if (!value) return true
  try {
    return protocols.includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function optionalHttpUrl(label: string) {
  return z.string().trim().max(2048, `${label} is too long`).refine(
    (value) => isUrlWithProtocol(value, ['http:', 'https:']),
    `${label} must be an HTTP(S) URL`,
  )
}

function optionalHttpsUrl(label: string) {
  return z.string().trim().max(2048, `${label} is too long`).refine(
    (value) => isUrlWithProtocol(value, ['https:']),
    `${label} must be an HTTPS URL`,
  )
}

export const postStatusSchema = z.enum(['draft', 'scheduled', 'published', 'archived'])

export const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200字'),
  content_markdown: z.string().min(1, '内容不能为空'),
  excerpt: z.string().max(500, '摘要最多500字').optional().default(''),
  status: postStatusSchema.default('draft'),
  cover_image_url: optionalHttpUrl('Cover image URL'),
  seo_title: z.string().max(120, 'SEO标题最多120字').optional().default(''),
  seo_description: z.string().max(300, 'SEO描述最多300字').optional().default(''),
  canonical_url: optionalHttpUrl('Canonical URL'),
  noindex: z.boolean().default(false),
  tags: z.array(z.string().uuid()).default([]),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200字'),
  content_markdown: z.string().min(1, '内容不能为空'),
  excerpt: z.string().max(500, '摘要最多500字').optional().default(''),
  status: postStatusSchema.optional(),
  cover_image_url: optionalHttpUrl('Cover image URL'),
  seo_title: z.string().max(120, 'SEO标题最多120字').optional().default(''),
  seo_description: z.string().max(300, 'SEO描述最多300字').optional().default(''),
  canonical_url: optionalHttpUrl('Canonical URL'),
  noindex: z.boolean().optional(),
  tags: z.array(z.string().uuid()).optional(),
})

export const tagNameSchema = z.object({
  name: z.string().min(1, '标签名不能为空').max(50, '标签名最多50字'),
})

export const siteSettingsSchema = z.object({
  site_name: z.string().min(1, '站点名称不能为空').max(100),
  site_description: z.string().max(300).optional().default(''),
  base_url: optionalHttpUrl('Site URL'),
  author_name: z.string().max(100).optional().default(''),
  default_og_image_url: optionalHttpUrl('OG image URL'),
  comments_enabled: z.boolean().default(true),
  image_upload_max_size_mb: z.coerce.number().int().min(1).max(10).default(10),
  image_compression_enabled: z.boolean().default(true),
  image_compression_quality: z.coerce.number().int().min(40).max(95).default(82),
  image_max_width: z.coerce.number().int().min(640).max(4096).default(1920),
  image_max_height: z.coerce.number().int().min(640).max(4096).default(1920),
  about_content: z.string().optional().default(''),
  social_twitter: optionalHttpsUrl('Twitter URL').default(''),
  social_github: optionalHttpsUrl('GitHub URL').default(''),
  social_linkedin: optionalHttpsUrl('LinkedIn URL').default(''),
  social_instagram: optionalHttpsUrl('Instagram URL').default(''),
})

export const storageSettingsSchema = z.object({
  storage_provider: z.enum(['supabase', 's3', 'r2']).default('supabase'),
  storage_quota_mb: z.coerce.number().int().min(0).max(10_485_760).default(0),
})

export const adminPasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm the new password'),
}).superRefine((value, ctx) => {
  if (value.new_password !== value.confirm_password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password and confirmation do not match',
      path: ['confirm_password'],
    })
  }

  if (value.current_password === value.new_password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password must be different from the current password',
      path: ['new_password'],
    })
  }
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type TagNameInput = z.infer<typeof tagNameSchema>
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>
export type StorageSettingsInput = z.infer<typeof storageSettingsSchema>
export type AdminPasswordInput = z.infer<typeof adminPasswordSchema>
