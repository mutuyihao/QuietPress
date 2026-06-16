import { apiOk, withApiRoute } from "@/lib/api-response";
import {
  getStorageProviderEnvironmentStatus,
  normalizeStorageProvider,
} from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicClient } from "@/lib/supabase/public";
import packageJson from "@/package.json";

interface HealthCheck {
  status: "ok" | "error";
  latency_ms?: number;
  missingEnv?: string[];
}

export const GET = withApiRoute("health.GET", async (request: Request) => {
  const checks: Record<string, HealthCheck> = {};
  const { searchParams } = new URL(request.url);

  const dbStart = Date.now();
  try {
    const supabase = createPublicClient();
    const { error } = await supabase
      .from("site_settings")
      .select("id")
      .limit(1);
    checks.db = {
      status: error ? "error" : "ok",
      latency_ms: Date.now() - dbStart,
    };
  } catch {
    checks.db = { status: "error", latency_ms: Date.now() - dbStart };
  }

  const storageProvider = normalizeStorageProvider(
    process.env.STORAGE_PROVIDER || "supabase",
  );
  const storageStatus = getStorageProviderEnvironmentStatus(storageProvider);
  checks.storage = {
    status: storageStatus.configured ? "ok" : "error",
    missingEnv: storageStatus.missingEnv,
  };

  checks.auth = {
    status:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
        ? "ok"
        : "error",
    missingEnv:
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
        ? []
        : ["SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY"],
  };

  if (searchParams.get("deep") === "1") {
    const rateLimitStart = Date.now();
    try {
      const service = createServiceClient();
      const { error } = await service.rpc("check_rate_limit", {
        rate_key: `health:${Date.now()}`,
        window_seconds: 60,
        max_requests: 30,
      });
      checks.rateLimit = {
        status: error ? "error" : "ok",
        latency_ms: Date.now() - rateLimitStart,
      };
    } catch {
      checks.rateLimit = {
        status: "error",
        latency_ms: Date.now() - rateLimitStart,
      };
    }
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    null;

  return apiOk(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      commit,
      region: process.env.VERCEL_REGION || process.env.AWS_REGION || null,
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
});
