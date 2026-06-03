'use client'

import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import type { MDXEditorMethods } from '@mdxeditor/editor'
import { createPost, deletePost, updatePost } from '@/lib/actions'
import type { PostStatus, PostWithTags, Tag } from '@/lib/types'
import type { StoredFile } from '@/lib/storage'
import {
  DEFAULT_IMAGE_UPLOAD_CONFIG,
  type ImageUploadConfig,
} from '@/lib/image-upload-config'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/image-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaPickerDialog } from '@/components/media-picker-dialog'
import { RichMarkdownEditor } from '@/components/rich-markdown-editor'
import { Textarea } from '@/components/ui/textarea'

interface PostEditorProps {
  post?: PostWithTags
  allTags: Tag[]
  uploadConfig?: ImageUploadConfig
  children?: ReactNode
}

export function PostEditor({
  post,
  allTags,
  uploadConfig = DEFAULT_IMAGE_UPLOAD_CONFIG,
  children,
}: PostEditorProps) {
  const router = useRouter()
  const editorRef = useRef<MDXEditorMethods>(null)
  const [isPending, startTransition] = useTransition()
  const [showSeo, setShowSeo] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  const [title, setTitle] = useState(post?.title || '')
  const [content, setContent] = useState(post?.content_markdown || '')
  const [excerpt, setExcerpt] = useState(post?.excerpt || '')
  const [status, setStatus] = useState<PostStatus>(post?.status || 'draft')
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url || '')
  const [seoTitle, setSeoTitle] = useState(post?.seo_title || '')
  const [seoDescription, setSeoDescription] = useState(post?.seo_description || '')
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonical_url || '')
  const [noindex, setNoindex] = useState(post?.noindex || false)
  const [selectedTags, setSelectedTags] = useState<string[]>(post?.tags.map((tag) => tag.id) || [])

  const draftKey = post ? `draft_edit_${post.id}` : 'draft_new'
  const editorKey = post?.id ?? (draftRestored ? 'new-restored' : 'new')
  const showAutoSaveHint = !post && Boolean(title || content)

  useEffect(() => {
    if (post) return

    try {
      const saved = localStorage.getItem(draftKey)
      if (!saved) return

      const draft = JSON.parse(saved)
      if (draft.title) setTitle(draft.title)
      if (draft.content) setContent(draft.content)
      if (draft.excerpt) setExcerpt(draft.excerpt)
      if (draft.coverImageUrl) setCoverImageUrl(draft.coverImageUrl)
      if (draft.selectedTags) setSelectedTags(draft.selectedTags)
      setDraftRestored(true)
      toast.info('已恢复上次未保存的新文章草稿', {
        id: 'draft-restored',
        action: {
          label: '清除草稿',
          onClick: () => {
            localStorage.removeItem(draftKey)
            setTitle('')
            setContent('')
            setExcerpt('')
            setCoverImageUrl('')
            setSelectedTags([])
            setDraftRestored(false)
          },
        },
      })
    } catch {
      // Ignore malformed local drafts.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (post) return

    const timer = window.setTimeout(() => {
      const draft = { title, content, excerpt, coverImageUrl, selectedTags }
      if (title || content) {
        localStorage.setItem(draftKey, JSON.stringify(draft))
      }
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [title, content, excerpt, coverImageUrl, selectedTags, post, draftKey])

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // Ignore storage errors.
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => (
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    ))
  }

  const insertMediaFile = (file: StoredFile) => {
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[\[\]\r\n]/g, ' ').trim() || 'image'
    const markdown = `\n![${alt}](${file.url})\n`
    const editor = editorRef.current

    if (!editor) {
      setContent((current) => `${current}${markdown}`)
      setMediaPickerOpen(false)
      return
    }

    editor.focus(() => {
      editor.insertMarkdown(markdown)
      window.setTimeout(() => setContent(editor.getMarkdown()), 0)
    })
    setMediaPickerOpen(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const formData = new FormData()
    formData.append('title', title)
    formData.append('content_markdown', content)
    formData.append('excerpt', excerpt)
    formData.append('status', status)
    formData.append('cover_image_url', coverImageUrl)
    formData.append('seo_title', seoTitle)
    formData.append('seo_description', seoDescription)
    formData.append('canonical_url', canonicalUrl)
    formData.append('noindex', String(noindex))
    selectedTags.forEach((tagId) => formData.append('tags', tagId))

    startTransition(async () => {
      try {
        const result = post
          ? await updatePost(post.id, formData)
          : await createPost(formData)

        if (!result.success) {
          toast.error(result.error || '保存失败')
          return
        }

        if (!post) clearDraft()
        router.push('/admin')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存失败')
      }
    })
  }

  const handleDelete = () => {
    if (!post) return

    startTransition(async () => {
      try {
        await deletePost(post.id)
        router.push('/admin')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败')
      }
    })
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="post-editor-form grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {draftRestored && (
          <div className="hidden">
            <span>已恢复上次未保存的新文章草稿</span>
            <button
              type="button"
              onClick={() => {
                clearDraft()
                setTitle('')
                setContent('')
                setExcerpt('')
                setCoverImageUrl('')
                setSelectedTags([])
                setDraftRestored(false)
              }}
              className="ml-auto text-xs underline hover:no-underline"
            >
              清除草稿
            </button>
          </div>
        )}

        {!post && !draftRestored && (title || content) && (
          <div className="hidden">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
            草稿会自动保存到当前浏览器
          </div>
        )}

        <main className="post-editor-main min-w-0 space-y-6 xl:space-y-0">
          <section className="post-editor-title-section space-y-4 xl:space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="文章标题"
                required
                className="h-10 text-base font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">摘要</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="文章摘要，可选"
                rows={2}
                className="min-h-14 resize-none"
              />
            </div>
          </section>

          <section className="post-editor-content-section min-w-0 space-y-2">
            <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between xl:pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm font-medium">内容</Label>
                <span className="text-[11px] font-sans text-muted-foreground/70 select-none">
                  {content.length} 字符 · 预计 {Math.max(1, Math.ceil(content.length / 400))} 分钟阅读
                </span>
                <span
                  className={`hidden min-w-40 items-center gap-1.5 text-[11px] text-muted-foreground/60 transition-opacity md:inline-flex ${showAutoSaveHint ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden={!showAutoSaveHint}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                  草稿自动保存
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MediaPickerDialog
                  open={mediaPickerOpen}
                  onOpenChange={setMediaPickerOpen}
                  onSelect={insertMediaFile}
                />
                <Button
                  type="button"
                  variant={showCheatsheet ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowCheatsheet((value) => !value)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {showCheatsheet ? '关闭指南' : '排版指南'}
                </Button>
              </div>
            </div>

            <RichMarkdownEditor
              ref={editorRef}
              key={editorKey}
              markdown={content}
              onChange={(markdown) => setContent(markdown)}
              imageUploadConfig={uploadConfig}
              placeholder="开始写作，或直接粘贴图片..."
              spellCheck
            />

            {showCheatsheet && (
              <div className="admin-panel p-4 text-sm text-muted-foreground">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  排版指南
                </div>
                <div className="grid gap-2 text-xs leading-relaxed sm:grid-cols-2">
                  <p>工具栏可插入标题、列表、链接、图片、表格、分割线和代码块。</p>
                  <p>支持 Markdown 快捷语法，例如 ## 标题、- 列表、``` 代码块。</p>
                  <p>粘贴或拖拽图片会自动压缩上传，并插入当前光标位置。</p>
                  <p>需要精修 Markdown 时，可切换到源码模式编辑。</p>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground xl:hidden">
              粘贴或拖拽图片会自动压缩上传。
            </p>
          </section>
        </main>

        <aside className="post-editor-sidebar space-y-3 xl:sticky xl:top-20 xl:self-start">
          <section className="admin-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">发布</h2>
              <span className="text-xs text-muted-foreground">
                {status === 'published' ? '已发布' : status === 'archived' ? '已归档' : '草稿'}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as PostStatus)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已归档</option>
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/admin')}>
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '保存中...' : post ? '更新' : '创建'}
              </Button>
            </div>

            {post && (
              showDelete ? (
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending} className="flex-1">
                    删除
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDelete(false)} className="flex-1">
                    保留
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="mt-3 w-full text-muted-foreground hover:text-destructive"
                >
                  删除文章
                </Button>
              )
            )}
          </section>

          <section className="admin-panel p-4">
            <h2 className="mb-3 text-sm font-medium text-foreground">封面</h2>
            <div className="space-y-3">
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="aspect-video w-full rounded-md border border-border object-cover"
                />
              )}
              <Input
                id="cover"
                type="url"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                placeholder="https://example.com/image.jpg"
                className="h-8 text-xs"
                aria-label="封面图片 URL"
              />
              <div className="flex items-center gap-2">
                <ImageUpload
                  compact
                  config={uploadConfig}
                  onUploaded={(url) => setCoverImageUrl(url)}
                />
                {coverImageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverImageUrl('')}
                    className="text-muted-foreground"
                  >
                    清除
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="admin-panel p-4">
            <h2 className="mb-3 text-sm font-medium text-foreground">标签</h2>
            {allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无标签</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selectedTags.includes(tag.id)
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="admin-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">SEO</h2>
              <button
                type="button"
                onClick={() => setShowSeo((value) => !value)}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                aria-expanded={showSeo}
              >
                {showSeo ? '收起' : '展开'}
              </button>
            </div>

            {showSeo && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seoTitle">SEO 标题</Label>
                  <Input
                    id="seoTitle"
                    value={seoTitle}
                    onChange={(event) => setSeoTitle(event.target.value)}
                    placeholder="自定义 SEO 标题"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoDescription">SEO 描述</Label>
                  <Textarea
                    id="seoDescription"
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                    placeholder="自定义 SEO 描述"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="canonicalUrl">Canonical URL</Label>
                  <Input
                    id="canonicalUrl"
                    type="url"
                    value={canonicalUrl}
                    onChange={(event) => setCanonicalUrl(event.target.value)}
                    placeholder="https://example.com/original-post"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    id="noindex"
                    checked={noindex}
                    onChange={(event) => setNoindex(event.target.checked)}
                    className="rounded border-input"
                  />
                  禁止搜索引擎索引
                </label>
              </div>
            )}
          </section>

          {children}
        </aside>
      </form>
    </div>
  )
}
