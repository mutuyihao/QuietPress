import { getAdminSession } from "@/lib/admin-auth";
import { createMigrationPreview } from "@/lib/migration/preview";
import { parseQuietPressPackageFromRequest } from "@/lib/migration/utils";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";

export const POST = withApiRoute(
  "admin.migration.preview.POST",
  async (request: Request) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-migration",
      windowMs: 10 * 60_000,
      maxRequests: 5,
      message: "Too many migration requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    let migrationPackage: Awaited<
      ReturnType<typeof parseQuietPressPackageFromRequest>
    >;
    try {
      migrationPackage = await parseQuietPressPackageFromRequest(request);
    } catch {
      return apiError(
        "INVALID_MIGRATION_PREVIEW",
        "导入包格式无效或超过大小限制。",
        400,
      );
    }

    try {
      const preview = await createMigrationPreview(
        session.supabase,
        migrationPackage,
      );
      return apiOk(preview);
    } catch (error) {
      return apiInternalError("MIGRATION_PREVIEW_FAILED", error);
    }
  },
);
