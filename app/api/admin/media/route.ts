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

function isSafeStoragePath(path: string): boolean {
  return (
    Boolean(path) &&
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.endsWith("/")
  );
}

export const GET = withApiRoute(
  "admin.media.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    try {
      const { searchParams } = request.nextUrl;
      const query = searchParams.get("q")?.trim().toLowerCase() || "";
      const kind = searchParams.get("kind") || "all";
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

    try {
      const body = await request.json();
      const path = typeof body.path === "string" ? body.path : "";

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
