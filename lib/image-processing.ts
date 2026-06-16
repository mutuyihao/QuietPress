import type { ImageUploadConfig } from "@/lib/image-upload-config";
import { logger } from "@/lib/logger";

const SERVER_COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ProcessedImageBuffer {
  buffer: Buffer;
  contentType: string;
  extension: string;
  compressed: boolean;
}

export function getImageExtension(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function processImageBuffer(
  buffer: Buffer,
  contentType: string,
  config: ImageUploadConfig,
): Promise<ProcessedImageBuffer> {
  if (
    !config.compressionEnabled ||
    !SERVER_COMPRESSIBLE_TYPES.has(contentType)
  ) {
    return {
      buffer,
      contentType,
      extension: getImageExtension(contentType),
      compressed: false,
    };
  }

  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(buffer, { failOn: "none" });
    const metadata = await image.metadata();
    const shouldResize = Boolean(
      (metadata.width && metadata.width > config.maxWidth) ||
      (metadata.height && metadata.height > config.maxHeight),
    );

    const pipeline = shouldResize
      ? image.resize({
          width: config.maxWidth,
          height: config.maxHeight,
          fit: "inside",
          withoutEnlargement: true,
        })
      : image;

    const output = await pipeline
      .webp({ quality: config.compressionQuality })
      .toBuffer();

    if (output.byteLength >= buffer.byteLength && !shouldResize) {
      return {
        buffer,
        contentType,
        extension: getImageExtension(contentType),
        compressed: false,
      };
    }

    return {
      buffer: output,
      contentType: "image/webp",
      extension: "webp",
      compressed: true,
    };
  } catch (error) {
    logger.warn("server image optimization skipped", {
      err: error,
      contentType,
    });
    return {
      buffer,
      contentType,
      extension: getImageExtension(contentType),
      compressed: false,
    };
  }
}
