import { randomUUID } from "node:crypto";
import type {
  QuietPressExportMedia,
  QuietPressExportV1,
} from "@/lib/migration/types";
import {
  MAX_IMPORT_JSON_BYTES,
  quietPressExportV1Schema,
} from "@/lib/migration/types";

const MARKDOWN_IMAGE_URL_RE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMAGE_URL_RE = /<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi;
const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeRemoteMediaUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;

  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "[::]" ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  ) {
    return false;
  }

  return true;
}

export function parseMarkdownImageUrls(markdown: string): string[] {
  const urls = new Set<string>();

  for (const match of markdown.matchAll(MARKDOWN_IMAGE_URL_RE)) {
    const rawUrl = match[1]?.trim();
    if (isHttpUrl(rawUrl)) {
      urls.add(rawUrl);
    }
  }

  for (const match of markdown.matchAll(HTML_IMAGE_URL_RE)) {
    const rawUrl = match[2]?.trim();
    if (isHttpUrl(rawUrl)) {
      urls.add(rawUrl);
    }
  }

  return Array.from(urls);
}

export function detectImageMime(buffer: Buffer): string | null {
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

export function getImageExtension(contentType: string): string {
  return MIME_TO_EXT[contentType] ?? "bin";
}

export function getAllowedImportImageMimeTypes(): string[] {
  return ALLOWED_IMAGE_MIME;
}

export function sanitizeFilenameFromUrl(
  value: string,
  contentType: string,
): string {
  const url = new URL(value);
  const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
  const baseName =
    rawName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image";

  return `${Date.now()}-${baseName}-${randomUUID()}.${getImageExtension(contentType)}`;
}

export function addMediaItem(
  mediaByUrl: Map<string, QuietPressExportMedia>,
  item: QuietPressExportMedia,
): void {
  if (!isHttpUrl(item.url)) return;
  if (mediaByUrl.has(item.url)) return;
  mediaByUrl.set(item.url, item);
}

export function remapPackageMediaUrls(
  source: QuietPressExportV1,
  urlMap: Record<string, string>,
): QuietPressExportV1 {
  const replacements = Object.entries(urlMap).filter(
    ([from, to]) => from && to && from !== to,
  );
  if (replacements.length === 0) return source;

  const replaceValue = (value: string | null): string | null => {
    if (!value) return value;
    return replacements.reduce(
      (next, [from, to]) => next.split(from).join(to),
      value,
    );
  };

  return {
    ...source,
    settings: source.settings
      ? {
          ...source.settings,
          default_og_image_url: replaceValue(
            source.settings.default_og_image_url,
          ),
        }
      : null,
    posts: source.posts.map((post) => ({
      ...post,
      content_markdown:
        replaceValue(post.content_markdown) ?? post.content_markdown,
      cover_image_url: replaceValue(post.cover_image_url),
    })),
    media: source.media.map((item) => ({
      ...item,
      url: urlMap[item.url] ?? item.url,
    })),
  };
}

export async function parseQuietPressPackageFromRequest(
  request: Request,
): Promise<QuietPressExportV1> {
  const text = await request.text();
  const bytes = Buffer.byteLength(text, "utf8");

  if (bytes > MAX_IMPORT_JSON_BYTES) {
    throw new Error(
      `Import package is too large. Maximum size is ${Math.round(MAX_IMPORT_JSON_BYTES / 1024 / 1024)}MB.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Import package must be valid JSON.");
  }

  const candidate =
    raw && typeof raw === "object" && "package" in raw
      ? (raw as { package?: unknown }).package
      : raw;

  const parsed = quietPressExportV1Schema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      parsed.error.errors.map((error) => error.message).join("; "),
    );
  }

  return parsed.data;
}

export function parseJsonBody(text: string): unknown {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_IMPORT_JSON_BYTES) {
    throw new Error(
      `Import package is too large. Maximum size is ${Math.round(MAX_IMPORT_JSON_BYTES / 1024 / 1024)}MB.`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(Math.max(concurrency, 1), items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
