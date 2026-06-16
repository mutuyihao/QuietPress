import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getImageUploadConfig,
  getImageUploadMaxSizeBytes,
  type ImageUploadConfig,
} from "@/lib/image-upload-config";
import { processImageBuffer } from "@/lib/image-processing";
import { getActiveStorage } from "@/lib/storage/active";
import type { StorageProvider } from "@/lib/storage/types";
import type {
  ImportedMediaResult,
  MigrationImportOptions,
  QuietPressExportV1,
} from "@/lib/migration/types";
import {
  detectImageMime,
  getAllowedImportImageMimeTypes,
  isHttpUrl,
  isSafeRemoteMediaUrl,
  mapWithConcurrency,
  parseMarkdownImageUrls,
  remapPackageMediaUrls,
  sanitizeFilenameFromUrl,
} from "@/lib/migration/utils";

interface MediaImportContext {
  provider: StorageProvider;
  maxSizeBytes: number;
  uploadConfig: ImageUploadConfig;
  folder: string;
}

interface QuietPressImportRpcResult {
  settings_imported?: boolean;
  tags_created?: number;
  tags_reused?: number;
  tags_updated?: number;
  posts_created?: number;
  posts_overwritten?: number;
  posts_skipped?: number;
  posts_duplicated?: number;
}

type MediaImportAttempt =
  | { status: "ok"; result: ImportedMediaResult }
  | { status: "failed"; result: ImportedMediaResult };

export interface QuietPressImportResult {
  database: QuietPressImportRpcResult;
  media: {
    uploaded: ImportedMediaResult[];
    failed: ImportedMediaResult[];
    skipped: ImportedMediaResult[];
  };
}

function collectPackageMediaUrls(
  migrationPackage: QuietPressExportV1,
): string[] {
  const urls = new Set<string>();

  for (const item of migrationPackage.media) {
    if (isHttpUrl(item.url)) urls.add(item.url);
  }

  if (migrationPackage.settings?.default_og_image_url) {
    urls.add(migrationPackage.settings.default_og_image_url);
  }

  for (const post of migrationPackage.posts) {
    if (post.cover_image_url) urls.add(post.cover_image_url);
    for (const url of parseMarkdownImageUrls(post.content_markdown)) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

async function fetchMediaBuffer(
  url: string,
  maxSizeBytes: number,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxSizeBytes) {
    throw new Error(
      `Remote file is larger than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxSizeBytes) {
    throw new Error(
      `Remote file is larger than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    );
  }

  const detectedMime = detectImageMime(buffer);
  if (
    !detectedMime ||
    !getAllowedImportImageMimeTypes().includes(detectedMime)
  ) {
    throw new Error("Remote file is not a supported image");
  }

  return { buffer, contentType: detectedMime };
}

async function importOneMedia(
  url: string,
  context: MediaImportContext,
): Promise<ImportedMediaResult> {
  if (!isSafeRemoteMediaUrl(url)) {
    return {
      originalUrl: url,
      error: "Skipped unsafe or non-public media URL",
    };
  }

  const { buffer, contentType } = await fetchMediaBuffer(
    url,
    context.maxSizeBytes,
  );
  const processed = await processImageBuffer(
    buffer,
    contentType,
    context.uploadConfig,
  );
  const validationError = context.provider.validate(
    { type: processed.contentType, size: processed.buffer.byteLength },
    {
      maxSizeBytes: context.maxSizeBytes,
      allowedMimeTypes: getAllowedImportImageMimeTypes(),
    },
  );

  if (validationError) {
    throw new Error(validationError);
  }

  const filename = sanitizeFilenameFromUrl(url, processed.contentType);
  const upload = await context.provider.upload(
    processed.buffer,
    filename,
    processed.contentType,
    context.folder,
  );

  return {
    originalUrl: url,
    importedUrl: upload.url,
    path: upload.path,
  };
}

async function importMedia(
  supabase: SupabaseClient,
  migrationPackage: QuietPressExportV1,
  enabled: boolean,
): Promise<{
  urlMap: Record<string, string>;
  uploaded: ImportedMediaResult[];
  failed: ImportedMediaResult[];
  skipped: ImportedMediaResult[];
  cleanupPaths: string[];
  cleanupProvider: StorageProvider | null;
}> {
  if (!enabled) {
    return {
      urlMap: {},
      uploaded: [],
      failed: [],
      skipped: collectPackageMediaUrls(migrationPackage).map((url) => ({
        originalUrl: url,
        error: "Media import disabled",
      })),
      cleanupPaths: [],
      cleanupProvider: null,
    };
  }

  let activeStorage: Awaited<ReturnType<typeof getActiveStorage>>;
  try {
    activeStorage = await getActiveStorage(supabase);
  } catch (error) {
    return {
      urlMap: {},
      uploaded: [],
      failed: collectPackageMediaUrls(migrationPackage).map((url) => ({
        originalUrl: url,
        error:
          error instanceof Error
            ? error.message
            : "Storage backend is not available",
      })),
      skipped: [],
      cleanupPaths: [],
      cleanupProvider: null,
    };
  }

  const uploadConfig = getImageUploadConfig(activeStorage.settings);
  const maxSizeBytes = getImageUploadMaxSizeBytes(uploadConfig);
  const folder = `migration/${Date.now()}`;
  const context = {
    provider: activeStorage.provider,
    maxSizeBytes,
    uploadConfig,
    folder,
  };

  const urlMap: Record<string, string> = {};
  const uploaded: ImportedMediaResult[] = [];
  const failed: ImportedMediaResult[] = [];
  const skipped: ImportedMediaResult[] = [];
  const cleanupPaths: string[] = [];

  const mediaResults = await mapWithConcurrency<string, MediaImportAttempt>(
    collectPackageMediaUrls(migrationPackage),
    5,
    async (url) => {
      try {
        return {
          status: "ok" as const,
          result: await importOneMedia(url, context),
        };
      } catch (error) {
        const result: ImportedMediaResult = {
          originalUrl: url,
          error: error instanceof Error ? error.message : "Media import failed",
        };
        return {
          status: "failed" as const,
          result,
        };
      }
    },
  );

  for (const { status, result } of mediaResults) {
    if (result.importedUrl && result.path) {
      uploaded.push(result);
      cleanupPaths.push(result.path);
      urlMap[result.originalUrl] = result.importedUrl;
    } else if (status === "failed") {
      failed.push(result);
    } else {
      skipped.push(result);
    }
  }

  return {
    urlMap,
    uploaded,
    failed,
    skipped,
    cleanupPaths,
    cleanupProvider: activeStorage.provider,
  };
}

async function cleanupUploadedMedia(
  provider: StorageProvider | null,
  paths: string[],
): Promise<void> {
  if (!provider || paths.length === 0) return;

  await Promise.allSettled(paths.map((path) => provider.delete(path)));
}

export async function importQuietPressPackage(
  supabase: SupabaseClient,
  migrationPackage: QuietPressExportV1,
  options: MigrationImportOptions,
): Promise<QuietPressImportResult> {
  const media = await importMedia(
    supabase,
    migrationPackage,
    options.importMedia,
  );
  const remappedPackage = remapPackageMediaUrls(migrationPackage, media.urlMap);

  const choices = {
    postConflicts: options.postActions,
    tagConflicts: options.tagActions,
  };

  const { data, error } = await supabase.rpc("import_quietpress_export_v1", {
    payload: remappedPackage,
    choices,
    import_settings: options.importSettings,
  });

  if (error) {
    await cleanupUploadedMedia(media.cleanupProvider, media.cleanupPaths);
    throw new Error(error.message);
  }

  return {
    database: (data || {}) as QuietPressImportRpcResult,
    media: {
      uploaded: media.uploaded,
      failed: media.failed,
      skipped: media.skipped,
    },
  };
}
