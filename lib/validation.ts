import { z } from "zod";

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

const adminNewPasswordSchema = z
  .string()
  .min(
    MIN_ADMIN_PASSWORD_LENGTH,
    `新密码至少需要 ${MIN_ADMIN_PASSWORD_LENGTH} 个字符`,
  )
  .superRefine((password, ctx) => {
    const requirements: Array<[boolean, string]> = [
      [/[a-z]/.test(password), "新密码需要包含小写字母"],
      [/[A-Z]/.test(password), "新密码需要包含大写字母"],
      [/[0-9]/.test(password), "新密码需要包含数字"],
      [/[^A-Za-z0-9]/.test(password), "新密码需要包含符号"],
    ];

    for (const [valid, message] of requirements) {
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
        });
      }
    }
  });

function isUrlWithProtocol(value: string, protocols: string[]): boolean {
  if (!value) return true;
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function optionalHttpUrl(label: string) {
  return z
    .string()
    .trim()
    .max(2048, `${label} is too long`)
    .refine(
      (value) => isUrlWithProtocol(value, ["http:", "https:"]),
      `${label} must be an HTTP(S) URL`,
    );
}

function optionalHttpsUrl(label: string) {
  return z
    .string()
    .trim()
    .max(2048, `${label} is too long`)
    .refine(
      (value) => isUrlWithProtocol(value, ["https:"]),
      `${label} must be an HTTPS URL`,
    );
}

export const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "published",
  "archived",
]);
export const postTitleSchema = z
  .string()
  .min(1, "标题不能为空")
  .max(200, "标题最多200字");
export const postContentMarkdownSchema = z.string().min(1, "内容不能为空");
export const postExcerptSchema = z.string().max(500, "摘要最多500字");
export const postSeoTitleSchema = z.string().max(120, "SEO标题最多120字");
export const postSeoDescriptionSchema = z.string().max(300, "SEO描述最多300字");
export const tagNameStringSchema = z
  .string()
  .min(1, "标签名不能为空")
  .max(50, "标签名最多50字");
export const tagSlugStringSchema = z.string().min(1).max(200);
export const siteNameStringSchema = z
  .string()
  .min(1, "站点名称不能为空")
  .max(100);
export const siteDescriptionStringSchema = z.string().max(300);
export const authorNameStringSchema = z.string().max(100);
export const imageUploadMaxSizeMbSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(10);
export const imageCompressionQualitySchema = z.coerce
  .number()
  .int()
  .min(40)
  .max(95);
export const imageDimensionSchema = z.coerce.number().int().min(640).max(4096);
export const optionalHttpUrlSchema = optionalHttpUrl("HTTP URL");
export const optionalHttpsUrlSchema = optionalHttpsUrl("HTTPS URL");

export const createPostSchema = z.object({
  title: postTitleSchema,
  content_markdown: postContentMarkdownSchema,
  excerpt: postExcerptSchema.optional().default(""),
  status: postStatusSchema.default("draft"),
  cover_image_url: optionalHttpUrl("Cover image URL"),
  seo_title: postSeoTitleSchema.optional().default(""),
  seo_description: postSeoDescriptionSchema.optional().default(""),
  canonical_url: optionalHttpUrl("Canonical URL"),
  noindex: z.boolean().default(false),
  tags: z.array(z.string().uuid()).default([]),
});

export const updatePostSchema = z.object({
  title: postTitleSchema,
  content_markdown: postContentMarkdownSchema,
  excerpt: postExcerptSchema.optional().default(""),
  status: postStatusSchema.optional(),
  cover_image_url: optionalHttpUrl("Cover image URL"),
  seo_title: postSeoTitleSchema.optional().default(""),
  seo_description: postSeoDescriptionSchema.optional().default(""),
  canonical_url: optionalHttpUrl("Canonical URL"),
  noindex: z.boolean().optional(),
  tags: z.array(z.string().uuid()).optional(),
});

export const tagNameSchema = z.object({
  name: tagNameStringSchema,
});

export const siteSettingsSchema = z.object({
  site_name: siteNameStringSchema,
  site_description: siteDescriptionStringSchema.optional().default(""),
  base_url: optionalHttpUrl("Site URL"),
  author_name: authorNameStringSchema.optional().default(""),
  default_og_image_url: optionalHttpUrl("OG image URL"),
  comments_enabled: z.boolean().default(true),
  image_upload_max_size_mb: imageUploadMaxSizeMbSchema.default(10),
  image_compression_enabled: z.boolean().default(true),
  image_compression_quality: imageCompressionQualitySchema.default(82),
  image_max_width: imageDimensionSchema.default(1920),
  image_max_height: imageDimensionSchema.default(1920),
  about_content: z.string().optional().default(""),
  social_twitter: optionalHttpsUrlSchema.default(""),
  social_github: optionalHttpsUrlSchema.default(""),
  social_linkedin: optionalHttpsUrlSchema.default(""),
  social_instagram: optionalHttpsUrlSchema.default(""),
});

export const storageSettingsSchema = z.object({
  storage_provider: z.enum(["supabase", "s3", "r2"]).default("supabase"),
  storage_quota_mb: z.coerce.number().int().min(0).max(10_485_760).default(0),
});

export const adminPasswordSchema = z
  .object({
    current_password: z.string().min(1, "请输入当前密码"),
    new_password: adminNewPasswordSchema,
    confirm_password: z.string().min(1, "请确认新密码"),
  })
  .superRefine((value, ctx) => {
    if (value.new_password !== value.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "两次输入的新密码不一致",
        path: ["confirm_password"],
      });
    }

    if (value.current_password === value.new_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "新密码不能和当前密码相同",
        path: ["new_password"],
      });
    }
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type TagNameInput = z.infer<typeof tagNameSchema>;
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type StorageSettingsInput = z.infer<typeof storageSettingsSchema>;
export type AdminPasswordInput = z.infer<typeof adminPasswordSchema>;
