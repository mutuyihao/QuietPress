import { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import sanitizeHtml from "sanitize-html";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { getClientAddress, hashSensitiveValue } from "@/lib/privacy";

const MAX_AUTHOR_NAME_LENGTH = 80;
const MAX_AUTHOR_EMAIL_LENGTH = 320;
const MAX_COMMENT_LENGTH = 5000;

interface PublicComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
  children: PublicComment[];
}

async function getCommentsEnabled(
  supabase: ReturnType<typeof createPublicClient>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("comments_enabled")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.message.includes("comments_enabled")) {
      return true;
    }
    throw error;
  }

  return data?.comments_enabled ?? true;
}

function buildThreadedComments(
  comments: Omit<PublicComment, "children">[],
): PublicComment[] {
  const threaded: PublicComment[] = [];
  const childrenMap = new Map<string, PublicComment[]>();

  for (const comment of comments) {
    const item = { ...comment, children: [] };
    if (comment.parent_id) {
      const children = childrenMap.get(comment.parent_id) || [];
      children.push(item);
      childrenMap.set(comment.parent_id, children);
    } else {
      threaded.push(item);
    }
  }

  const attachChildren = (items: PublicComment[]) => {
    for (const item of items) {
      item.children = childrenMap.get(item.id) || [];
      attachChildren(item.children);
    }
  };
  attachChildren(threaded);

  return threaded;
}

function isMissingCommentTreeRpc(error: {
  message?: string;
  code?: string;
}): boolean {
  return (
    error.code === "42883" ||
    Boolean(error.message?.includes("get_public_comment_tree"))
  );
}

// GET comments for a post
export const GET = withApiRoute(
  "comments.GET",
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const postId = searchParams.get("postId");

    if (!postId) {
      return apiError("POST_ID_REQUIRED", "postId required", 400);
    }

    try {
      const supabase = createPublicClient();
      const commentsEnabled = await getCommentsEnabled(supabase);

      if (!commentsEnabled) {
        return apiOk({ comments: [], commentsEnabled: false });
      }

      const now = new Date().toISOString();

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("id")
        .eq("id", postId)
        .eq("status", "published")
        .lte("published_at", now)
        .maybeSingle();

      if (postError) {
        return apiInternalError(
          "COMMENTS_LOAD_FAILED",
          postError,
          "Failed to load comments",
        );
      }

      if (!post) {
        return apiError("POST_NOT_FOUND", "Post not found", 404);
      }

      const { data: commentTree, error: treeError } = await supabase.rpc(
        "get_public_comment_tree",
        { target_post_id: postId },
      );

      if (!treeError) {
        return apiOk({
          comments: Array.isArray(commentTree) ? commentTree : [],
        });
      }

      if (!isMissingCommentTreeRpc(treeError)) {
        return apiInternalError(
          "COMMENTS_LOAD_FAILED",
          treeError,
          "Failed to load comments",
        );
      }

      const { data: comments, error } = await supabase
        .from("comments")
        .select("id, post_id, parent_id, author_name, content, created_at")
        .eq("post_id", postId)
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      if (error) {
        if (error.code === "42P01") {
          return apiOk({
            comments: [],
            message: "Initial database migration has not been applied.",
          });
        }
        return apiInternalError(
          "COMMENTS_LOAD_FAILED",
          error,
          "Failed to load comments",
        );
      }

      return apiOk({ comments: buildThreadedComments(comments || []) });
    } catch (err) {
      return apiInternalError(
        "COMMENTS_LOAD_FAILED",
        err,
        "Failed to load comments",
      );
    }
  },
);

// POST a new comment
export const POST = withApiRoute(
  "comments.POST",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    try {
      const rateLimit = await checkRateLimitForRequest(request, {
        scope: "comments",
        maxRequests: 5,
        windowMs: 10 * 60_000,
      });

      if (!rateLimit.allowed) {
        return apiError(
          "RATE_LIMITED",
          "Too many comments submitted. Please try again later.",
          429,
          {
            headers: { "Retry-After": String(rateLimit.retryAfter) },
          },
        );
      }

      const body = await request.json();
      const { postId, parentId, authorName, authorEmail, content } = body;

      if (
        typeof postId !== "string" ||
        !postId ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        return apiError(
          "INVALID_COMMENT_INPUT",
          "postId and content are required",
          400,
        );
      }

      if (content.length > MAX_COMMENT_LENGTH) {
        return apiError(
          "COMMENT_TOO_LONG",
          "Comment too long (max 5000 characters)",
          400,
        );
      }

      const normalizedAuthorName =
        typeof authorName === "string"
          ? authorName.trim().slice(0, MAX_AUTHOR_NAME_LENGTH)
          : "";
      const normalizedAuthorEmail =
        typeof authorEmail === "string"
          ? authorEmail.trim().slice(0, MAX_AUTHOR_EMAIL_LENGTH)
          : "";
      const normalizedParentId =
        typeof parentId === "string" && parentId ? parentId : null;

      const sanitizedContent = sanitizeHtml(content.trim(), {
        allowedTags: [],
        allowedAttributes: {},
      });

      if (!sanitizedContent) {
        return apiError(
          "COMMENT_EMPTY",
          "Comment content is empty after sanitization",
          400,
        );
      }

      const ipHash = hashSensitiveValue(
        getClientAddress(request),
        "comment-ip",
      );

      const supabase = createPublicClient();
      const commentsEnabled = await getCommentsEnabled(supabase);

      if (!commentsEnabled) {
        return apiError("COMMENTS_DISABLED", "Comments are disabled", 403);
      }

      const now = new Date().toISOString();

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("id")
        .eq("id", postId)
        .eq("status", "published")
        .lte("published_at", now)
        .maybeSingle();

      if (postError || !post) {
        return apiError("POST_NOT_FOUND", "Post not found", 404);
      }

      if (normalizedParentId) {
        const { data: parentComment, error: parentError } = await supabase
          .from("comments")
          .select("id")
          .eq("id", normalizedParentId)
          .eq("post_id", postId)
          .eq("status", "approved")
          .maybeSingle();

        if (parentError || !parentComment) {
          return apiError(
            "INVALID_PARENT_COMMENT",
            "Invalid parent comment",
            400,
          );
        }
      }

      const { data: comment, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          parent_id: normalizedParentId,
          author_name: normalizedAuthorName || "Anonymous",
          author_email: normalizedAuthorEmail || null,
          content: sanitizedContent,
          status: "pending",
          ip_hash: ipHash,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "42P01") {
          return apiError(
            "MIGRATION_REQUIRED",
            "Comment system not yet available. Initial database migration needed.",
            503,
          );
        }
        return apiInternalError(
          "COMMENT_SUBMIT_FAILED",
          error,
          "Failed to submit comment",
        );
      }

      return apiOk({ comment });
    } catch (err) {
      return apiInternalError(
        "COMMENT_SUBMIT_FAILED",
        err,
        "Failed to submit comment",
      );
    }
  },
);
