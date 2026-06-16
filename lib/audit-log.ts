import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientAddress, hashSensitiveValue } from "@/lib/privacy";
import { logger } from "@/lib/logger";

export interface AdminAuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
  userId?: string | null;
}

export async function logAdminAction(
  supabase: SupabaseClient,
  input: AdminAuditInput,
): Promise<void> {
  try {
    const userId =
      input.userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;

    const { error } = await supabase.from("admin_audit_logs").insert({
      user_id: userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ip_hash: input.request
        ? hashSensitiveValue(getClientAddress(input.request), "ip")
        : null,
      user_agent_hash: input.request
        ? hashSensitiveValue(input.request.headers.get("user-agent"), "ua")
        : null,
    });

    if (error && !error.message.includes("admin_audit_logs")) {
      logger.warn("failed to write admin audit log", {
        err: error,
        action: input.action,
      });
    }
  } catch (error) {
    logger.warn("failed to write admin audit log", {
      err: error,
      action: input.action,
    });
  }
}
