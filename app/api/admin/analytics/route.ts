import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin-auth'
import { getErrorMessage } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const days = parseInt(searchParams.get('days') || '30', 10)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  try {
    const supabase = await createClient()

    // Try to use the RPC function; return an empty state if the database bootstrap has not run.
    const { data: dailyViews, error } = await supabase.rpc('get_daily_views', {
      start_date: startStr,
      end_date: endStr,
    })

    if (error) {
      // Fallback: return empty data if view_events table doesn't exist yet
      if (error.message.includes('view_events') || error.message.includes('get_daily_views')) {
        return NextResponse.json({
          dailyViews: [],
          topPosts: [],
          message: 'Initial database migration has not been applied. Run supabase/migrations/202606020001_initial_release.sql.',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: topPosts } = await supabase.rpc('get_top_posts_daily', {
      start_date: startStr,
      end_date: endStr,
      limit_count: 10,
    })

    return NextResponse.json({
      dailyViews: dailyViews || [],
      topPosts: topPosts || [],
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
