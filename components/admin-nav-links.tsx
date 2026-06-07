'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/admin',
    label: '仪表盘',
    isActive: (pathname: string) => pathname === '/admin',
  },
  {
    href: '/admin/posts/new',
    label: '新建文章',
    isActive: (pathname: string) => pathname.startsWith('/admin/posts'),
  },
  {
    href: '/admin/tags',
    label: '标签',
    isActive: (pathname: string) => pathname.startsWith('/admin/tags'),
  },
  {
    href: '/admin/comments',
    label: '评论',
    isActive: (pathname: string) => pathname.startsWith('/admin/comments'),
  },
  {
    href: '/admin/storage',
    label: '存储',
    isActive: (pathname: string) => pathname.startsWith('/admin/storage'),
  },
  {
    href: '/admin/media',
    label: '媒体',
    isActive: (pathname: string) => pathname.startsWith('/admin/media'),
  },
  {
    href: '/admin/settings',
    label: '设置',
    isActive: (pathname: string) => pathname.startsWith('/admin/settings'),
  },
  {
    href: '/admin/migration',
    label: '迁移',
    isActive: (pathname: string) => pathname.startsWith('/admin/migration'),
  },
  {
    href: '/admin/ai-access',
    label: 'AI',
    isActive: (pathname: string) => pathname.startsWith('/admin/ai-access'),
  },
  {
    href: '/admin/account',
    label: '账号',
    isActive: (pathname: string) => pathname.startsWith('/admin/account'),
  },
]

export function AdminNavLinks() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="后台导航"
      className="flex items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {navItems.map((item) => {
        const active = item.isActive(pathname)

        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? 'true' : undefined}
            className={cn(
              'admin-header-link admin-header-nav-link inline-flex h-14 shrink-0 items-center text-sm font-medium transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
