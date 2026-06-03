'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MenuIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ScrollProgress } from '@/components/scroll-progress'
import { Search } from '@/components/search'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface HeaderProps {
  siteName: string
}

export function Header({ siteName }: HeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-[640px] mx-auto px-6 py-4 sm:py-5">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foreground transition-editorial hover:opacity-70"
          >
            {siteName}
          </Link>

          <div className="hidden sm:flex items-center gap-4 sm:gap-6">
            <Link
              href="/about"
              className="nav-link text-[13px] tracking-wide uppercase text-muted-foreground transition-editorial hover:text-foreground"
            >
              关于
            </Link>
            <Link
              href="/tags"
              className="nav-link text-[13px] tracking-wide uppercase text-muted-foreground transition-editorial hover:text-foreground"
            >
              标签
            </Link>
            <Search />
            <ThemeToggle />
          </div>

          <div className="flex sm:hidden items-center gap-3">
            <Search />
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="打开导航菜单"
                >
                  <MenuIcon className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle className="font-serif text-lg">{siteName}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    首页
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    关于
                  </Link>
                  <Link
                    href="/tags"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    标签
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
      <ScrollProgress />
    </header>
  )
}
