import {
  getIpHashSecret,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";
import {
  getStorageProviderEnvironmentStatus,
  normalizeStorageProvider,
} from "@/lib/storage";
import { logger } from "@/lib/logger";

function collectEnvIssues(): string[] {
  const issues: string[] = [];

  for (const check of [
    getSupabaseUrl,
    getSupabaseAnonKey,
    getSupabaseServiceRoleKey,
    getIpHashSecret,
  ]) {
    try {
      check();
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    issues.push("Missing required environment variable: CRON_SECRET");
  }

  const storageProvider = normalizeStorageProvider(
    process.env.STORAGE_PROVIDER || "supabase",
  );
  const storageStatus = getStorageProviderEnvironmentStatus(storageProvider);
  if (!storageStatus.configured) {
    issues.push(
      `${storageStatus.label} is missing required environment variables: ${storageStatus.missingEnv.join(", ")}`,
    );
  }

  return issues;
}

export function validateEnvOrThrow(): void {
  const issues = collectEnvIssues();
  if (issues.length === 0) return;

  const message = `Environment validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  logger.warn("environment validation failed", { issues });
}
