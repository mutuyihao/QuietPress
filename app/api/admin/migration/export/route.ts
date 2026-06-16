import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createQuietPressExport } from "@/lib/migration/export";
import { apiError, apiInternalError, withApiRoute } from "@/lib/api-response";
import { logAdminAction } from "@/lib/audit-log";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";

export const GET = withApiRoute("admin.migration.export.GET", async () => {
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

  try {
    const data = await createQuietPressExport(session.supabase);
    const body = JSON.stringify(data, null, 2);

    await logAdminAction(session.supabase, {
      action: "migration.export",
      entityType: "migration",
      metadata: {
        posts: data.meta.counts.posts,
        tags: data.meta.counts.tags,
        media: data.meta.counts.media,
      },
      userId: session.user.id,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="quietpress-export-v1.json"',
      },
    });
  } catch (error) {
    return apiInternalError("MIGRATION_EXPORT_FAILED", error);
  }
});
