import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdminNavLinks } from '@/components/admin-nav-links'
import { Toaster } from '@/components/ui/sonner'
import { getAdminSession } from '@/lib/admin-auth'

async function AdminNav() {
  const adminSession = await getAdminSession()
  if (!adminSession) {
    redirect('/auth/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="shrink-0 text-sm font-semibold text-foreground sm:text-base">
          管理后台
        </Link>

        <div className="min-w-0 flex-1">
          <AdminNavLinks />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden h-14 max-w-56 items-center truncate text-xs text-muted-foreground xl:inline-flex">
            {adminSession.user.email}
          </span>
          <Link
            href="/"
            className="admin-header-link inline-flex h-14 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
          >
            查看博客
          </Link>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="admin-header-link inline-flex h-14 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              退出
            </button>
          </form>
        </div>
      </div>
    </header>
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
      <Toaster position="top-right" offset={72} closeButton visibleToasts={3} />
    </div>
  )
}
