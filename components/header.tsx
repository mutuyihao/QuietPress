"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScrollProgress } from "@/components/scroll-progress";
import { Search } from "@/components/search";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderProps {
  siteName: string;
}

const NAV_ITEMS = [
  { href: "/about", label: "关于" },
  { href: "/tags", label: "标签" },
  { href: "/archive", label: "归档" },
];

export function Header({ siteName }: HeaderProps) {
  const [open, setOpen] = useState(false);

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
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link text-[13px] tracking-wide uppercase text-muted-foreground transition-editorial hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Search />
            <ThemeToggle />
          </div>

          <div className="flex sm:hidden items-center gap-3">
            <Search />
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="打开导航菜单"
                >
                  <MenuIcon className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle className="font-serif text-lg">
                    {siteName}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    首页
                  </Link>
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
      <ScrollProgress />
    </header>
  );
}
