import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import sanitizeHtml from 'sanitize-html'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const MAX_AUTHOR_NAME_LENGTH = 80
const MAX_AUTHOR_EMAIL_LENGTH = 320
const MAX_COMMENT_LENGTH = 5000

async function getCommentsEnabled(supabase: ReturnType<typeof createPublicClient>): Promise<boolean> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('comments_enabled')
    .eq('id', 'main')
    .maybeSingle()

  if (error) {
    if (error.code === '42703' || error.message.includes('comments_enabled')) {
      return true
    }
    throw error
  }

  return data?.comments_enabled ?? true
}

// GET comments for a post
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  try {
    const supabase = createPublicClient()
    const commentsEnabled = await getCommentsEnabled(supabase)

    if (!commentsEnabled) {
      return NextResponse.json({ comments: [], commentsEnabled: false })
    }

    const now = new Date().toISOString()

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('status', 'published')
      .lte('published_at', now)
      .maybeSingle()

    if (postError) {
      return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })

    if (error) {
      if (error.message.includes('comments')) {
        return NextResponse.json({ comments: [], message: 'Initial database migration has not been applied.' })
      }
      return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
    }

    // Build threaded structure
    const threaded: Record<string, unknown>[] = []
    const childrenMap = new Map<string, Record<string, unknown>[]>()
    ;(comments || []).forEach((c) => {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) || []
        arr.push(c)
        childrenMap.set(c.parent_id, arr)
      } else {
        threaded.push({ ...c, children: [] })
      }
    })

    const attachChildren = (items: Record<string, unknown>[]) => {
      items.forEach((item) => {
        (item as Record<string, unknown>).children = childrenMap.get(item.id as string) || []
        attachChildren(item.children as Record<string, unknown>[])
      })
    }
    attachChildren(threaded)

    return NextResponse.json({ comments: threaded })
  } catch {
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

// POST a new comment
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
      scope: 'comments',
      maxRequests: 5,
      windowMs: 10 * 60_000,
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many comments submitted. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const body = await request.json()
    const { postId, parentId, authorName, authorEmail, content } = body

    if (typeof postId !== 'string' || !postId || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'postId and content are required' }, { status: 400 })
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json({ error: 'Comment too long (max 5000 characters)' }, { status: 400 })
    }

    const normalizedAuthorName = typeof authorName === 'string'
      ? authorName.trim().slice(0, MAX_AUTHOR_NAME_LENGTH)
      : ''
    const normalizedAuthorEmail = typeof authorEmail === 'string'
      ? authorEmail.trim().slice(0, MAX_AUTHOR_EMAIL_LENGTH)
      : ''
    const normalizedParentId = typeof parentId === 'string' && parentId ? parentId : null

    const sanitizedContent = sanitizeHtml(content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    })

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Comment content is empty after sanitization' }, { status: 400 })
    }

    const ip = getClientIp(request)

    const supabase = createPublicClient()
    const commentsEnabled = await getCommentsEnabled(supabase)

    if (!commentsEnabled) {
      return NextResponse.json({ error: 'Comments are disabled' }, { status: 403 })
    }

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

    if (normalizedParentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id')
        .eq('id', normalizedParentId)
        .eq('post_id', postId)
        .eq('status', 'approved')
        .maybeSingle()

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
      }
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        parent_id: normalizedParentId,
        author_name: normalizedAuthorName || 'Anonymous',
        author_email: normalizedAuthorEmail || null,
        content: sanitizedContent,
        status: 'pending',
        ip_hash: ip,
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes('comments')) {
        return NextResponse.json({ error: 'Comment system not yet available. Initial database migration needed.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Failed to submit comment' }, { status: 500 })
    }

    return NextResponse.json({ success: true, comment })
  } catch {
    return NextResponse.json({ error: 'Failed to submit comment' }, { status: 500 })
  }
}
