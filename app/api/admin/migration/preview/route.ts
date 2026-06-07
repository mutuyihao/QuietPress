import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { createMigrationPreview } from '@/lib/migration/preview'
import { parseQuietPressPackageFromRequest } from '@/lib/migration/utils'
import { getErrorMessage } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const migrationPackage = await parseQuietPressPackageFromRequest(request)
    const preview = await createMigrationPreview(session.supabase, migrationPackage)
    return NextResponse.json(preview)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
