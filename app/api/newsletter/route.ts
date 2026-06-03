import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 320

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
      scope: 'newsletter',
      maxRequests: 3,
      windowMs: 60 * 60_000,
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many subscription attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    const { email } = await request.json()
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''

    if (
      !normalizedEmail
      || normalizedEmail.length > MAX_EMAIL_LENGTH
      || !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 })
    }

    const supabase = createPublicClient()

    const { data: existing, error: lookupError } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (lookupError && !lookupError.message.includes('newsletter_subscribers')) {
      return NextResponse.json({ error: 'Subscription lookup failed' }, { status: 500 })
    }

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({ success: true, message: 'Already subscribed' })
      }
      if (existing.status === 'unsubscribed') {
        const { error: resubError } = await supabase
          .from('newsletter_subscribers')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (resubError) {
          return NextResponse.json({ error: 'Subscription update failed' }, { status: 500 })
        }
        return NextResponse.json({ success: true, message: 'Resubscribed' })
      }
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        status: 'active',
      })

    if (error) {
      if (error.message.includes('newsletter_subscribers')) {
        return NextResponse.json(
          { error: 'Initial database migration has not been applied.' },
          { status: 503 },
        )
      }
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Already subscribed' })
      }
      return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Subscribed' })
  } catch {
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
  }
}
