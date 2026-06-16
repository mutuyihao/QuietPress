import type { SiteSettings } from "@/lib/types";
import {
  getImageUploadConfig,
  getImageUploadMaxSizeBytes,
} from "@/lib/image-upload-config";
import {
  getAllStorageProviderEnvironmentStatuses,
  getStorageProvider,
  getStorageProviderEnvironmentStatus,
  normalizeStorageProvider,
} from "@/lib/storage";
import { getDefaultStorageQuota } from "./defaults";
import type { StorageUsageOverview } from "./usage";
import { formatStorageBytes, getStorageUsagePercent } from "./usage";

const BYTES_PER_MB = 1024 * 1024;

export interface StorageDashboard extends StorageUsageOverview {
  providerStatuses: ReturnType<typeof getAllStorageProviderEnvironmentStatuses>;
}

export async function getStorageDashboard(
  settings: SiteSettings | null,
): Promise<StorageDashboard> {
  const activeProvider = normalizeStorageProvider(
    settings?.storage_provider || process.env.STORAGE_PROVIDER || "supabase",
  );
  const providerStatus = getStorageProviderEnvironmentStatus(activeProvider);
  const quotaMb = Number(settings?.storage_quota_mb || 0);
  const defaultQuota =
    quotaMb > 0 ? null : getDefaultStorageQuota(activeProvider);
  const effectiveQuotaMb = quotaMb > 0 ? quotaMb : (defaultQuota?.quotaMb ?? 0);
  const quotaBytes =
    effectiveQuotaMb > 0 ? effectiveQuotaMb * BYTES_PER_MB : null;
  const quotaSource = quotaMb > 0 ? "manual" : (defaultQuota?.source ?? null);
  const configuredMaxUploadBytes = getImageUploadMaxSizeBytes(
    getImageUploadConfig(settings),
  );

  let usedBytes: number | null = null;
  let objectCount: number | null = null;
  let bucketFileSizeLimitBytes: number | null = null;
  let usageSource: string | null = null;
  let usageError: string | null = null;

  if (providerStatus.configured) {
    try {
      const provider = await getStorageProvider(activeProvider);
      if (provider.getUsage) {
        const usage = await provider.getUsage();
        usedBytes = usage.usedBytes;
        objectCount = usage.objectCount;
        bucketFileSizeLimitBytes = usage.bucketFileSizeLimitBytes ?? null;
        usageSource = usage.source ?? provider.name;
      } else {
        usageError = "当前存储适配器尚未实现用量扫描。";
      }
    } catch (err) {
      usageError = err instanceof Error ? err.message : "读取存储用量失败。";
    }
  } else {
    usageError = `当前 provider 缺少环境变量：${providerStatus.missingEnv.join(", ")}`;
  }

  const maxUploadBytes =
    bucketFileSizeLimitBytes !== null
      ? Math.min(configuredMaxUploadBytes, bucketFileSizeLimitBytes)
      : configuredMaxUploadBytes;

  return {
    activeProvider,
    providerStatuses: getAllStorageProviderEnvironmentStatuses(),
    usedBytes,
    objectCount,
    quotaBytes,
    quotaSource,
    availableBytes:
      quotaBytes !== null && usedBytes !== null
        ? Math.max(0, quotaBytes - usedBytes)
        : null,
    maxUploadBytes,
    bucketFileSizeLimitBytes,
    usageSource,
    usageError,
  };
}

export type { StorageUsageOverview };
export { formatStorageBytes, getStorageUsagePercent };
