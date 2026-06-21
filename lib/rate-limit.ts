import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientFingerprint } from "@/lib/privacy";
import { logger } from "@/lib/logger";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;
const DURABLE_RETRY_AFTER_MS = 60_000;
const FINGERPRINT_UNAVAILABLE_IDENTIFIER = "fingerprint-unavailable";

let durableUnavailableUntil = 0;
let durableFallbackActive = false;
let fingerprintFallbackActive = false;

interface RateLimitOptions {
  scope?: string;
  windowMs?: number;
  maxRequests?: number;
}

export function checkRateLimit(
  identifier: string,
  {
    scope = "default",
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
  }: RateLimitOptions = {},
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
} {
  const now = Date.now();
  const key = `${scope}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    pruneRateLimitStore(now);
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      retryAfter: 0,
    };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    retryAfter: 0,
  };
}

export async function checkRateLimitForRequest(
  request: NextRequest | Request,
  options: RateLimitOptions = {},
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}> {
  try {
    const identifier = getClientFingerprint(request);
    if (fingerprintFallbackActive) {
      fingerprintFallbackActive = false;
      logger.warn("client fingerprint restored for rate limiting");
    }
    return checkRateLimitIdentifier(identifier, options);
  } catch (error) {
    if (!fingerprintFallbackActive) {
      fingerprintFallbackActive = true;
      logger.warn("client fingerprint unavailable; using in-memory fallback", {
        err: error,
      });
    }

    return checkRateLimit(FINGERPRINT_UNAVAILABLE_IDENTIFIER, options);
  }
}

export async function checkRateLimitIdentifier(
  identifier: string,
  options: RateLimitOptions = {},
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}> {
  const scope = options.scope || "default";
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  if (now < durableUnavailableUntil) {
    return checkRateLimit(identifier, { scope, windowMs, maxRequests });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      rate_key: `${scope}:${identifier}`,
      window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      max_requests: maxRequests,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      const resetAtMs = new Date(row.reset_at).getTime();
      return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining ?? 0),
        resetAt: Number.isFinite(resetAtMs) ? resetAtMs : Date.now() + windowMs,
        retryAfter: Number(row.retry_after ?? 0),
      };
    }

    if (durableFallbackActive) {
      durableFallbackActive = false;
      logger.warn("durable rate limit restored");
    }
  } catch (error) {
    durableUnavailableUntil = Date.now() + DURABLE_RETRY_AFTER_MS;
    if (!durableFallbackActive) {
      durableFallbackActive = true;
      logger.warn("durable rate limit unavailable; using in-memory fallback", {
        err: error,
      });
    }
  }

  return checkRateLimit(identifier, { scope, windowMs, maxRequests });
}

function pruneRateLimitStore(now = Date.now()): void {
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size <= MAX_ENTRIES) return;

  const overflow = rateLimitStore.size - MAX_ENTRIES;
  let deleted = 0;
  for (const key of rateLimitStore.keys()) {
    rateLimitStore.delete(key);
    deleted++;
    if (deleted >= overflow) break;
  }
}
