'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const searchParams = useSearchParams()

  function createPageUrl(page: number): string {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    return `/?${params.toString()}`
  }

  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-12 pt-8 border-t border-border/40" aria-label="分页导航">
      {currentPage > 1 && (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          上一页
        </Link>
      )}

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground/50 text-[13px]">
              ...
            </span>
          ) : (
            <Link
              key={p}
              href={createPageUrl(p)}
              className={`inline-flex items-center justify-center w-8 h-8 text-[13px] rounded-md transition-colors ${
                p === currentPage
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {currentPage < totalPages && (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
        >
          下一页
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </nav>
  )
}
