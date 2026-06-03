import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getAdminSession } from '@/lib/admin-auth'
import { getImageUploadConfig, getImageUploadMaxSizeBytes } from '@/lib/image-upload-config'
import { getStorageProvider, getStorageProviderEnvironmentStatus, normalizeStorageProvider } from '@/lib/storage'
import { getErrorMessage } from '@/lib/utils'

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif'
  }

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

async function getUploadSettings(supabase: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>['supabase']) {
  const { data } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 'main')
    .maybeSingle()

  return {
    uploadConfig: getImageUploadConfig(data),
    storageProvider: normalizeStorageProvider(data?.storage_provider || process.env.STORAGE_PROVIDER || 'supabase'),
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const { uploadConfig, storageProvider } = await getUploadSettings(session.supabase)
    const maxSizeBytes = getImageUploadMaxSizeBytes(uploadConfig)
    const providerStatus = getStorageProviderEnvironmentStatus(storageProvider)

    if (!providerStatus.configured) {
      return NextResponse.json(
        { error: `${providerStatus.label} is not configured: ${providerStatus.missingEnv.join(', ')}` },
        { status: 503 },
      )
    }

    const storage = await getStorageProvider(storageProvider)
    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedMime = detectImageMime(buffer)

    if (!detectedMime) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 })
    }

    if (file.type && detectedMime !== file.type) {
      return NextResponse.json({ error: 'Image MIME type does not match file content' }, { status: 400 })
    }

    const err = storage.validate(
      { type: detectedMime, size: buffer.byteLength },
      { maxSizeBytes, allowedMimeTypes: ALLOWED_IMAGE_MIME },
    )
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 })
    }

    const ext = MIME_TO_EXT[detectedMime]
    const fileName = `${Date.now()}-${randomUUID()}.${ext}`

    const result = await storage.upload(buffer, fileName, detectedMime, 'posts')

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
      contentType: detectedMime,
      originalSize: Number(formData.get('originalSize')) || file.size,
      uploadedSize: buffer.byteLength,
      compressed: formData.get('compressed') === 'true',
      maxSizeBytes,
      provider: storageProvider,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }

}
