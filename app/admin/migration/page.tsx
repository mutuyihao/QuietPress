import { MigrationManager } from '@/components/migration-manager'

export default function AdminMigrationPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">迁移</h1>
        <p className="admin-page-description">
          导出当前站点内容，或导入 QuietPress 内容包完成站点迁移。
        </p>
      </div>
      <MigrationManager />
    </div>
  )
}
