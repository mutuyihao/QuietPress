import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const MAX_QUERY_LENGTH = 200

function normalizeSearchQuery(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = normalizeSearchQuery(searchParams.get('q') || '')
  const rateLimit = checkRateLimit(getClientIp(request), {
    scope: 'search',
    maxRequests: 60,
    windowMs: 60_000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many search requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    )
  }

  try {
    const supabase = createPublicClient()
    const { data: posts, error } = await supabase.rpc('search_posts', {
      search_query: raw,
      limit_count: 50,
    })

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json(posts || [])
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

export const revalidate = 60
