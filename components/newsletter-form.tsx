'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, CheckCircle, X } from 'lucide-react'

export function NewsletterTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-link text-[12px] tracking-widest uppercase text-muted-foreground transition-editorial hover:text-foreground cursor-pointer"
      >
        订阅
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-center justify-center px-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="邮件订阅"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border/60 max-w-[400px] w-full rounded-xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-semibold text-foreground">邮件订阅</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground/60 hover:text-foreground p-0.5 cursor-pointer"
                aria-label="关闭订阅弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[13px] text-muted-foreground">
              新文章发布时，将通过邮件通知您。
            </p>
            <NewsletterFormContent />
          </div>
        </div>
      )}
    </>
  )
}

function NewsletterFormContent() {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setMessage(data.message || '订阅成功！')
          setEmail('')
        }
      } catch {
        setError('网络错误，请稍后重试')
      }
    })
  }

  return (
    <>
      {message ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 animate-fade-in">
          <CheckCircle className="h-4 w-4" />
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="邮箱地址"
            className="h-9 text-sm"
            required
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? '...' : '订阅'}
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  )
}
