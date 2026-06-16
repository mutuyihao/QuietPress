import { getSiteSettingsAdmin } from "@/lib/admin-queries";
import { getStorageDashboard } from "@/lib/storage/dashboard";
import { getStorageProviderLabel } from "@/lib/storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StorageSettingsForm } from "@/components/storage-settings-form";
import { StorageUsageSummary } from "@/components/storage-usage-summary";

export default async function AdminStoragePage() {
  const settings = await getSiteSettingsAdmin();
  const dashboard = await getStorageDashboard(settings);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">存储管理</h1>
        <p className="admin-page-description">管理图片上传后端和容量配额。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <StorageUsageSummary usage={dashboard} />

        <Card>
          <CardHeader>
            <CardTitle>切换上传后端</CardTitle>
            <CardDescription>仅影响后续上传。</CardDescription>
          </CardHeader>
          <CardContent>
            <StorageSettingsForm
              activeProvider={dashboard.activeProvider}
              quotaMb={settings?.storage_quota_mb ?? 0}
              inferredQuotaBytes={
                dashboard.quotaSource === "manual" ? null : dashboard.quotaBytes
              }
              inferredQuotaSource={
                dashboard.quotaSource === "manual"
                  ? null
                  : dashboard.quotaSource
              }
              providerStatuses={dashboard.providerStatuses}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>后端状态</CardTitle>
          <CardDescription>
            当前：{getStorageProviderLabel(dashboard.activeProvider)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-lg border border-border">
            {dashboard.providerStatuses.map((status) => (
              <div
                key={status.provider}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{status.label}</p>
                  {!status.configured && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      缺少：{status.missingEnv.join(", ")}
                    </p>
                  )}
                </div>
                <span
                  className={
                    status.configured
                      ? "text-sm text-foreground"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {status.configured ? "已配置" : "未配置"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
