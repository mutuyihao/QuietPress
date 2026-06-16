import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getIpHashSecret } from "@/lib/env";

const UNKNOWN_CLIENT = "unknown";

function stableHashSalt(): string {
  return getIpHashSecret();
}

function getTrustedProxyHops(): number {
  const value = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getForwardedClientAddress(value: string | null): string | null {
  const addresses =
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) || [];

  if (addresses.length === 0) return null;

  const index = Math.max(0, addresses.length - getTrustedProxyHops());
  return addresses[index] || null;
}

export function hashSensitiveValue(
  value: string | null | undefined,
  scope = "default",
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  return createHash("sha256")
    .update(`${scope}:${stableHashSalt()}:${normalized}`)
    .digest("hex");
}

export function getClientAddress(request: NextRequest | Request): string {
  return (
    getForwardedClientAddress(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip")?.trim() ||
    UNKNOWN_CLIENT
  );
}

export function getClientFingerprint(request: NextRequest | Request): string {
  const ipHash =
    hashSensitiveValue(getClientAddress(request), "ip") || UNKNOWN_CLIENT;
  const userAgentHash =
    hashSensitiveValue(request.headers.get("user-agent"), "ua") ||
    UNKNOWN_CLIENT;
  return `${ipHash}:${userAgentHash}`;
}

export function newRequestId(): string {
  return randomUUID();
}
