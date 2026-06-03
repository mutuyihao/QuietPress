import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latency_ms: number }> = {}

  // Check Supabase connectivity
  const dbStart = Date.now()
  try {
    const supabase = createPublicClient()
    const { error } = await supabase.from('site_settings').select('id').limit(1)
    checks.db = {
      status: error ? 'error' : 'ok',
      latency_ms: Date.now() - dbStart,
    }
  } catch {
    checks.db = { status: 'error', latency_ms: Date.now() - dbStart }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  )
}
