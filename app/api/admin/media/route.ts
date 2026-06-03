import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { getActiveStorage } from '@/lib/storage/active'
import { getStorageDashboard } from '@/lib/storage/dashboard'
import { getErrorMessage } from '@/lib/utils'

function isSafeStoragePath(path: string): boolean {
  return Boolean(path) && !path.startsWith('/') && !path.includes('..') && !path.endsWith('/')
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const query = searchParams.get('q')?.trim().toLowerCase() || ''
    const kind = searchParams.get('kind') || 'all'
    const { providerName, provider, settings } = await getActiveStorage(session.supabase)

    if (!provider.listFiles) {
      return NextResponse.json({ error: 'Current storage provider does not support media listing' }, { status: 501 })
    }

    let files = await provider.listFiles()

    if (kind === 'image') {
      files = files.filter((file) => file.contentType?.startsWith('image/'))
    }

    if (query) {
      files = files.filter((file) => (
        file.path.toLowerCase().includes(query) ||
        file.name.toLowerCase().includes(query)
      ))
    }

    const usage = await getStorageDashboard(settings)

    return NextResponse.json({ provider: providerName, files, usage })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const path = typeof body.path === 'string' ? body.path : ''

    if (!isSafeStoragePath(path)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 })
    }

    const { providerName, provider } = await getActiveStorage(session.supabase)
    await provider.delete(path)

    return NextResponse.json({ success: true, provider: providerName })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
