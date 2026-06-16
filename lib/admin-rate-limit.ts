import { apiError } from "@/lib/api-response";
import { checkRateLimitIdentifier } from "@/lib/rate-limit";

interface AdminRateLimitOptions {
  scope: string;
  windowMs: number;
  maxRequests: number;
  message: string;
}

export async function enforceAdminRateLimit(
  userId: string,
  options: AdminRateLimitOptions,
) {
  const rateLimit = await checkRateLimitIdentifier(userId, {
    scope: options.scope,
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
  });

  if (rateLimit.allowed) return null;

  return apiError("RATE_LIMITED", options.message, 429, {
    headers: { "Retry-After": String(rateLimit.retryAfter) },
  });
}
