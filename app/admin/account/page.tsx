import { AccountPasswordForm } from '@/components/account-password-form'
import { getAdminSession } from '@/lib/admin-auth'

export default async function AdminAccountPage() {
  const session = await getAdminSession()

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Account</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session?.user.email || 'unknown user'}.
        </p>
      </div>
      <AccountPasswordForm />
    </div>
  )
}
