import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { checkRateLimitIdentifier } from "@/lib/rate-limit";

function isMissingAnalyticsSchema(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "42883";
}

export const GET = withApiRoute(
  "admin.analytics.GET",
  async (request: NextRequest) => {
    const session = await getAdminSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const rateLimit = await checkRateLimitIdentifier(session.user.id, {
      scope: "admin-analytics",
      windowMs: 60_000,
      maxRequests: 60,
    });

    if (!rateLimit.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many analytics requests. Please try again later.",
        429,
        {
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        },
      );
    }

    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get("days") || "30", 10);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    try {
      const supabase = await createClient();

      // Try to use the RPC function; return an empty state if the database bootstrap has not run.
      const { data: dailyViews, error } = await supabase.rpc(
        "get_daily_views",
        {
          start_date: startStr,
          end_date: endStr,
        },
      );

      if (error) {
        // Fallback: return empty data if view_events table doesn't exist yet
        if (isMissingAnalyticsSchema(error)) {
          return apiOk({
            dailyViews: [],
            topPosts: [],
            message:
              "初始数据库 migration 尚未执行。请检查 Vercel bootstrap 日志，或手动执行 supabase/migrations/202606020001_initial_release.sql。",
          });
        }
        return apiInternalError("ANALYTICS_LOAD_FAILED", error);
      }

      const { data: topPosts } = await supabase.rpc("get_top_posts_daily", {
        start_date: startStr,
        end_date: endStr,
        limit_count: 10,
      });

      return apiOk({
        dailyViews: dailyViews || [],
        topPosts: topPosts || [],
      });
    } catch (err: unknown) {
      return apiInternalError("ANALYTICS_LOAD_FAILED", err);
    }
  },
);
