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
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: revisions, error } = await supabase
      .from('post_revisions')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      if (error.message.includes('post_revisions')) {
        return NextResponse.json({ revisions: [], message: 'Migration not yet applied.' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ revisions: revisions || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
