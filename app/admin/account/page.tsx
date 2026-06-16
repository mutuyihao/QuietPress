import { AccountPasswordForm } from "@/components/account-password-form";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminAccountPage() {
  const session = await getAdminSession();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">账号设置</h1>
        <p className="text-sm text-muted-foreground">
          当前登录账号：{session?.user.email || "未知用户"}。
        </p>
      </div>
      <AccountPasswordForm />
    </div>
  );
}
