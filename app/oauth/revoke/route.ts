import { NextRequest, NextResponse } from 'next/server'
import { revokeMcpTokenByRawToken } from '@/lib/mcp/store'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = String(formData.get('token') || '')
    if (token) {
      const service = createServiceClient()
      await revokeMcpTokenByRawToken(service, token)
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
