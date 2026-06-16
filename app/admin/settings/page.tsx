import Link from "next/link";
import { ArrowRight, MoveRight } from "lucide-react";

import { getSiteSettingsAdmin } from "@/lib/admin-queries";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettingsAdmin();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">站点设置</h1>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="admin-section-title flex items-center gap-2">
              <MoveRight className="size-4" />
              内容迁移
            </h2>
            <p className="text-sm text-muted-foreground">
              导出整站内容包，或导入 QuietPress 迁移包完成站点迁移。
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/settings/migration">
              打开迁移工具
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
      <SettingsForm settings={settings} />
    </div>
  );
}
