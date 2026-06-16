import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getImageUploadConfig,
  getImageUploadMaxSizeBytes,
} from "@/lib/image-upload-config";
import {
  detectImageMime,
  getAllowedImportImageMimeTypes,
  isSafeRemoteMediaUrl,
} from "@/lib/migration/utils";
import { getActiveStorage } from "@/lib/storage/active";
import { processImageBuffer } from "@/lib/image-processing";

async function fetchRemoteImage(url: string, maxSizeBytes: number) {
  if (!isSafeRemoteMediaUrl(url)) {
    throw new Error("URL must be a public HTTP(S) image URL");
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxSizeBytes) {
    throw new Error("Remote image is larger than the configured limit");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxSizeBytes) {
    throw new Error("Remote image is larger than the configured limit");
  }

  const contentType = detectImageMime(buffer);
  if (!contentType || !getAllowedImportImageMimeTypes().includes(contentType)) {
    throw new Error("Remote file is not a supported image");
  }

  return { buffer, contentType };
}

export async function uploadBlogMediaFromUrl(
  context: { supabase: SupabaseClient },
  input: { url: string; folder?: string },
) {
  const activeStorage = await getActiveStorage(context.supabase);
  const uploadConfig = getImageUploadConfig(activeStorage.settings);
  const maxSizeBytes = getImageUploadMaxSizeBytes(uploadConfig);
  const { buffer, contentType } = await fetchRemoteImage(
    input.url,
    maxSizeBytes,
  );
  const processed = await processImageBuffer(buffer, contentType, uploadConfig);
  const validationError = activeStorage.provider.validate(
    { type: processed.contentType, size: processed.buffer.byteLength },
    { maxSizeBytes, allowedMimeTypes: getAllowedImportImageMimeTypes() },
  );

  if (validationError) throw new Error(validationError);

  const filename = `${Date.now()}-${randomUUID()}.${processed.extension}`;
  const result = await activeStorage.provider.upload(
    processed.buffer,
    filename,
    processed.contentType,
    input.folder || "mcp",
  );

  return {
    originalUrl: input.url,
    url: result.url,
    path: result.path,
    contentType: processed.contentType,
    size: processed.buffer.byteLength,
    provider: activeStorage.providerName,
  };
}
