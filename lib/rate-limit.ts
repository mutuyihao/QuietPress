import type { NextRequest } from 'next/server'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_REQUESTS = 5
const MAX_ENTRIES = 10_000

interface RateLimitOptions {
  scope?: string
  windowMs?: number
  maxRequests?: number
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export function checkRateLimit(
  identifier: string,
  {
    scope = 'default',
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
  }: RateLimitOptions = {},
): { allowed: boolean; remaining: number; resetAt: number; retryAfter: number } {
  const now = Date.now()
  const key = `${scope}:${identifier}`
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    pruneRateLimitStore(now)
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      retryAfter: 0,
    }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    }
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    retryAfter: 0,
  }
}

function pruneRateLimitStore(now = Date.now()): void {
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }

  if (rateLimitStore.size <= MAX_ENTRIES) return

  const overflow = rateLimitStore.size - MAX_ENTRIES
  let deleted = 0
  for (const key of rateLimitStore.keys()) {
    rateLimitStore.delete(key)
    deleted++
    if (deleted >= overflow) break
  }
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => pruneRateLimitStore(), 300_000)
}
