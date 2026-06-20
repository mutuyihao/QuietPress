import type {
  ArchivePost,
  PostWithTags,
  Tag,
  TagWithPostCount,
  SiteSettings,
  PostStatus,
} from "@/lib/types";

export interface CreatePostInput {
  title: string;
  slug: string;
  excerpt: string | null;
  contentMarkdown: string;
  coverImageUrl: string | null;
  status: PostStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  readingTimeMinutes: number;
  publishedAt: string | null;
  authorId: string;
  tagIds: string[];
}

export interface UpdatePostInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  contentMarkdown?: string;
  coverImageUrl?: string | null;
  status?: PostStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
  readingTimeMinutes?: number;
  publishedAt?: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type SiteSettingsUpdateInput = Partial<Omit<SiteSettings, "id">>;

export interface PostRepository {
  list(
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedResult<PostWithTags>>;
  listAdmin(
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedResult<PostWithTags>>;
  listAll(): Promise<PostWithTags[]>;
  listArchive(): Promise<ArchivePost[]>;
  listPublishedSlugs(): Promise<string[]>;
  findSlugsByPrefix(prefix: string, excludingId?: string): Promise<string[]>;
  getBySlug(slug: string): Promise<PostWithTags | null>;
  getBySlugAny(slug: string): Promise<PostWithTags | null>;
  getById(id: string): Promise<PostWithTags | null>;
  listByTag(tagSlug: string): Promise<PostWithTags[]>;
  search(query: string): Promise<PostWithTags[]>;
  searchAdmin(
    query: string,
    status?: PostStatus | "all",
    limit?: number,
  ): Promise<PostWithTags[]>;
  create(input: CreatePostInput): Promise<{ id: string }>;
  update(id: string, input: UpdatePostInput): Promise<void>;
  addSlugRedirect(postId: string, slug: string): Promise<void>;
  delete(id: string): Promise<{ slug: string | null }>;
  updateStatus(ids: string[], status: PostStatus): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  incrementViews(id: string): Promise<void>;
  setTags(postId: string, tagIds: string[]): Promise<void>;
  getSlug(id: string): Promise<string | null>;
  saveRevision(
    postId: string,
    data: {
      title: string;
      contentMarkdown: string;
      excerpt: string | null;
      userId: string;
    },
  ): Promise<void>;
}

export interface TagRepository {
  list(): Promise<Tag[]>;
  listWithPostCounts(): Promise<TagWithPostCount[]>;
  getBySlug(slug: string): Promise<Tag | null>;
  create(name: string, slug: string): Promise<Tag>;
  update(id: string, name: string, slug: string): Promise<Tag>;
  delete(id: string): Promise<{ slug: string | null }>;
}

export interface SettingsRepository {
  get(): Promise<SiteSettings | null>;
  upsert(data: SiteSettingsUpdateInput): Promise<void>;
}

export interface Repositories {
  posts: PostRepository;
  tags: TagRepository;
  settings: SettingsRepository;
}
