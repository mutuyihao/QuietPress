import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
      scope: 'view-events',
      maxRequests: 120,
      windowMs: 60_000,
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many view events' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const { postId } = await request.json()
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ error: 'Invalid postId' }, { status: 400 })
    }

    const supabase = createPublicClient()
    const now = new Date().toISOString()
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('status', 'published')
      .lte('published_at', now)
      .maybeSingle()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const { error: incrementError } = await supabase.rpc('increment_post_views', { post_id: postId })

    if (incrementError) {
      console.error('Failed to increment post views:', incrementError)
      return NextResponse.json({ error: 'Failed to log view event' }, { status: 500 })
    }

    const { error: eventError } = await supabase.from('view_events').insert({ post_id: postId })

    if (eventError) {
      console.error('Failed to log analytics view event:', eventError)
    }

    return NextResponse.json({ success: true, analyticsLogged: !eventError })
  } catch {
    return NextResponse.json({ error: 'Failed to log view event' }, { status: 500 })
  }
}
