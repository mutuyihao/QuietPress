import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/utils'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('posts')
      .select('id, title, published_at')
      .eq('status', 'scheduled')
      .lte('published_at', new Date().toISOString())

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return NextResponse.json({ published: 0, message: 'No scheduled posts to publish' })
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'published' })
      .in(
        'id',
        scheduledPosts.map((p) => p.id),
      )

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      published: scheduledPosts.length,
      posts: scheduledPosts.map((p) => ({ id: p.id, title: p.title })),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
