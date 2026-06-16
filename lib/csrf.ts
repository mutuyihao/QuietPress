import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";

function hostFromHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function validateSameOriginRequest(request: NextRequest | Request) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

  const requestUrl = new URL(request.url);
  const expectedHost = requestUrl.host.toLowerCase();
  const originHost = hostFromHeader(request.headers.get("origin"));
  const refererHost = hostFromHeader(request.headers.get("referer"));

  if (originHost) {
    return originHost === expectedHost
      ? null
      : apiError("CSRF_ORIGIN_MISMATCH", "Request origin is not allowed.", 403);
  }

  if (refererHost) {
    return refererHost === expectedHost
      ? null
      : apiError(
          "CSRF_REFERER_MISMATCH",
          "Request referer is not allowed.",
          403,
        );
  }

  return apiError(
    "CSRF_MISSING_ORIGIN",
    "Missing Origin or Referer header.",
    403,
  );
}
