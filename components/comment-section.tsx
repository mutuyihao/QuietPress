'use client'

import { useEffect, useState, useTransition } from 'react'
import { formatDate } from '@/lib/blog-utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { MessageSquare, Reply, ChevronDown, ChevronUp } from 'lucide-react'

interface Comment {
  id: string
  post_id: string
  parent_id: string | null
  author_name: string
  content: string
  created_at: string
  children: Comment[]
}

interface CommentSectionProps {
  postId: string
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comments?postId=${postId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message) setError(data.message)
        else setComments(data.comments || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [postId])

  if (error) {
    return (
      <section className="mt-16 pt-10 border-t border-border/40">
        <p className="text-sm text-muted-foreground">{error}</p>
      </section>
    )
  }

  return (
    <section className="mt-16 pt-10 border-t border-border/40">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          评论
          {!loading && comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </h2>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            写评论
          </Button>
        )}
      </div>

      {showForm && (
        <CommentForm
          postId={postId}
          onSubmitted={() => {
            setSubmitted(true)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {submitted && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4 animate-fade-in">
          评论已提交，等待审核后显示。
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-3 bg-muted/50 rounded w-full" />
              <div className="h-3 bg-muted/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          暂无评论，来抢个沙发吧。
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} postId={postId} />
          ))}
        </div>
      )}
    </section>
  )
}

function CommentItem({ comment, postId, depth = 0 }: { comment: Comment; postId: string; depth?: number }) {
  const [showReply, setShowReply] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l-2 border-border/30' : ''}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-semibold text-foreground">{comment.author_name}</span>
          <span className="text-muted-foreground">{formatDate(comment.created_at)}</span>
        </div>
        <p className="text-[14px] text-muted-foreground leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Reply className="h-3 w-3" />
            回复
          </button>
          {comment.children.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {comment.children.length} 条回复
            </button>
          )}
        </div>
      </div>

      {showReply && (
        <div className="mt-3">
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onSubmitted={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}

      {!collapsed &&
        comment.children.map((child) => (
          <div key={child.id} className="mt-3">
            <CommentItem comment={child} postId={postId} depth={depth + 1} />
          </div>
        ))}
    </div>
  )
}

function CommentForm({
  postId,
  parentId,
  onSubmitted,
  onCancel,
}: {
  postId: string
  parentId?: string
  onSubmitted: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            parentId: parentId || null,
            authorName: name.trim() || 'Anonymous',
            content: content.trim(),
          }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          onSubmitted()
        }
      } catch {
        setError('提交失败，请稍后重试')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-muted/30 border border-border/40 rounded-lg p-4 animate-fade-in">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="你的名字（选填）"
        aria-label="你的名字"
        className="h-9 text-sm"
        maxLength={50}
      />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论..."
        aria-label="评论内容"
        rows={3}
        className="text-sm"
        maxLength={5000}
        required
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
          {isPending ? '提交中...' : parentId ? '回复' : '发表评论'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
