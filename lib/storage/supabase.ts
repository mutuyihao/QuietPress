import type {
  StorageProvider,
  StoredFile,
  UploadResult,
  UploadValidationOptions,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "blog-images";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface SupabaseUsageRow {
  bucket_id: string | null;
  used_bytes: number | string | null;
  object_count: number | string | null;
  bucket_file_size_limit: number | string | null;
}

function inferContentType(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export class SupabaseStorage implements StorageProvider {
  readonly name = "supabase";

  constructor(private supabase: SupabaseClient) {}

  validate(
    file: { type: string; size: number },
    options?: UploadValidationOptions,
  ): string | null {
    const allowedMimeTypes = options?.allowedMimeTypes ?? ALLOWED_MIME;
    const maxSize = options?.maxSizeBytes ?? MAX_SIZE;
    if (!allowedMimeTypes.includes(file.type)) return "File type not allowed";
    if (file.size > maxSize) {
      return `File too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`;
    }
    return null;
  }

  async upload(
    file: Buffer,
    filename: string,
    contentType: string,
    folder = "posts",
  ): Promise<UploadResult> {
    const filePath = `${folder}/${filename}`;

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { contentType, upsert: false });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    return {
      url: this.getPublicUrl(filePath),
      path: data.path,
    };
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  async getUsage(): Promise<{
    usedBytes: number;
    objectCount: number;
    bucketFileSizeLimitBytes?: number | null;
    source?: string;
  }> {
    const rpcUsage = await this.getUsageFromRpc();
    if (rpcUsage) return rpcUsage;

    let usedBytes = 0;
    let objectCount = 0;

    const walk = async (prefix = ""): Promise<void> => {
      let offset = 0;

      while (true) {
        const { data, error } = await this.supabase.storage
          .from(BUCKET_NAME)
          .list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (error)
          throw new Error(`Supabase usage scan failed: ${error.message}`);
        if (!data || data.length === 0) break;

        for (const item of data) {
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
          const size = Number(item.metadata?.size);

          if (Number.isFinite(size) && size > 0) {
            usedBytes += size;
            objectCount += 1;
          } else if (!item.id) {
            await walk(itemPath);
          }
        }

        if (data.length < 1000) break;
        offset += data.length;
      }
    };

    await walk();
    return { usedBytes, objectCount, source: "supabase-storage-api-scan" };
  }

  private async getUsageFromRpc(): Promise<{
    usedBytes: number;
    objectCount: number;
    bucketFileSizeLimitBytes: number | null;
    source: string;
  } | null> {
    const { data, error } = await this.supabase.rpc(
      "get_storage_bucket_usage",
      {
        _bucket_name: BUCKET_NAME,
      },
    );

    if (error) return null;

    const row = Array.isArray(data)
      ? (data[0] as SupabaseUsageRow | undefined)
      : (data as SupabaseUsageRow | null);

    if (!row) return null;

    return {
      usedBytes: toNullableNumber(row.used_bytes) ?? 0,
      objectCount: toNullableNumber(row.object_count) ?? 0,
      bucketFileSizeLimitBytes: toNullableNumber(row.bucket_file_size_limit),
      source: "supabase-storage-objects",
    };
  }

  async listFiles(): Promise<StoredFile[]> {
    const files: StoredFile[] = [];

    const walk = async (prefix = ""): Promise<void> => {
      let offset = 0;

      while (true) {
        const { data, error } = await this.supabase.storage
          .from(BUCKET_NAME)
          .list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (error)
          throw new Error(`Supabase media scan failed: ${error.message}`);
        if (!data || data.length === 0) break;

        for (const item of data) {
          const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
          const size = Number(item.metadata?.size);

          if (Number.isFinite(size) && size >= 0) {
            files.push({
              path: itemPath,
              url: this.getPublicUrl(itemPath),
              name: item.name,
              size,
              contentType:
                typeof item.metadata?.mimetype === "string"
                  ? item.metadata.mimetype
                  : inferContentType(itemPath),
              lastModified: item.updated_at || item.created_at || null,
            });
          } else if (!item.id) {
            await walk(itemPath);
          }
        }

        if (data.length < 1000) break;
        offset += data.length;
      }
    };

    await walk();
    return files.sort((a, b) =>
      (b.lastModified || "").localeCompare(a.lastModified || ""),
    );
  }
}
