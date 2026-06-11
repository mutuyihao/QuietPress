import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, UserCircle } from 'lucide-react'

import { AdminNavLinks } from '@/components/admin-nav-links'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { getAdminSession } from '@/lib/admin-auth'
import packageJson from '@/package.json'

function getRuntimeVersion() {
  const version = process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  const shortCommitSha = commitSha?.slice(0, 7)

  return shortCommitSha ? `v${version} (${shortCommitSha})` : `v${version}`
}

async function AdminNav() {
  const adminSession = await getAdminSession()
  if (!adminSession) {
    redirect('/auth/login')
  }
  const runtimeVersion = getRuntimeVersion()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="shrink-0 text-sm font-semibold text-foreground sm:text-base">
          管理后台
        </Link>

        <div className="min-w-0 flex-1">
          <AdminNavLinks />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden rounded-md border border-border/70 px-2 py-1 font-mono text-xs text-muted-foreground md:inline-flex"
            title={`运行版本 ${runtimeVersion}`}
          >
            {runtimeVersion}
          </span>
          <Link
            href="/"
            className="admin-header-link inline-flex h-14 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
          >
            查看博客
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                aria-label="打开账号菜单"
              >
                <UserCircle className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-1">
                <span className="block text-xs font-normal text-muted-foreground">当前账号</span>
                <span className="block truncate text-sm font-medium text-foreground">
                  {adminSession.user.email || '未知邮箱'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between gap-4 px-2 py-1.5 text-xs text-muted-foreground">
                <span>运行版本</span>
                <span className="font-mono">{runtimeVersion}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/account">
                  <UserCircle className="size-4" />
                  账号设置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action="/api/auth/signout" method="post">
                <DropdownMenuItem asChild variant="destructive">
                  <button type="submit" className="w-full">
                    <LogOut className="size-4" />
                    退出登录
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

async function PasswordChangeNotice() {
  const adminSession = await getAdminSession()
  if (!adminSession?.user.user_metadata?.must_change_password) {
    return null
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          当前账号仍在使用一键部署创建的临时密码。正式发布前请先修改密码。
        </span>
        <Link href="/admin/account" className="font-medium underline underline-offset-4">
          修改密码
        </Link>
      </div>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <PasswordChangeNotice />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
      <Toaster position="top-right" offset={72} closeButton visibleToasts={3} />
    </div>
  )
}
