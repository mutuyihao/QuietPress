import { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { validateSameOriginRequest } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { isUuid, readJsonObject } from "@/lib/api-request";

async function checkViewEventRateLimit(request: NextRequest) {
  try {
    return await checkRateLimitForRequest(request, {
      scope: "view-events",
      maxRequests: 120,
      windowMs: 60_000,
    });
  } catch (err) {
    logger.warn("view event rate limit unavailable; allowing event", { err });
    return null;
  }
}

function isLegacyIncrementResult(value: unknown): boolean {
  return value === null || value === undefined;
}

export const POST = withApiRoute(
  "view-event.POST",
  async (request: NextRequest) => {
    const csrfError = validateSameOriginRequest(request);
    if (csrfError) return csrfError;

    try {
      const rateLimit = await checkViewEventRateLimit(request);

      if (rateLimit && !rateLimit.allowed) {
        return apiError("RATE_LIMITED", "Too many view events", 429, {
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        });
      }

      const body = await readJsonObject(request);
      if (!body) {
        return apiError("INVALID_JSON", "Request body must be valid JSON", 400);
      }

      const postId = body.postId;
      if (!isUuid(postId)) {
        return apiError("INVALID_POST_ID", "Invalid postId", 400);
      }

      const supabase = createPublicClient();
      const { data: found, error: incrementError } = await supabase.rpc(
        "increment_post_views",
        { post_id: postId },
      );

      if (incrementError) {
        logger.warn("view event increment failed", {
          err: incrementError,
          postId,
        });

        return apiOk({
          analyticsLogged: false,
          viewsIncremented: false,
        });
      }

      if (found === false) {
        return apiError("POST_NOT_FOUND", "Post not found", 404);
      }

      const { error: eventError } = await supabase
        .from("view_events")
        .insert({ post_id: postId });

      if (eventError) {
        logger.warn("view event analytics insert failed", {
          err: eventError,
          postId,
        });
      }

      return apiOk({
        analyticsLogged: !eventError,
        viewsIncremented: found === true || isLegacyIncrementResult(found),
      });
    } catch (err) {
      return apiInternalError(
        "VIEW_EVENT_FAILED",
        err,
        "Failed to log view event",
      );
    }
  },
);
