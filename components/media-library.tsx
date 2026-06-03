'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check, Copy, ImageIcon, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { StoredFile } from '@/lib/storage'
import type { ImageUploadConfig } from '@/lib/image-upload-config'
import type { StorageUsageOverview } from '@/lib/storage/usage'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/image-upload'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface MediaLibraryProps {
  mode?: 'manage' | 'select'
  uploadConfig?: ImageUploadConfig
  onSelect?: (file: StoredFile) => void
  showUsage?: boolean
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '未知大小'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

function formatDate(value: string | null): string {
  if (!value) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function fetchMedia(query: string) {
  const params = new URLSearchParams({ kind: 'image' })
  if (query.trim()) params.set('q', query.trim())

  const res = await fetch(`/api/admin/media?${params.toString()}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '读取媒体库失败')
  return data as { provider: string; files: StoredFile[]; usage: StorageUsageOverview }
}

export function MediaLibrary({
  mode = 'manage',
  uploadConfig,
  onSelect,
  showUsage = mode === 'manage',
}: MediaLibraryProps) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [files, setFiles] = useState<StoredFile[]>([])
  const [usage, setUsage] = useState<StorageUsageOverview | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      try {
        const data = await fetchMedia(query)
        setProvider(data.provider)
        setFiles(data.files)
        setUsage(data.usage)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '读取媒体库失败')
      }
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const totalSize = useMemo(() => (
    files.reduce((sum, file) => sum + (file.size || 0), 0)
  ), [files])
  const usageText = showUsage && usage?.usedBytes !== null && usage?.usedBytes !== undefined
    ? ` · 已用 ${formatBytes(usage.usedBytes)}`
    : ''

  const copyUrl = async (file: StoredFile) => {
    await navigator.clipboard.writeText(file.url)
    setCopiedPath(file.path)
    window.setTimeout(() => setCopiedPath(null), 1200)
  }

  const reduceUsageAfterDelete = (file: StoredFile) => {
    setUsage((current) => {
      if (!current) return current

      const deletedBytes = file.size ?? 0
      const usedBytes = current.usedBytes === null
        ? null
        : Math.max(0, current.usedBytes - deletedBytes)
      const objectCount = current.objectCount === null
        ? null
        : Math.max(0, current.objectCount - 1)

      return {
        ...current,
        usedBytes,
        objectCount,
        availableBytes: current.quotaBytes !== null && usedBytes !== null
          ? Math.max(0, current.quotaBytes - usedBytes)
          : current.availableBytes,
      }
    })
  }

  const deleteFile = (file: StoredFile) => {
    if (!window.confirm(`删除 ${file.name}？文章中的旧链接不会更新。`)) return

    startTransition(async () => {
      try {
        setDeletingPath(file.path)
        const res = await fetch('/api/admin/media', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '删除失败')
        setFiles((current) => current.filter((item) => item.path !== file.path))
        reduceUsageAfterDelete(file)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败')
      } finally {
        setDeletingPath(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">图片文件</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {files.length} 张 · 当前列表 {formatBytes(totalSize)}
              {provider ? ` · ${provider}` : ''}
              {usageText}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === 'manage' && uploadConfig && (
              <ImageUpload
                compact
                config={uploadConfig}
                onUploaded={() => load()}
              />
            )}
            <Button type="button" variant="outline" size="sm" onClick={load} disabled={isPending}>
              <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
              刷新
            </Button>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文件名或路径"
              className="h-8 pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="admin-empty p-8">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">暂无图片。</p>
        </div>
      ) : (
        <div className={cn(
          'grid gap-3',
          mode === 'select' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6',
        )}>
          {files.map((file) => (
            <div key={file.path} className="admin-panel group overflow-hidden rounded-lg">
              <button
                type="button"
                onClick={() => mode === 'select' && onSelect?.(file)}
                className={cn(
                  'relative block aspect-square w-full overflow-hidden bg-muted text-left',
                  mode === 'select' && 'cursor-pointer',
                )}
                disabled={mode !== 'select'}
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                  loading="lazy"
                />
                {mode === 'select' && (
                  <span className="absolute inset-x-2 bottom-2 rounded-md border border-border bg-background/90 px-2 py-1 text-center text-xs font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    插入
                  </span>
                )}
              </button>

              <div className="space-y-2 p-2.5">
                <div>
                  <p className="truncate text-sm font-medium text-foreground" title={file.name}>{file.name}</p>
                  <p className="truncate text-xs text-muted-foreground" title={file.path}>
                    {formatBytes(file.size)} · {formatDate(file.lastModified)}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  {mode === 'select' ? (
                    <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={() => onSelect?.(file)}>
                      选择
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => copyUrl(file)}
                      aria-label={copiedPath === file.path ? '已复制' : '复制链接'}
                      title={copiedPath === file.path ? '已复制' : '复制链接'}
                    >
                      {copiedPath === file.path ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => deleteFile(file)}
                    disabled={deletingPath === file.path}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="删除图片"
                    title="删除图片"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
