"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/lazy-toast";
import { updateStorageSettings } from "@/lib/actions";
import type {
  StorageProviderEnvironmentStatus,
  StorageProviderName,
} from "@/lib/storage";
import {
  formatStorageBytes,
  getStorageQuotaSourceLabel,
  type StorageQuotaSource,
} from "@/lib/storage/usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StorageSettingsFormProps {
  activeProvider: StorageProviderName;
  quotaMb: number;
  inferredQuotaBytes: number | null;
  inferredQuotaSource: StorageQuotaSource | null;
  providerStatuses: StorageProviderEnvironmentStatus[];
}

export function StorageSettingsForm({
  activeProvider,
  quotaMb,
  inferredQuotaBytes,
  inferredQuotaSource,
  providerStatuses,
}: StorageSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [provider, setProvider] = useState<StorageProviderName>(activeProvider);
  const [quota, setQuota] = useState(quotaMb);

  const selectedStatus = providerStatuses.find(
    (status) => status.provider === provider,
  );
  const showInferredQuota =
    quota === 0 && provider === activeProvider && inferredQuotaBytes !== null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("storage_provider", provider);
    formData.append("storage_quota_mb", String(quota));

    startTransition(async () => {
      const result = await updateStorageSettings(formData);
      if (!result.success) {
        toast.error(result.error || "保存失败");
        return;
      }

      toast.success("存储设置已保存");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>上传存储后端</Label>
        <Select
          value={provider}
          onValueChange={(value) => setProvider(value as StorageProviderName)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择存储后端" />
          </SelectTrigger>
          <SelectContent>
            {providerStatuses.map((status) => (
              <SelectItem
                key={status.provider}
                value={status.provider}
                disabled={!status.configured}
              >
                {status.label}
                {status.configured ? "" : "（未配置）"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="storageQuotaMb">总容量配额 (MB)</Label>
        <Input
          id="storageQuotaMb"
          type="number"
          min={0}
          max={10_485_760}
          value={quota}
          onChange={(event) => setQuota(Number(event.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          设为 0 使用默认配额；需要精确容量时填写实际配额。
        </p>
        {showInferredQuota && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            当前按 {formatStorageBytes(inferredQuotaBytes)}（
            {getStorageQuotaSourceLabel(inferredQuotaSource)}）计算可用容量。
          </p>
        )}
      </div>

      {selectedStatus && !selectedStatus.configured && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          缺少环境变量：{selectedStatus.missingEnv.join(", ")}
        </p>
      )}

      <Button type="submit" disabled={isPending || !selectedStatus?.configured}>
        {isPending ? "保存中..." : "保存存储设置"}
      </Button>
    </form>
  );
}
