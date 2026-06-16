import { z } from "zod";
import {
  createBlogPostDraft,
  deleteBlogPost,
  exportBlogMigrationPackage,
  getBlogAnalyticsSummary,
  getBlogPost,
  getBlogSettings,
  listBlogMedia,
  importBlogMigrationPackage,
  listBlogComments,
  listBlogTags,
  manageBlogTag,
  moderateBlogComment,
  previewBlogMigrationPackage,
  searchBlogPosts,
  setBlogPostStatus,
  updateBlogPost,
  updateBlogSettings,
  uploadBlogMediaFromUrl,
  type BlogServiceContext,
} from "@/lib/blog-service";
import {
  migrationImportOptionsSchema,
  quietPressExportV1Schema,
} from "@/lib/migration/types";
import {
  authorNameStringSchema,
  imageCompressionQualitySchema,
  imageDimensionSchema,
  imageUploadMaxSizeMbSchema,
  optionalHttpUrlSchema,
  postContentMarkdownSchema,
  postExcerptSchema,
  postSeoDescriptionSchema,
  postSeoTitleSchema,
  postStatusSchema,
  postTitleSchema,
  siteDescriptionStringSchema,
  siteNameStringSchema,
  tagNameStringSchema,
  tagSlugStringSchema,
} from "@/lib/validation";
import type { McpScope } from "@/lib/mcp/scopes";
import { hasEveryScope } from "@/lib/mcp/scopes";
import type { McpAccessContext } from "@/lib/mcp/store";

type JsonSchema = Record<string, unknown>;

export class McpScopeError extends Error {
  constructor(public requiredScopes: McpScope[]) {
    super(`Missing required scope(s): ${requiredScopes.join(", ")}`);
  }
}

export interface McpHandlerContext {
  access: McpAccessContext;
  blog: BlogServiceContext;
}

interface McpToolDefinition {
  name: string;
  description: string;
  scopes: McpScope[];
  inputSchema: JsonSchema;
  parse: (value: unknown) => unknown;
  handler: (context: McpHandlerContext, args: unknown) => Promise<unknown>;
}

const dangerousSchema = z.object({
  confirm: z.literal(true),
  idempotency_key: z.string().min(8).max(120),
});

const optionalUrl = optionalHttpUrlSchema.nullable().optional();

const searchPostsSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.union([postStatusSchema, z.literal("all")]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const getPostSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(300).optional(),
  })
  .refine((value) => Boolean(value.id || value.slug), "id or slug is required");

const createDraftSchema = z.object({
  title: postTitleSchema,
  content_markdown: postContentMarkdownSchema,
  excerpt: postExcerptSchema.nullable().optional(),
  cover_image_url: optionalUrl,
  seo_title: postSeoTitleSchema.nullable().optional(),
  seo_description: postSeoDescriptionSchema.nullable().optional(),
  canonical_url: optionalUrl,
  noindex: z.boolean().optional(),
  tag_slugs: z.array(tagSlugStringSchema).optional(),
});

const updatePostSchema = z.object({
  id: z.string().uuid(),
  title: postTitleSchema.optional(),
  content_markdown: postContentMarkdownSchema.optional(),
  excerpt: postExcerptSchema.nullable().optional(),
  cover_image_url: optionalUrl,
  seo_title: postSeoTitleSchema.nullable().optional(),
  seo_description: postSeoDescriptionSchema.nullable().optional(),
  canonical_url: optionalUrl,
  noindex: z.boolean().optional(),
  tag_slugs: z.array(tagSlugStringSchema).optional(),
});

const postIdDangerousSchema = dangerousSchema.extend({
  id: z.string().uuid(),
});

const manageTagsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: tagNameStringSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    name: tagNameStringSchema,
  }),
  dangerousSchema.extend({
    action: z.literal("delete"),
    id: z.string().uuid(),
  }),
]);

const listCommentsSchema = z.object({
  status: z.enum(["pending", "approved", "spam"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const moderateCommentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("spam"),
    id: z.string().uuid(),
  }),
  dangerousSchema.extend({
    action: z.literal("delete"),
    id: z.string().uuid(),
  }),
]);

const uploadMediaSchema = z.object({
  url: z.string().url(),
  folder: z.string().min(1).max(80).optional(),
});

const updateSettingsSchema = dangerousSchema.extend({
  site_name: siteNameStringSchema.optional(),
  site_description: siteDescriptionStringSchema.optional(),
  base_url: optionalUrl,
  author_name: authorNameStringSchema.optional(),
  default_og_image_url: optionalUrl,
  comments_enabled: z.boolean().optional(),
  image_upload_max_size_mb: imageUploadMaxSizeMbSchema.optional(),
  image_compression_enabled: z.boolean().optional(),
  image_compression_quality: imageCompressionQualitySchema.optional(),
  image_max_width: imageDimensionSchema.optional(),
  image_max_height: imageDimensionSchema.optional(),
  about_content: z.string().optional(),
  social_links: z.record(z.string()).optional(),
});

const previewImportSchema = z.object({
  package: quietPressExportV1Schema,
});

const importPackageSchema = dangerousSchema.extend({
  package: quietPressExportV1Schema,
  options: migrationImportOptionsSchema,
});

const emptySchema = z.object({}).optional();

function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

const stringProp = (description: string) => ({ type: "string", description });
const booleanProp = (description: string) => ({ type: "boolean", description });

function parseWith<T>(parser: z.ZodType<T>) {
  return (value: unknown) => parser.parse(value ?? {});
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "blog.search_posts",
    description: "Search and list QuietPress posts across all statuses.",
    scopes: ["posts:read"],
    inputSchema: schema({
      query: stringProp(
        "Optional query matched against title, slug, excerpt, and markdown.",
      ),
      status: {
        type: "string",
        enum: ["draft", "scheduled", "published", "archived", "all"],
      },
      limit: { type: "number", minimum: 1, maximum: 100 },
    }),
    parse: parseWith(searchPostsSchema),
    handler: (context, args) =>
      searchBlogPosts(context.blog, args as z.infer<typeof searchPostsSchema>),
  },
  {
    name: "blog.get_post",
    description: "Read a full post by id or slug.",
    scopes: ["posts:read"],
    inputSchema: schema({
      id: stringProp("Post UUID."),
      slug: stringProp("Post slug."),
    }),
    parse: parseWith(getPostSchema),
    handler: (context, args) =>
      getBlogPost(context.blog, args as z.infer<typeof getPostSchema>),
  },
  {
    name: "blog.create_post_draft",
    description: "Create a draft post. Publishing requires blog.publish_post.",
    scopes: ["posts:write"],
    inputSchema: schema(
      {
        title: stringProp("Post title."),
        content_markdown: stringProp("Post body in Markdown."),
        excerpt: stringProp("Optional excerpt."),
        cover_image_url: stringProp("Optional HTTP(S) cover image URL."),
        seo_title: stringProp("Optional SEO title."),
        seo_description: stringProp("Optional SEO description."),
        canonical_url: stringProp("Optional HTTP(S) canonical URL."),
        noindex: booleanProp("Whether search engines should skip indexing."),
        tag_slugs: { type: "array", items: { type: "string" } },
      },
      ["title", "content_markdown"],
    ),
    parse: parseWith(createDraftSchema),
    handler: (context, args) =>
      createBlogPostDraft(
        context.blog,
        args as z.infer<typeof createDraftSchema>,
      ),
  },
  {
    name: "blog.update_post",
    description: "Update editable post fields without changing publish state.",
    scopes: ["posts:write"],
    inputSchema: schema(
      {
        id: stringProp("Post UUID."),
        title: stringProp("New post title."),
        content_markdown: stringProp("New Markdown body."),
        excerpt: stringProp("New excerpt."),
        cover_image_url: stringProp("New cover image URL."),
        seo_title: stringProp("New SEO title."),
        seo_description: stringProp("New SEO description."),
        canonical_url: stringProp("New canonical URL."),
        noindex: booleanProp("Whether search engines should skip indexing."),
        tag_slugs: { type: "array", items: { type: "string" } },
      },
      ["id"],
    ),
    parse: parseWith(updatePostSchema),
    handler: (context, args) =>
      updateBlogPost(context.blog, args as z.infer<typeof updatePostSchema>),
  },
  {
    name: "blog.publish_post",
    description: "Publish a post. Requires confirmation and idempotency key.",
    scopes: ["posts:publish"],
    inputSchema: schema(
      {
        id: stringProp("Post UUID."),
        confirm: booleanProp("Must be true."),
        idempotency_key: stringProp(
          "Caller-provided unique key for this unsafe action.",
        ),
      },
      ["id", "confirm", "idempotency_key"],
    ),
    parse: parseWith(postIdDangerousSchema),
    handler: (context, args) =>
      setBlogPostStatus(
        context.blog,
        (args as z.infer<typeof postIdDangerousSchema>).id,
        "published",
      ),
  },
  {
    name: "blog.archive_post",
    description: "Archive a post. Requires confirmation and idempotency key.",
    scopes: ["posts:publish"],
    inputSchema: schema(
      {
        id: stringProp("Post UUID."),
        confirm: booleanProp("Must be true."),
        idempotency_key: stringProp(
          "Caller-provided unique key for this unsafe action.",
        ),
      },
      ["id", "confirm", "idempotency_key"],
    ),
    parse: parseWith(postIdDangerousSchema),
    handler: (context, args) =>
      setBlogPostStatus(
        context.blog,
        (args as z.infer<typeof postIdDangerousSchema>).id,
        "archived",
      ),
  },
  {
    name: "blog.delete_post",
    description: "Delete a post. Requires confirmation and idempotency key.",
    scopes: ["posts:delete"],
    inputSchema: schema(
      {
        id: stringProp("Post UUID."),
        confirm: booleanProp("Must be true."),
        idempotency_key: stringProp(
          "Caller-provided unique key for this unsafe action.",
        ),
      },
      ["id", "confirm", "idempotency_key"],
    ),
    parse: parseWith(postIdDangerousSchema),
    handler: (context, args) =>
      deleteBlogPost(
        context.blog,
        (args as z.infer<typeof postIdDangerousSchema>).id,
      ),
  },
  {
    name: "blog.list_tags",
    description: "List all tags.",
    scopes: ["posts:read"],
    inputSchema: schema({}),
    parse: parseWith(emptySchema),
    handler: (context) => listBlogTags(context.blog),
  },
  {
    name: "blog.manage_tags",
    description: "Create, update, or delete tags.",
    scopes: ["tags:write"],
    inputSchema: schema(
      {
        action: { type: "string", enum: ["create", "update", "delete"] },
        id: stringProp("Tag UUID for update/delete."),
        name: stringProp("Tag name for create/update."),
        confirm: booleanProp("Must be true for delete."),
        idempotency_key: stringProp("Required for delete."),
      },
      ["action"],
    ),
    parse: parseWith(manageTagsSchema),
    handler: (context, args) =>
      manageBlogTag(context.blog, args as z.infer<typeof manageTagsSchema>),
  },
  {
    name: "blog.list_comments",
    description: "List comments for moderation.",
    scopes: ["comments:moderate"],
    inputSchema: schema({
      status: { type: "string", enum: ["pending", "approved", "spam"] },
      limit: { type: "number", minimum: 1, maximum: 100 },
    }),
    parse: parseWith(listCommentsSchema),
    handler: (context, args) =>
      listBlogComments(
        context.blog,
        args as z.infer<typeof listCommentsSchema>,
      ),
  },
  {
    name: "blog.moderate_comment",
    description: "Approve, mark as spam, or delete a comment.",
    scopes: ["comments:moderate"],
    inputSchema: schema(
      {
        action: { type: "string", enum: ["approve", "spam", "delete"] },
        id: stringProp("Comment UUID."),
        confirm: booleanProp("Must be true for delete."),
        idempotency_key: stringProp("Required for delete."),
      },
      ["action", "id"],
    ),
    parse: parseWith(moderateCommentSchema),
    handler: (context, args) =>
      moderateBlogComment(
        context.blog,
        args as z.infer<typeof moderateCommentSchema>,
      ),
  },
  {
    name: "blog.upload_media_from_url",
    description:
      "Fetch a public HTTP(S) image and upload it to the active storage provider.",
    scopes: ["media:write"],
    inputSchema: schema(
      {
        url: stringProp("Public HTTP(S) image URL."),
        folder: stringProp("Optional storage folder."),
      },
      ["url"],
    ),
    parse: parseWith(uploadMediaSchema),
    handler: (context, args) =>
      uploadBlogMediaFromUrl(
        context.blog,
        args as z.infer<typeof uploadMediaSchema>,
      ),
  },
  {
    name: "blog.list_media",
    description: "List files from the active storage provider when supported.",
    scopes: ["posts:read"],
    inputSchema: schema({}),
    parse: parseWith(emptySchema),
    handler: (context) => listBlogMedia(context.blog),
  },
  {
    name: "blog.get_site_settings",
    description: "Read public site settings.",
    scopes: ["posts:read"],
    inputSchema: schema({}),
    parse: parseWith(emptySchema),
    handler: (context) => getBlogSettings(context.blog),
  },
  {
    name: "blog.update_site_settings",
    description:
      "Update allowlisted public site settings. Does not expose storage secrets.",
    scopes: ["settings:write"],
    inputSchema: schema(
      {
        site_name: stringProp("Site name."),
        site_description: stringProp("Site description."),
        base_url: stringProp("Public base URL."),
        author_name: stringProp("Author name."),
        default_og_image_url: stringProp("Default OG image URL."),
        comments_enabled: booleanProp("Whether comments are enabled."),
        image_upload_max_size_mb: { type: "number", minimum: 1, maximum: 10 },
        image_compression_enabled: booleanProp(
          "Whether client compression is enabled.",
        ),
        image_compression_quality: { type: "number", minimum: 40, maximum: 95 },
        image_max_width: { type: "number", minimum: 640, maximum: 4096 },
        image_max_height: { type: "number", minimum: 640, maximum: 4096 },
        about_content: stringProp("About page content."),
        social_links: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        confirm: booleanProp("Must be true."),
        idempotency_key: stringProp(
          "Caller-provided unique key for this unsafe action.",
        ),
      },
      ["confirm", "idempotency_key"],
    ),
    parse: parseWith(updateSettingsSchema),
    handler: (context, args) => {
      const parsed = args as z.infer<typeof updateSettingsSchema>;
      return updateBlogSettings(context.blog, {
        site_name: parsed.site_name,
        site_description: parsed.site_description,
        base_url: parsed.base_url,
        author_name: parsed.author_name,
        default_og_image_url: parsed.default_og_image_url,
        comments_enabled: parsed.comments_enabled,
        image_upload_max_size_mb: parsed.image_upload_max_size_mb,
        image_compression_enabled: parsed.image_compression_enabled,
        image_compression_quality: parsed.image_compression_quality,
        image_max_width: parsed.image_max_width,
        image_max_height: parsed.image_max_height,
        about_content: parsed.about_content,
        social_links: parsed.social_links,
      });
    },
  },
  {
    name: "blog.export_package",
    description: "Export the QuietPress migration package.",
    scopes: ["migration:read"],
    inputSchema: schema({}),
    parse: parseWith(emptySchema),
    handler: (context) => exportBlogMigrationPackage(context.blog),
  },
  {
    name: "blog.preview_import_package",
    description: "Preview a QuietPress migration package without writing data.",
    scopes: ["migration:write"],
    inputSchema: schema(
      {
        package: {
          type: "object",
          description: "QuietPress export v1 package.",
        },
      },
      ["package"],
    ),
    parse: parseWith(previewImportSchema),
    handler: (context, args) =>
      previewBlogMigrationPackage(
        context.blog,
        (args as z.infer<typeof previewImportSchema>).package,
      ),
  },
  {
    name: "blog.import_package",
    description:
      "Import a QuietPress migration package. Requires confirmation and idempotency key.",
    scopes: ["migration:write"],
    inputSchema: schema(
      {
        package: {
          type: "object",
          description: "QuietPress export v1 package.",
        },
        options: {
          type: "object",
          description: "Migration conflict and media options.",
        },
        confirm: booleanProp("Must be true."),
        idempotency_key: stringProp(
          "Caller-provided unique key for this unsafe action.",
        ),
      },
      ["package", "options", "confirm", "idempotency_key"],
    ),
    parse: parseWith(importPackageSchema),
    handler: (context, args) => {
      const parsed = args as z.infer<typeof importPackageSchema>;
      return importBlogMigrationPackage(
        context.blog,
        parsed.package,
        parsed.options,
      );
    },
  },
  {
    name: "blog.get_analytics_summary",
    description: "Read a compact posts/comments/views summary.",
    scopes: ["analytics:read"],
    inputSchema: schema({}),
    parse: parseWith(emptySchema),
    handler: (context) => getBlogAnalyticsSummary(context.blog),
  },
];

export function listMcpTools(access: McpAccessContext) {
  return MCP_TOOLS.filter((tool) =>
    hasEveryScope(access.scopes, tool.scopes),
  ).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callMcpTool(
  context: McpHandlerContext,
  name: string,
  rawArgs: unknown,
) {
  const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (!hasEveryScope(context.access.scopes, tool.scopes)) {
    throw new McpScopeError(tool.scopes);
  }

  const args = tool.parse(rawArgs);
  return tool.handler(context, args);
}

export const MCP_RESOURCES = [
  {
    uri: "quietpress://posts",
    name: "Posts",
    description: "All posts with status and tag summaries.",
    mimeType: "application/json",
    scopes: ["posts:read"] as McpScope[],
  },
  {
    uri: "quietpress://tags",
    name: "Tags",
    description: "All tags.",
    mimeType: "application/json",
    scopes: ["posts:read"] as McpScope[],
  },
  {
    uri: "quietpress://settings",
    name: "Site settings",
    description: "Public site settings.",
    mimeType: "application/json",
    scopes: ["posts:read"] as McpScope[],
  },
  {
    uri: "quietpress://comments",
    name: "Comments",
    description: "Recent comments for moderation.",
    mimeType: "application/json",
    scopes: ["comments:moderate"] as McpScope[],
  },
  {
    uri: "quietpress://media",
    name: "Media",
    description:
      "Media files from the active storage provider when listing is supported.",
    mimeType: "application/json",
    scopes: ["posts:read"] as McpScope[],
  },
  {
    uri: "quietpress://migration/export",
    name: "Migration export",
    description: "QuietPress export package.",
    mimeType: "application/json",
    scopes: ["migration:read"] as McpScope[],
  },
];

export function listMcpResources(access: McpAccessContext) {
  return MCP_RESOURCES.filter((resource) =>
    hasEveryScope(access.scopes, resource.scopes),
  ).map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  }));
}

export async function readMcpResource(context: McpHandlerContext, uri: string) {
  const resource = MCP_RESOURCES.find((candidate) => candidate.uri === uri);
  if (!resource) throw new Error(`Unknown resource: ${uri}`);
  if (!hasEveryScope(context.access.scopes, resource.scopes)) {
    throw new McpScopeError(resource.scopes);
  }

  let value: unknown;
  if (uri === "quietpress://posts") {
    value = await searchBlogPosts(context.blog, { status: "all", limit: 100 });
  } else if (uri === "quietpress://tags") {
    value = await listBlogTags(context.blog);
  } else if (uri === "quietpress://settings") {
    value = await getBlogSettings(context.blog);
  } else if (uri === "quietpress://comments") {
    value = await listBlogComments(context.blog, { limit: 100 });
  } else if (uri === "quietpress://media") {
    value = await listBlogMedia(context.blog);
  } else if (uri === "quietpress://migration/export") {
    value = await exportBlogMigrationPackage(context.blog);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export const MCP_PROMPTS = [
  {
    name: "draft_post",
    description: "Draft a QuietPress article from a topic and outline.",
    arguments: [
      { name: "topic", description: "Article topic.", required: true },
      { name: "audience", description: "Target audience.", required: false },
    ],
  },
  {
    name: "revise_post",
    description: "Revise an existing article for clarity and structure.",
    arguments: [{ name: "slug", description: "Post slug.", required: true }],
  },
  {
    name: "seo_review",
    description: "Review title, excerpt, headings, and metadata for SEO.",
    arguments: [{ name: "slug", description: "Post slug.", required: true }],
  },
  {
    name: "content_calendar",
    description: "Plan a content calendar for the blog.",
    arguments: [
      { name: "theme", description: "Content theme.", required: true },
    ],
  },
  {
    name: "comment_reply",
    description: "Suggest a reply to a reader comment.",
    arguments: [
      { name: "comment_id", description: "Comment UUID.", required: true },
    ],
  },
];

export function getMcpPrompt(name: string, args: Record<string, unknown>) {
  const prompt = MCP_PROMPTS.find((candidate) => candidate.name === name);
  if (!prompt) throw new Error(`Unknown prompt: ${name}`);

  const textByPrompt: Record<string, string> = {
    draft_post: `Draft a QuietPress blog post about "${String(args.topic || "")}" for ${String(args.audience || "general readers")}. Return title, excerpt, markdown body, SEO title, SEO description, and tag suggestions.`,
    revise_post: `Read quietpress://posts or call blog.get_post for slug "${String(args.slug || "")}", then propose a clearer structure, edits, SEO metadata, and safe update steps.`,
    seo_review: `Review the post "${String(args.slug || "")}" for search intent, title quality, excerpt, headings, internal links, canonical URL, and noindex risk.`,
    content_calendar: `Create a practical QuietPress content calendar around "${String(args.theme || "")}" with article ideas, publishing cadence, and tag suggestions.`,
    comment_reply: `Read comment "${String(args.comment_id || "")}" and suggest a concise, professional reply. Do not publish without explicit approval.`,
  };

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: textByPrompt[name],
        },
      },
    ],
  };
}
