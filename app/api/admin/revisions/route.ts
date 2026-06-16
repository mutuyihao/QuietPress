import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";

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

    const { searchParams } = request.nextUrl;
    const postId = searchParams.get("postId");

    if (!postId) {
      return apiError("POST_ID_REQUIRED", "postId required", 400);
    }

    try {
      const supabase = await createClient();

      const { data: revisions, error } = await supabase
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
