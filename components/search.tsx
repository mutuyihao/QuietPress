'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search as SearchIcon, X, FileText, Loader2 } from 'lucide-react'
import { postPath } from '@/lib/route-segments'

interface PostSearchItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
}

export function Search() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [posts, setPosts] = useState<PostSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    const url = `/api/search${params.toString() ? '?' + params.toString() : ''}`
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (Array.isArray(data)) {
        setPosts(data)
      }
    } catch (err) {
      console.error('Failed to load search data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setLoading(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        doSearch(query)
      }, 300)
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setQuery('')
      setSelectedIndex(0)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen, query, doSearch])

  const filteredPosts = posts

  useEffect(() => {
    if (filteredPosts.length === 0) return

    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredPosts.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredPosts.length) % filteredPosts.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selectedPost = filteredPosts[selectedIndex]
        if (selectedPost) {
          router.push(postPath(selectedPost.slug))
          setIsOpen(false)
        }
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleNavigation)
    }
    return () => window.removeEventListener('keydown', handleNavigation)
  }, [isOpen, filteredPosts, selectedIndex, router])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full border border-border/50 hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring gap-1"
        aria-label="Open search dialog"
      >
        <SearchIcon className="h-[14px] w-[14px]" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="搜索文章"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-card border border-border/60 max-w-[540px] w-full rounded-xl shadow-2xl overflow-hidden flex flex-col scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <SearchIcon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                placeholder="搜索文章标题或摘要..."
                aria-label="搜索关键词"
                className="w-full bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-[14px] font-sans"
              />
              {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/80">
                ESC
              </kbd>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground/60 hover:text-foreground p-0.5"
                aria-label="关闭搜索弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground/60 font-sans">
                  正在索引文章库...
                </div>
              ) : filteredPosts.length > 0 ? (
                filteredPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    href={postPath(post.slug)}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-150 group/item ${
                      index === selectedIndex
                        ? 'bg-muted/80 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60 group-hover/item:text-foreground" />
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[13.5px] font-sans font-medium text-foreground truncate">
                        {post.title}
                      </div>
                      {post.excerpt && (
                        <div className="text-[12px] font-sans text-muted-foreground/60 line-clamp-1">
                          {post.excerpt}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground/60 font-sans">
                  没有找到匹配的文章
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-muted/30 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/45 select-none font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ 切换</span>
                <span>Enter 选择</span>
              </div>
              <div>
                <span>Ctrl+K 唤出</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
