import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";
import { isUuid } from "@/lib/api-request";

function isMissingRevisionsTable(error: { code?: string }): boolean {
  return error.code === "42P01";
}

export const GET = withApiRoute(
  "admin.revisions.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-revisions",
      windowMs: 60_000,
      maxRequests: 120,
      message: "Too many revision requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    const { searchParams } = request.nextUrl;
    const postId = searchParams.get("postId");

    if (!isUuid(postId)) {
      return apiError("INVALID_POST_ID", "Invalid postId", 400);
    }

    try {
      const { data: revisions, error } = await session.supabase
        .from("post_revisions")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (isMissingRevisionsTable(error)) {
          return apiOk({
            revisions: [],
            message: "Migration not yet applied.",
          });
        }
        return apiInternalError("REVISIONS_LOAD_FAILED", error);
      }

      return apiOk({ revisions: revisions || [] });
    } catch (err: unknown) {
      return apiInternalError("REVISIONS_LOAD_FAILED", err);
    }
  },
);
