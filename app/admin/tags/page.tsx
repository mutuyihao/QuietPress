import { getAllTagsAdmin } from '@/lib/admin-queries'
import { TagManager } from '@/components/tag-manager'

export default async function AdminTagsPage() {
  const tags = await getAllTagsAdmin()

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">标签管理</h1>
      </div>
      <TagManager tags={tags} />
    </div>
  )
}
