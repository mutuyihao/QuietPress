"use client";

import type { StorageUsageOverview } from "@/lib/storage/usage";
import {
  formatStorageBytes,
  getStorageQuotaSourceLabel,
  getStorageUsagePercent,
} from "@/lib/storage/usage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StorageUsageSummaryProps {
  usage: StorageUsageOverview;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}

export function StorageUsageSummary({
  usage,
  title = "容量概览",
  description,
  compact = false,
  className,
}: StorageUsageSummaryProps) {
  const usagePercent = getStorageUsagePercent(
    usage.usedBytes,
    usage.quotaBytes,
  );
  const objectCountText =
    usage.objectCount === null
      ? "对象数量未知"
      : `共 ${usage.objectCount} 个对象`;
  const quotaSourceText = getStorageQuotaSourceLabel(usage.quotaSource);
  const descriptionText = description
    ? `${description} · ${objectCountText}`
    : objectCountText;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{descriptionText}</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "space-y-2")}>
        <Progress value={usagePercent} />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {usage.quotaBytes === null
              ? "未设置总容量配额"
              : `已使用 ${usagePercent}%`}
          </span>
          <span>
            {formatStorageBytes(usage.usedBytes)} /{" "}
            {formatStorageBytes(usage.quotaBytes)}
          </span>
        </div>

        <div
          className={cn(
            "grid gap-3 text-sm",
            compact ? "grid-cols-2" : "sm:grid-cols-4",
          )}
        >
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">已用容量</p>
            <p className="mt-1 font-medium text-foreground">
              {formatStorageBytes(usage.usedBytes)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">总配额</p>
            <p className="mt-1 font-medium text-foreground">
              {formatStorageBytes(usage.quotaBytes)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {quotaSourceText}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">可用容量</p>
            <p className="mt-1 font-medium text-foreground">
              {formatStorageBytes(usage.availableBytes)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">单文件上限</p>
            <p className="mt-1 font-medium text-foreground">
              {formatStorageBytes(usage.maxUploadBytes)}
            </p>
          </div>
        </div>

        {usage.bucketFileSizeLimitBytes !== null && (
          <p className="text-xs text-muted-foreground">
            桶单文件限制：{formatStorageBytes(usage.bucketFileSizeLimitBytes)}。
          </p>
        )}

        {usage.usageError && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {usage.usageError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
