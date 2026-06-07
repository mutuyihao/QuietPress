import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { importQuietPressPackage } from '@/lib/migration/import'
import { migrationImportRequestSchema } from '@/lib/migration/types'
import { parseJsonBody } from '@/lib/migration/utils'
import { getErrorMessage } from '@/lib/utils'

export const runtime = 'nodejs'

function revalidateImportedContent() {
  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/admin/migration')
  revalidatePath('/admin/tags')
  revalidatePath('/about')
  revalidatePath('/tags')
  revalidatePath('/posts/[slug]', 'page')
  revalidatePath('/rss.xml')
  revalidatePath('/sitemap.xml')
  revalidatePath('/robots.txt')
  revalidateTag('posts', 'max')
  revalidateTag('tags', 'max')
  revalidateTag('settings', 'max')
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = parseJsonBody(await request.text())
    const parsed = migrationImportRequestSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((error) => error.message).join('; ') },
        { status: 400 },
      )
    }

    const result = await importQuietPressPackage(
      session.supabase,
      parsed.data.package,
      parsed.data.options,
    )

    revalidateImportedContent()

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
