'use client'

import dynamic from 'next/dynamic'
import { forwardRef, type ComponentType, type ForwardedRef } from 'react'
import type { MDXEditorMethods, MDXEditorProps } from '@mdxeditor/editor'
import type { ImageUploadConfig } from '@/lib/image-upload-config'

type RichMarkdownEditorProps = MDXEditorProps & {
  imageUploadConfig: ImageUploadConfig
}

type InitializedEditorProps = RichMarkdownEditorProps & {
  editorRef: ForwardedRef<MDXEditorMethods> | null
}

const Editor = dynamic(
  () => import('./initialized-mdx-editor') as Promise<{ default: ComponentType<InitializedEditorProps> }>,
  {
    ssr: false,
    loading: () => (
      <div className="rich-editor-loading rounded-lg border border-border/40 bg-muted/10 p-6 text-sm text-muted-foreground">
        正在加载富文本编辑器...
      </div>
    ),
  },
)

export const RichMarkdownEditor = forwardRef<MDXEditorMethods, RichMarkdownEditorProps>((props, ref) => (
  <Editor {...props} editorRef={ref} />
))

RichMarkdownEditor.displayName = 'RichMarkdownEditor'
