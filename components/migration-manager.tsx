'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle, Download, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type {
  ImportedMediaResult,
  MigrationPreview,
  MigrationPostAction,
  MigrationTagAction,
  QuietPressExportV1,
} from '@/lib/migration/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MAX_CLIENT_IMPORT_BYTES = 10 * 1024 * 1024

interface ImportResult {
  database: {
    settings_imported?: boolean
    tags_created?: number
    tags_reused?: number
    tags_updated?: number
    posts_created?: number
    posts_overwritten?: number
    posts_skipped?: number
    posts_duplicated?: number
  }
  media: {
    uploaded: ImportedMediaResult[]
    failed: ImportedMediaResult[]
    skipped: ImportedMediaResult[]
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCandidatePackage(raw: unknown): QuietPressExportV1 {
  if (raw && typeof raw === 'object' && 'package' in raw) {
    return (raw as { package: QuietPressExportV1 }).package
  }

  return raw as QuietPressExportV1
}

async function readJsonFile(file: File): Promise<QuietPressExportV1> {
  if (file.size > MAX_CLIENT_IMPORT_BYTES) {
    throw new Error('导入包不能超过 10MB')
  }

  const text = await file.text()
  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('导入包必须是有效 JSON 文件')
  }

  return getCandidatePackage(raw)
}

async function fetchPreview(migrationPackage: QuietPressExportV1): Promise<MigrationPreview> {
  const response = await fetch('/api/admin/migration/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(migrationPackage),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || '预检失败')
  }

  return data as MigrationPreview
}

async function runImport(
  migrationPackage: QuietPressExportV1,
  options: {
    importSettings: boolean
    importMedia: boolean
    postActions: Record<string, MigrationPostAction>
    tagActions: Record<string, MigrationTagAction>
  },
): Promise<ImportResult> {
  const response = await fetch('/api/admin/migration/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: migrationPackage, options }),
  })
  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || '导入失败')
  }

  return data.result as ImportResult
}

function ResultStat({ label, value }: { label: string; value: number | boolean | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">
        {typeof value === 'boolean' ? (value ? '是' : '否') : value ?? 0}
      </p>
    </div>
  )
}

function MediaResultList({ title, items }: { title: string; items: ImportedMediaResult[] }) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="max-h-52 overflow-auto rounded-lg border border-border">
        {items.map((item) => (
          <div key={`${item.originalUrl}-${item.importedUrl || item.error || item.path}`} className="border-b border-border px-3 py-2 text-xs last:border-b-0">
            <p className="break-all text-foreground">{item.originalUrl}</p>
            {item.importedUrl && <p className="mt-1 break-all text-muted-foreground">→ {item.importedUrl}</p>}
            {item.error && <p className="mt-1 text-destructive">{item.error}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MigrationManager() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [migrationPackage, setMigrationPackage] = useState<QuietPressExportV1 | null>(null)
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [postActions, setPostActions] = useState<Record<string, MigrationPostAction>>({})
  const [tagActions, setTagActions] = useState<Record<string, MigrationTagAction>>({})
  const [importSettings, setImportSettings] = useState(true)
  const [importMedia, setImportMedia] = useState(true)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPreviewPending, startPreviewTransition] = useTransition()
  const [isImportPending, startImportTransition] = useTransition()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setMigrationPackage(null)
    setPreview(null)
    setResult(null)
    setPostActions({})
    setTagActions({})

    startPreviewTransition(async () => {
      try {
        const nextPackage = await readJsonFile(file)
        const nextPreview = await fetchPreview(nextPackage)

        setMigrationPackage(nextPackage)
        setPreview(nextPreview)
        setImportSettings(nextPreview.summary.settings)
        setImportMedia(nextPreview.summary.media > 0)
        setPostActions(Object.fromEntries(
          nextPreview.conflicts.posts.map((conflict) => [conflict.slug, 'skip' as MigrationPostAction]),
        ))
        setTagActions(Object.fromEntries(
          nextPreview.conflicts.tags.map((conflict) => [conflict.slug, 'reuse' as MigrationTagAction]),
        ))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '导入包预检失败')
      }
    })
  }

  const handleImport = () => {
    if (!migrationPackage || !preview) return

    startImportTransition(async () => {
      try {
        const nextResult = await runImport(migrationPackage, {
          importSettings,
          importMedia,
          postActions,
          tagActions,
        })
        setResult(nextResult)
        toast.success('导入完成')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '导入失败')
      }
    })
  }

  const updatePostAction = (slug: string, action: MigrationPostAction) => {
    setPostActions((current) => ({ ...current, [slug]: action }))
  }

  const updateTagAction = (slug: string, action: MigrationTagAction) => {
    setTagActions((current) => ({ ...current, [slug]: action }))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              导出整站内容包
            </CardTitle>
            <CardDescription>
              导出文章、标签、站点内容设置和媒体引用清单。管理员账号、评论、订阅、统计和修订历史不会导出。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/admin/migration/export" download>
                下载 quietpress-export-v1.json
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              导入内容包
            </CardTitle>
            <CardDescription>
              选择 QuietPress v1 JSON 包后会先预检冲突，确认后才会写入当前站点。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="migrationFile">迁移包 JSON 文件</Label>
              <Input
                id="migrationFile"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                disabled={isPreviewPending || isImportPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedFileName ? `已选择：${selectedFileName}` : '最大 10MB；仅支持 QuietPress 自有导出包。'}
            </p>
            {isPreviewPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在预检导入包...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>预检结果</CardTitle>
            <CardDescription>
              导出时间 {formatDate(preview.meta.exported_at)}
              {preview.meta.source_url ? ` · 来源 ${preview.meta.source_url}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <ResultStat label="文章" value={preview.summary.posts} />
              <ResultStat label="标签" value={preview.summary.tags} />
              <ResultStat label="媒体引用" value={preview.summary.media} />
              <ResultStat label="站点设置" value={preview.summary.settings} />
              <ResultStat label="无效媒体 URL" value={preview.summary.invalidMediaUrls} />
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    {preview.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Checkbox
                  checked={importSettings}
                  onCheckedChange={(checked) => setImportSettings(Boolean(checked))}
                  disabled={!preview.summary.settings || isImportPending}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">导入站点内容设置</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    会导入站点名称、描述、关于页、社交链接、评论和图片上传配置；目标站点的存储后端环境变量不会被改动。
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Checkbox
                  checked={importMedia}
                  onCheckedChange={(checked) => setImportMedia(Boolean(checked))}
                  disabled={preview.summary.media === 0 || isImportPending}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">重拉并上传媒体</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    从原公开 URL 拉取图片并上传到当前存储；失败时保留原 URL 并在结果中报告。
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">文章冲突</h3>
                {preview.conflicts.posts.length === 0 ? (
                  <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
                    未发现同 slug 文章。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {preview.conflicts.posts.map((conflict) => (
                      <div key={conflict.slug} className="rounded-lg border border-border p-3">
                        <div className="mb-3 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{conflict.slug}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            导入：{conflict.importedTitle} · 现有：{conflict.existingTitle}
                          </p>
                        </div>
                        <Select
                          value={postActions[conflict.slug] || 'skip'}
                          onValueChange={(value) => updatePostAction(conflict.slug, value as MigrationPostAction)}
                          disabled={isImportPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">跳过现有文章</SelectItem>
                            <SelectItem value="overwrite">覆盖现有文章</SelectItem>
                            <SelectItem value="duplicate">另存为副本</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">标签冲突</h3>
                {preview.conflicts.tags.length === 0 ? (
                  <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
                    未发现同 slug 不同名标签。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {preview.conflicts.tags.map((conflict) => (
                      <div key={conflict.slug} className="rounded-lg border border-border p-3">
                        <div className="mb-3 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{conflict.slug}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            导入：{conflict.importedName} · 现有：{conflict.existingName}
                          </p>
                        </div>
                        <Select
                          value={tagActions[conflict.slug] || 'reuse'}
                          onValueChange={(value) => updateTagAction(conflict.slug, value as MigrationTagAction)}
                          disabled={isImportPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reuse">复用现有标签</SelectItem>
                            <SelectItem value="overwrite">覆盖标签名称</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleImport} disabled={isImportPending || !migrationPackage}>
                {isImportPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isImportPending ? '正在导入...' : '确认并执行导入'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              导入结果
            </CardTitle>
            <CardDescription>内容已写入，缓存已刷新。媒体失败项不会阻断内容导入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ResultStat label="设置已导入" value={result.database.settings_imported} />
              <ResultStat label="新建标签" value={result.database.tags_created} />
              <ResultStat label="复用标签" value={result.database.tags_reused} />
              <ResultStat label="更新标签" value={result.database.tags_updated} />
              <ResultStat label="新建文章" value={result.database.posts_created} />
              <ResultStat label="覆盖文章" value={result.database.posts_overwritten} />
              <ResultStat label="跳过文章" value={result.database.posts_skipped} />
              <ResultStat label="副本文章" value={result.database.posts_duplicated} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <MediaResultList title={`媒体已重拉 (${result.media.uploaded.length})`} items={result.media.uploaded} />
              <MediaResultList title={`媒体失败 (${result.media.failed.length})`} items={result.media.failed} />
              <MediaResultList title={`媒体跳过 (${result.media.skipped.length})`} items={result.media.skipped} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
