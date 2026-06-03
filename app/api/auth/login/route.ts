import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

function loginRedirect(request: NextRequest, error: string) {
  const url = new URL('/auth/login', request.url)
  url.searchParams.set('error', error)
  return NextResponse.redirect(url, { status: 303 })
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed } = checkRateLimit(ip)

  if (!allowed) {
    return loginRedirect(request, '登录尝试过于频繁，请稍后再试。')
  }

  const formData = await request.formData()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return loginRedirect(request, '请输入邮箱和密码。')
  }

  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    return loginRedirect(request, authError.message)
  }

  const user = data.user
  if (!user) {
    return loginRedirect(request, '登录失败：未返回用户会话。')
  }

  const { data: existingAdminProfile, error: adminLookupError } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminLookupError) {
    await supabase.auth.signOut()
    return loginRedirect(request, `管理员权限检查失败：${adminLookupError.message}`)
  }

  let adminProfile = existingAdminProfile

  if (!adminProfile) {
    const { data: claimedAdmin, error: claimError } = await supabase.rpc(
      'claim_first_admin',
      { admin_email: user.email || email },
    )

    if (claimError) {
      await supabase.auth.signOut()
      return loginRedirect(request, `首次管理员初始化失败：${claimError.message}`)
    }

    if (!claimedAdmin) {
      await supabase.auth.signOut()
      return loginRedirect(request, '您没有管理员权限。如果这是首次部署，请确认 admin_profiles 为空并已执行 supabase/migrations/202606020001_initial_release.sql。')
    }

    const { data: refreshedAdminProfile, error: refreshError } = await supabase
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (refreshError) {
      await supabase.auth.signOut()
      return loginRedirect(request, `管理员权限刷新失败：${refreshError.message}`)
    }

    adminProfile = refreshedAdminProfile
  }

  if (!adminProfile) {
    await supabase.auth.signOut()
    return loginRedirect(request, '您没有管理员权限。')
  }

  return NextResponse.redirect(new URL('/admin', request.url), { status: 303 })
}
