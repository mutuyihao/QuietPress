import { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkRateLimitForRequest } from "@/lib/rate-limit";
import {
  apiError,
  apiInternalError,
  apiOk,
  withApiRoute,
} from "@/lib/api-response";

const MAX_QUERY_LENGTH = 200;

function normalizeSearchQuery(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

export const GET = withApiRoute("search.GET", async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const raw = normalizeSearchQuery(searchParams.get("q") || "");
  const rateLimit = await checkRateLimitForRequest(request, {
    scope: "search",
    maxRequests: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many search requests", 429, {
      headers: { "Retry-After": String(rateLimit.retryAfter) },
    });
  }

  try {
    const supabase = createPublicClient();
    const { data: posts, error } = await supabase.rpc("search_posts", {
      search_query: raw,
      limit_count: 50,
    });

    if (error) {
      return apiInternalError("SEARCH_FAILED", error);
    }

    return apiOk(posts || []);
  } catch (err) {
    return apiInternalError("SEARCH_FAILED", err);
  }
});

export const revalidate = 60;
