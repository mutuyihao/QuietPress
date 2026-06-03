import { getSiteSettingsAdmin } from '@/lib/admin-queries'
import { SettingsForm } from '@/components/settings-form'

export default async function AdminSettingsPage() {
  const settings = await getSiteSettingsAdmin()

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">站点设置</h1>
      </div>
      <SettingsForm settings={settings} />
    </div>
  )
}
