import { notFound } from 'next/navigation'
import { getPostByIdAdmin, getAllTagsAdmin, getSiteSettingsAdmin } from '@/lib/admin-queries'
import { getImageUploadConfig } from '@/lib/image-upload-config'
import { PostEditor } from '@/components/post-editor'
import { RevisionViewer } from '@/components/revision-viewer'

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params
  const [post, tags, settings] = await Promise.all([
    getPostByIdAdmin(id),
    getAllTagsAdmin(),
    getSiteSettingsAdmin(),
  ])

  if (!post) {
    notFound()
  }

  return (
    <div className="admin-page admin-editor-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">编辑文章</h1>
      </div>
      <PostEditor post={post} allTags={tags} uploadConfig={getImageUploadConfig(settings)}>
        <RevisionViewer
          postId={post.id}
          currentContent={post.content_markdown}
          currentTitle={post.title}
          currentExcerpt={post.excerpt}
        />
      </PostEditor>
    </div>
  )
}
