import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { createQuietPressExport } from '@/lib/migration/export'
import { getErrorMessage } from '@/lib/utils'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await createQuietPressExport(session.supabase)
    const body = JSON.stringify(data, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="quietpress-export-v1.json"',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
