import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoginRedirectCountdown } from '@/components/login-redirect-countdown'
import { getAdminSession } from '@/lib/admin-auth'

interface LoginPageProps {
  searchParams?: Promise<{ error?: string; login?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const error = params?.error
  const showLoginSuccess = params?.login === 'success' && await getAdminSession()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <h1 className="mb-8 text-center text-2xl font-bold text-foreground">
          管理员登录
        </h1>

        {showLoginSuccess ? (
          <LoginRedirectCountdown seconds={3} />
        ) : (
          <form action="/api/auth/login" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                className="placeholder:text-muted-foreground/40"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="********"
                className="placeholder:text-muted-foreground/40"
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[var(--toast-error-border)] bg-[var(--toast-error-bg)] px-3.5 py-3 text-sm leading-relaxed text-[var(--toast-error-text)]"
              >
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
