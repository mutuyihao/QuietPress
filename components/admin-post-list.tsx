'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search as SearchIcon, FileText, ArrowRight, Eye, Calendar, Tag, Trash2, Archive, Send, CheckSquare, X } from 'lucide-react'
import { formatDate } from '@/lib/blog-utils'
import { batchUpdatePosts, batchDeletePosts } from '@/lib/actions'
import type { PostWithTags, PostStatus } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AdminPostListProps {
  posts: PostWithTags[]
}

const statusColors: Record<PostStatus, string> = {
  draft: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  scheduled: 'bg-sky-500/10 text-sky-500 border border-sky-500/20',
  published: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20',
}

const statusLabels: Record<PostStatus, string> = {
  draft: '草稿',
  scheduled: '已计划',
  published: '已发布',
  archived: '已归档',
}

export function AdminPostList({ posts }: AdminPostListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | PostStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const tabs: { value: 'all' | PostStatus; label: string; count: number }[] = [
    { value: 'all', label: '全部', count: posts.length },
    { value: 'published', label: '已发布', count: posts.filter((p) => p.status === 'published').length },
    { value: 'draft', label: '草稿', count: posts.filter((p) => p.status === 'draft').length },
    { value: 'archived', label: '已归档', count: posts.filter((p) => p.status === 'archived').length },
  ]

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(query.toLowerCase()) ||
      post.tags.some((t) => t.name.toLowerCase().includes(query.toLowerCase())) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(query.toLowerCase()))

    const matchesTab = activeTab === 'all' || post.status === activeTab

    return matchesSearch && matchesTab
  })

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPosts.map((p) => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleBatchAction = (action: 'publish' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return

    startTransition(async () => {
      try {
        const ids = Array.from(selectedIds)
        if (action === 'delete') {
          await batchDeletePosts(ids)
        } else {
          await batchUpdatePosts(ids, action === 'publish' ? 'published' : 'archived')
        }
        setSelectedIds(new Set())
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '批量操作失败')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters Row */}
      <div className="admin-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/55" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章标题、摘要或标签..."
            className="h-10 w-full rounded-lg border-border bg-background pl-10 text-sm font-sans shadow-none"
          />
        </div>

        <div className="admin-tabs shrink-0 overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "admin-tab flex h-8 shrink-0 items-center gap-1.5",
                activeTab === tab.value
                  ? "admin-tab-active"
                  : "",
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "rounded-full px-1.5 text-[10px] leading-4",
                activeTab === tab.value ? "bg-muted text-foreground" : "bg-background text-muted-foreground",
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Posts Table */}
      {filteredPosts.length === 0 ? (
        <div className="admin-empty py-16">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">没有找到符合条件的文章</p>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="mt-2 text-xs text-primary hover:underline"
            >
              清除搜索条件
            </button>
          )}
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
          <div>
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-32" />
                <col className="w-16" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/25">
                  <th className="h-14 px-4 py-0 align-middle">
                    <button
                      onClick={toggleSelectAll}
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded border-2 align-middle transition-all cursor-pointer",
                        selectedIds.size === filteredPosts.length && filteredPosts.length > 0
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border hover:border-foreground/40",
                      )}
                      aria-label="全选文章"
                    >
                      {selectedIds.size === filteredPosts.length && filteredPosts.length > 0 && (
                        <CheckSquare className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  {selectedIds.size > 0 ? (
                    <th colSpan={5} className="h-14 px-3 py-0 align-middle">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedIds(new Set())}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          aria-label="取消选择"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-medium text-foreground">
                          已选 {selectedIds.size} 篇
                        </span>
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchAction('publish')}
                          disabled={isPending}
                          className="gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          批量发布
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBatchAction('archive')}
                          disabled={isPending}
                          className="gap-1.5"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          批量归档
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleBatchAction('delete')}
                          disabled={isPending}
                          className="gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          批量删除
                        </Button>
                      </div>
                    </th>
                  ) : (
                    <>
                      <th className="h-14 px-3 py-0 align-middle text-xs font-semibold tracking-wide text-muted-foreground/75">文章标题</th>
                      <th className="h-14 px-3 py-0 align-middle text-xs font-semibold tracking-wide text-muted-foreground/75">状态</th>
                      <th className="h-14 px-3 py-0 align-middle text-xs font-semibold tracking-wide text-muted-foreground/75">浏览</th>
                      <th className="h-14 px-3 py-0 align-middle text-xs font-semibold tracking-wide text-muted-foreground/75">更新时间</th>
                      <th className="h-14 px-4 py-0 align-middle text-right text-xs font-semibold tracking-wide text-muted-foreground/75">操作</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="group h-[72px] transition-colors hover:bg-muted/25">
                    <td className="px-4 py-0 align-middle">
                      <div className="flex min-h-[72px] items-center py-3">
                        <button
                          onClick={() => toggleSelect(post.id)}
                          className={cn(
                            "inline-flex h-4 w-4 items-center justify-center rounded border-2 align-middle transition-all cursor-pointer",
                            selectedIds.has(post.id)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border hover:border-foreground/40",
                          )}
                          aria-label={`选择文章：${post.title}`}
                        >
                          {selectedIds.has(post.id) && (
                            <CheckSquare className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-0 align-middle">
                      <div className="flex min-h-[72px] flex-col justify-center gap-1 py-3">
                        <p className="truncate font-sans text-[15px] font-medium leading-[1.35] text-foreground transition-colors group-hover:text-primary">
                          {post.title}
                        </p>
                        {post.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {post.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded font-sans"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-0 align-middle">
                      <div className="flex min-h-[72px] items-center py-3">
                        <span className={cn(
                          "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium leading-none",
                          statusColors[post.status],
                        )}>
                          {statusLabels[post.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-0 align-middle text-[13.5px] font-mono text-muted-foreground">
                      <span className="flex min-h-[72px] items-center gap-1.5 py-3 leading-none">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                        {post.views_count || 0}
                      </span>
                    </td>
                    <td className="px-3 py-0 align-middle text-[13.5px] font-sans text-muted-foreground">
                      <span className="flex min-h-[72px] items-center gap-1.5 whitespace-normal py-3 leading-none xl:whitespace-nowrap">
                        <Calendar className="hidden h-3.5 w-3.5 text-muted-foreground/40 xl:inline" />
                        {formatDate(post.updated_at)}
                      </span>
                    </td>
                    <td className="px-4 py-0 align-middle text-right">
                      <div className="flex min-h-[72px] items-center justify-end py-3">
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium leading-none text-primary hover:underline"
                        >
                          编辑
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
