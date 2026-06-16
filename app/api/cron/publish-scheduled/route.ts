import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";
import { revalidatePostContent } from "@/lib/blog/revalidation";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function isValidCronAuthorization(
  authHeader: string | null,
  cronSecret: string,
): boolean {
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;
  return timingSafeEqual(sha256(match[1]), sha256(cronSecret));
}

export const GET = withApiRoute(
  "cron.publish-scheduled.GET",
  async (request: Request) => {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !isValidCronAuthorization(authHeader, cronSecret)) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    try {
      const supabase = createServiceClient();

      const { data: scheduledPosts, error: fetchError } = await supabase
        .from("posts")
        .select("id, title, slug, published_at")
        .eq("status", "scheduled")
        .lte("published_at", new Date().toISOString());

      if (fetchError) {
        return apiInternalError("SCHEDULED_FETCH_FAILED", fetchError);
      }

      if (!scheduledPosts || scheduledPosts.length === 0) {
        return apiOk({
          published: 0,
          message: "No scheduled posts to publish",
        });
      }

      const { error: updateError } = await supabase
        .from("posts")
        .update({ status: "published" })
        .in(
          "id",
          scheduledPosts.map((p) => p.id),
        );

      if (updateError) {
        return apiInternalError("SCHEDULED_PUBLISH_FAILED", updateError);
      }

      revalidatePostContent(...scheduledPosts.map((post) => post.slug));

      await logAdminAction(supabase, {
        action: "cron.publish_scheduled",
        entityType: "post",
        metadata: {
          published: scheduledPosts.length,
          postIds: scheduledPosts.map((post) => post.id),
        },
        request,
        userId: null,
      });

      return apiOk({
        published: scheduledPosts.length,
        posts: scheduledPosts.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
        })),
      });
    } catch (err: unknown) {
      return apiInternalError("SCHEDULED_PUBLISH_FAILED", err);
    }
  },
);
