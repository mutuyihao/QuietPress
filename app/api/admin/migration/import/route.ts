import { getAdminSession } from "@/lib/admin-auth";
import { importQuietPressPackage } from "@/lib/migration/import";
import { migrationImportRequestSchema } from "@/lib/migration/types";
import { parseJsonBody } from "@/lib/migration/utils";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logAdminAction } from "@/lib/audit-log";
import { revalidateAllContent } from "@/lib/blog/revalidation";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = withApiRoute(
  "admin.migration.import.POST",
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

    const rawText = await request.text();
    let raw: unknown;
    try {
      raw = parseJsonBody(rawText);
    } catch {
      return apiError(
        "INVALID_MIGRATION_IMPORT",
        "导入包必须是有效 JSON，且不能超过大小限制。",
        400,
      );
    }

    const parsed = migrationImportRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(
        "INVALID_MIGRATION_IMPORT",
        parsed.error.errors.map((error) => error.message).join("; "),
        400,
      );
    }

    try {
      const result = await importQuietPressPackage(
        session.supabase,
        parsed.data.package,
        parsed.data.options,
      );

      revalidateAllContent();

      await logAdminAction(session.supabase, {
        action: "migration.import",
        entityType: "migration",
        metadata: { result },
        request,
        userId: session.user.id,
      });

      return apiOk({ result });
    } catch (error) {
      return apiInternalError("MIGRATION_IMPORT_FAILED", error);
    }
  },
);
