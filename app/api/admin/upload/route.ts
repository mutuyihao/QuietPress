import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getImageUploadConfig,
  getImageUploadMaxSizeBytes,
} from "@/lib/image-upload-config";
import {
  getStorageProvider,
  getStorageProviderEnvironmentStatus,
  normalizeStorageProvider,
} from "@/lib/storage";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logAdminAction } from "@/lib/audit-log";
import { processImageBuffer } from "@/lib/image-processing";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";

const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

async function getUploadSettings(
  supabase: NonNullable<
    Awaited<ReturnType<typeof getAdminSession>>
  >["supabase"],
) {
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  return {
    uploadConfig: getImageUploadConfig(data),
    storageProvider: normalizeStorageProvider(
      data?.storage_provider || process.env.STORAGE_PROVIDER || "supabase",
    ),
  };
}

export const POST = withApiRoute(
  "admin.upload.POST",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-upload",
      windowMs: 60_000,
      maxRequests: 30,
      message: "Too many uploads. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return apiError("FILE_REQUIRED", "No file provided", 400);
      }

      const { uploadConfig, storageProvider } = await getUploadSettings(
        session.supabase,
      );
      const maxSizeBytes = getImageUploadMaxSizeBytes(uploadConfig);
      const providerStatus =
        getStorageProviderEnvironmentStatus(storageProvider);

      if (!providerStatus.configured) {
        return apiError(
          "STORAGE_NOT_CONFIGURED",
          `${providerStatus.label} is not configured: ${providerStatus.missingEnv.join(", ")}`,
          503,
        );
      }

      const storage = await getStorageProvider(storageProvider);
      const originalBuffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectImageMime(originalBuffer);

      if (!detectedMime) {
        return apiError("INVALID_IMAGE", "Invalid image file", 400);
      }

      if (file.type && detectedMime !== file.type) {
        return apiError(
          "MIME_MISMATCH",
          "Image MIME type does not match file content",
          400,
        );
      }

      const processed = await processImageBuffer(
        originalBuffer,
        detectedMime,
        uploadConfig,
      );

      const err = storage.validate(
        { type: processed.contentType, size: processed.buffer.byteLength },
        { maxSizeBytes, allowedMimeTypes: ALLOWED_IMAGE_MIME },
      );
      if (err) {
        return apiError("IMAGE_VALIDATION_FAILED", err, 400);
      }

      const fileName = `${Date.now()}-${randomUUID()}.${processed.extension}`;

      const result = await storage.upload(
        processed.buffer,
        fileName,
        processed.contentType,
        "posts",
      );

      await logAdminAction(session.supabase, {
        action: "media.upload",
        entityType: "media",
        entityId: result.path,
        metadata: {
          provider: storageProvider,
          contentType: processed.contentType,
          originalSize: file.size,
          uploadedSize: processed.buffer.byteLength,
          optimized: processed.compressed,
        },
        request,
        userId: session.user.id,
      });

      return apiOk({
        url: result.url,
        path: result.path,
        contentType: processed.contentType,
        originalSize: Number(formData.get("originalSize")) || file.size,
        uploadedSize: processed.buffer.byteLength,
        compressed:
          formData.get("compressed") === "true" || processed.compressed,
        maxSizeBytes,
        provider: storageProvider,
      });
    } catch (err: unknown) {
      return apiInternalError("UPLOAD_FAILED", err);
    }
  },
);
