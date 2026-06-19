import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logAdminAction } from "@/lib/audit-log";
import { enforceAdminRateLimit } from "@/lib/admin-rate-limit";
import { isUuid, readJsonObject } from "@/lib/api-request";

const COMMENT_STATUSES = ["pending", "approved", "spam"] as const;
const COMMENT_MODERATION_STATUSES = ["approved", "spam"] as const;

type CommentStatus = (typeof COMMENT_STATUSES)[number];
type CommentModerationStatus = (typeof COMMENT_MODERATION_STATUSES)[number];

function isMissingCommentsTable(error: { code?: string }): boolean {
  return error.code === "42P01";
}

function parseCommentStatus(value: string | null): CommentStatus | null {
  const status = value || "pending";
  return COMMENT_STATUSES.includes(status as CommentStatus)
    ? (status as CommentStatus)
    : null;
}

function parseModerationStatus(value: unknown): CommentModerationStatus | null {
  return COMMENT_MODERATION_STATUSES.includes(value as CommentModerationStatus)
    ? (value as CommentModerationStatus)
    : null;
}

export const GET = withApiRoute(
  "admin.comments.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-comments",
      windowMs: 60_000,
      maxRequests: 120,
      message: "Too many comment requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    const { searchParams } = request.nextUrl;
    const status = parseCommentStatus(searchParams.get("status"));
    if (!status) {
      return apiError(
        "INVALID_COMMENT_STATUS",
        "status must be pending, approved, or spam",
        400,
      );
    }

    try {
      const { data: comments, error } = await session.supabase
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

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-comments-moderate",
      windowMs: 60_000,
      maxRequests: 60,
      message: "Too many comment moderation requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    try {
      const body = await readJsonObject(request);
      if (!body) {
        return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
      }

      const id = body.id;
      const status = parseModerationStatus(body.status);
      if (!isUuid(id) || !status) {
        return apiError("INVALID_PARAMS", "Invalid params", 400);
      }

      const { error } = await session.supabase
        .from("comments")
        .update({ status })
        .eq("id", id);

      if (error) return apiInternalError("COMMENT_UPDATE_FAILED", error);

      await logAdminAction(session.supabase, {
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

    const rateLimitError = await enforceAdminRateLimit(session.user.id, {
      scope: "admin-comments-delete",
      windowMs: 60_000,
      maxRequests: 60,
      message: "Too many comment delete requests. Please try again later.",
    });
    if (rateLimitError) return rateLimitError;

    try {
      const { searchParams } = request.nextUrl;
      const id = searchParams.get("id");
      if (!isUuid(id)) return apiError("INVALID_COMMENT_ID", "Invalid id", 400);

      const { error } = await session.supabase
        .from("comments")
        .delete()
        .eq("id", id);

      if (error) return apiInternalError("COMMENT_DELETE_FAILED", error);

      await logAdminAction(session.supabase, {
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
