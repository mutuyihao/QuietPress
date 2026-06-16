import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logAdminAction } from "@/lib/audit-log";

function isMissingCommentsTable(error: { code?: string }): boolean {
  return error.code === "42P01";
}

export const GET = withApiRoute(
  "admin.comments.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "pending";

    try {
      const supabase = await createClient();

      const { data: comments, error } = await supabase
        .from("comments")
        .select("*, posts!inner(title, slug)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        if (isMissingCommentsTable(error)) {
          return apiOk({
            comments: [],
            message: "Initial database migration has not been applied.",
          });
        }
        return apiInternalError("COMMENTS_LOAD_FAILED", error);
      }

      return apiOk({ comments: comments || [] });
    } catch (err: unknown) {
      return apiInternalError("COMMENTS_LOAD_FAILED", err);
    }
  },
);

export const PATCH = withApiRoute(
  "admin.comments.PATCH",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    try {
      const { id, status } = await request.json();
      if (!id || !["approved", "spam"].includes(status)) {
        return apiError("INVALID_PARAMS", "Invalid params", 400);
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from("comments")
        .update({ status })
        .eq("id", id);

      if (error) return apiInternalError("COMMENT_UPDATE_FAILED", error);

      await logAdminAction(supabase, {
        action: "comment.update_status",
        entityType: "comment",
        entityId: id,
        metadata: { status },
        request,
        userId: session.user.id,
      });

      return apiOk({ updated: true });
    } catch (err: unknown) {
      return apiInternalError("COMMENT_UPDATE_FAILED", err);
    }
  },
);

export const DELETE = withApiRoute(
  "admin.comments.DELETE",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    try {
      const { searchParams } = request.nextUrl;
      const id = searchParams.get("id");
      if (!id) return apiError("ID_REQUIRED", "id required", 400);

      const supabase = await createClient();
      const { error } = await supabase.from("comments").delete().eq("id", id);

      if (error) return apiInternalError("COMMENT_DELETE_FAILED", error);

      await logAdminAction(supabase, {
        action: "comment.delete",
        entityType: "comment",
        entityId: id,
        request,
        userId: session.user.id,
      });

      return apiOk({ deleted: true });
    } catch (err: unknown) {
      return apiInternalError("COMMENT_DELETE_FAILED", err);
    }
  },
);
