'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { List, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TOCItem {
  id: string
  text: string
  level: number
}

export function TOC() {
  const pathname = usePathname()
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false) // For mobile collapsible TOC

  useEffect(() => {
    // Wait for the DOM to render the article content
    const timer = setTimeout(() => {
      const articleEl = document.querySelector('.prose-editorial')
      if (!articleEl) return

      const headingElements = articleEl.querySelectorAll('h1, h2, h3, h4')
      const items: TOCItem[] = []

      headingElements.forEach((el, index) => {
        // Ensure every heading has an ID
        if (!el.id) {
          // Generate a safe id based on text or index
          const cleanText = el.textContent?.trim().replace(/\s+/g, '-').toLowerCase() || ''
          el.id = cleanText ? `h-${cleanText}-${index}` : `heading-${index}`
        }

        items.push({
          id: el.id,
          text: el.textContent || '',
          level: Number(el.tagName.slice(1)),
        })
      })

      setHeadings(items)

      // Highlight heading based on Intersection Observer
      const observerOptions = {
        root: null,
        rootMargin: '-100px 0px -60% 0px', // Trigger when heading is in the upper part of the viewport
        threshold: 0.1,
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      }, observerOptions)

      headingElements.forEach((el) => observer.observe(el))

      return () => {
        observer.disconnect()
      }
    }, 100) // Small delay to let markdown render

    return () => clearTimeout(timer)
  }, [pathname])

  if (headings.length === 0) return null
  const topLevel = Math.min(...headings.map((item) => item.level))

  const handleScrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      const offset = 90 // Account for sticky header
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = element.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
      setActiveId(id)
    }
  }

  return (
    <>
      {/* Mobile & Tablet TOC (Collapsible, Inline) */}
      <div className="xl:hidden block mb-10 border border-border/50 rounded-xl bg-card overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <List className="h-4.5 w-4.5 text-muted-foreground" />
            <span className="font-serif text-[15px] font-medium text-foreground">目录</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="border-t border-border/30 px-5 py-3.5 bg-muted/5 max-h-[300px] overflow-y-auto">
            <ul className="space-y-2.5 text-[14px]">
              {headings.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - topLevel) * 16}px` }}
                >
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleScrollTo(e, item.id)}
                    className={cn(
                      "block py-0.5 hover:text-foreground transition-colors font-sans leading-relaxed",
                      activeId === item.id
                        ? "text-foreground font-medium"
                        : "text-muted-foreground/75"
                    )}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Desktop TOC (Sticky Sidebar Floating on the right) */}
      <div className="hidden xl:block absolute left-[calc(100%+64px)] top-16 bottom-0 w-60 pointer-events-none">
        <aside className="sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto select-none pr-4 scrollbar-thin pointer-events-auto">
          <div className="flex items-center gap-2 mb-4">
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="font-serif text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">目录</span>
          </div>
          <ul className="space-y-3.5 text-[13.5px] border-l border-border/40 relative">
            {headings.map((item) => (
              <li
                key={item.id}
                className="relative"
                style={{ paddingLeft: `${16 + (item.level - topLevel) * 12}px` }}
              >
                {/* Highlight bar for active item */}
                {activeId === item.id && (
                  <div className="absolute left-[-1px] top-0 bottom-0 w-[1.5px] bg-foreground transition-all duration-300" />
                )}
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleScrollTo(e, item.id)}
                  className={cn(
                    "block hover:text-foreground transition-all duration-200 font-sans leading-relaxed",
                    activeId === item.id
                      ? "text-foreground font-medium translate-x-[2px]"
                      : "text-muted-foreground/60"
                  )}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  )
}
