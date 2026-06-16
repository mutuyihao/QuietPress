export type PostStatus = "draft" | "scheduled" | "published" | "archived";

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_markdown: string;
  cover_image_url: string | null;
  status: PostStatus;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  noindex: boolean;
  reading_time_minutes: number;
  views_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface PostWithTags extends Post {
  tags: Tag[];
}

export interface SiteSettings {
  id: string;
  site_name: string;
  site_description: string;
  base_url: string | null;
  author_name: string;
  default_og_image_url: string | null;
  comments_enabled: boolean;
  storage_provider: "supabase" | "s3" | "r2";
  storage_quota_mb: number | null;
  image_upload_max_size_mb: number;
  image_compression_enabled: boolean;
  image_compression_quality: number;
  image_max_width: number;
  image_max_height: number;
  social_links: Record<string, string>;
  about_content: string;
  mcp_enabled: boolean;
  updated_at: string;
}

export interface AdminProfile {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}
