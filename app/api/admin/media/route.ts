import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getActiveStorage } from "@/lib/storage/active";
import { getStorageDashboard } from "@/lib/storage/dashboard";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logAdminAction } from "@/lib/audit-log";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";
import { readJsonObject } from "@/lib/api-request";

const MAX_MEDIA_QUERY_LENGTH = 100;
const MEDIA_KINDS = ["all", "image"] as const;

type MediaKind = (typeof MEDIA_KINDS)[number];

function isSafeStoragePath(path: string): boolean {
  return (
    Boolean(path) &&
    path.length <= 1024 &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.endsWith("/")
  );
}

function parseMediaKind(value: string | null): MediaKind | null {
  const kind = value || "all";
  return MEDIA_KINDS.includes(kind as MediaKind) ? (kind as MediaKind) : null;
}

function parseMediaQuery(value: string | null): string | null {
  const query = value?.trim().toLowerCase() || "";
  if (query.length > MAX_MEDIA_QUERY_LENGTH) return null;
  return query;
}

export const GET = withApiRoute(
  "admin.media.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-media",
      windowMs: 60_000,
      maxRequests: 60,
      message: "Too many media requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = request.nextUrl;
      const query = parseMediaQuery(searchParams.get("q"));
      const kind = parseMediaKind(searchParams.get("kind"));

      if (query === null) {
        return apiError(
          "INVALID_MEDIA_QUERY",
          `q must be ${MAX_MEDIA_QUERY_LENGTH} characters or fewer`,
          400,
        );
      }

      if (!kind) {
        return apiError("INVALID_MEDIA_KIND", "kind must be all or image", 400);
      }

      const { providerName, provider, settings } = await getActiveStorage(
        session.supabase,
      );

      if (!provider.listFiles) {
        return apiError(
          "MEDIA_LIST_UNSUPPORTED",
          "Current storage provider does not support media listing",
          501,
        );
      }

      let files = await provider.listFiles();

      if (kind === "image") {
        files = files.filter((file) => file.contentType?.startsWith("image/"));
      }

      if (query) {
        files = files.filter(
          (file) =>
            file.path.toLowerCase().includes(query) ||
            file.name.toLowerCase().includes(query),
        );
      }

      const usage = await getStorageDashboard(settings);

      return apiOk({ provider: providerName, files, usage });
    } catch (err) {
      return apiInternalError("MEDIA_LOAD_FAILED", err);
    }
  },
);

export const DELETE = withApiRoute(
  "admin.media.DELETE",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-media-delete",
      windowMs: 60_000,
      maxRequests: 30,
      message: "Too many media delete requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    try {
      const body = await readJsonObject(request);
      if (!body) {
        return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
      }

      const path =
        "path" in body && typeof body.path === "string" ? body.path : "";

      if (!isSafeStoragePath(path)) {
        return apiError("INVALID_STORAGE_PATH", "Invalid storage path", 400);
      }

      const { providerName, provider } = await getActiveStorage(
        session.supabase,
      );
      await provider.delete(path);

      await logAdminAction(session.supabase, {
        action: "media.delete",
        entityType: "media",
        entityId: path,
        metadata: { provider: providerName },
        request,
        userId: session.user.id,
      });

      return apiOk({ provider: providerName, deleted: true });
    } catch (err) {
      return apiInternalError("MEDIA_DELETE_FAILED", err);
    }
  },
);
