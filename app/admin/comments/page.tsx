'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDate } from '@/lib/blog-utils'
import { postPath } from '@/lib/route-segments'
import { Button } from '@/components/ui/button'
import { Check, Trash2, ExternalLink, Loader2, MessageSquare } from 'lucide-react'

interface CommentWithPost {
  id: string
  post_id: string
  author_name: string
  content: string
  status: string
  created_at: string
  posts: { title: string; slug: string }
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentWithPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'spam'>('pending')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/comments?status=${activeTab}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message) toast.warning(data.message)
        else setComments(data.comments || [])
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [activeTab])

  const handleAction = (id: string, action: 'approved' | 'spam' | 'delete') => {
    startTransition(async () => {
      try {
        if (action === 'delete') {
          await fetch(`/api/admin/comments?id=${id}`, { method: 'DELETE' })
        } else {
          await fetch('/api/admin/comments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: action }),
          })
        }
        setComments((prev) => prev.filter((c) => c.id !== id))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : '操作失败')
      }
    })
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">评论管理</h1>
        <p className="admin-page-description">审核和管理文章评论。</p>
      </div>

      <div className="admin-tabs">
        {[
          { value: 'pending' as const, label: '待审核' },
          { value: 'approved' as const, label: '已通过' },
          { value: 'spam' as const, label: '垃圾' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`admin-tab ${
              activeTab === tab.value
                ? 'admin-tab-active'
                : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : comments.length === 0 ? (
        <div className="admin-empty py-16">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">暂无{activeTab === 'pending' ? '待审核' : activeTab === 'approved' ? '已通过' : '垃圾'}评论</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="admin-panel space-y-3 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold text-foreground">{comment.author_name}</span>
                    <span className="text-muted-foreground/50">{formatDate(comment.created_at)}</span>
                  </div>
                  <Link
                    href={postPath(comment.posts.slug)}
                    className="text-[12px] text-muted-foreground/60 hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {comment.posts.title}
                  </Link>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeTab === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => handleAction(comment.id, 'approved')}
                        disabled={isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                        onClick={() => handleAction(comment.id, 'spam')}
                        disabled={isPending}
                      >
                        垃圾
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleAction(comment.id, 'delete')}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
