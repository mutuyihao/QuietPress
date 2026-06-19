import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const configuredImageOrigins = Array.from(
  new Set(
    [
      getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
      getOrigin(process.env.S3_PUBLIC_URL_BASE),
    ].filter(Boolean),
  ),
);

function serializeCsp(directives: string[]): string {
  return directives
    .filter(Boolean)
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildProtectedRouteCsp(nonce: string): string {
  return serializeCsp([
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in ${configuredImageOrigins.join(" ")}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    `connect-src 'self' https://*.supabase.co https://*.supabase.in https://vitals.vercel-insights.com${isDev ? " http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*" : ""}`,
    "form-action 'self'",
    isDev ? "" : "upgrade-insecure-requests",
  ]);
}

export function isProtectedPageRoute(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

export async function proxy(request: NextRequest) {
  if (!isProtectedPageRoute(request.nextUrl.pathname)) {
    return await updateSession(request);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = buildProtectedRouteCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
