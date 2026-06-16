export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  }
  return value;
}

export function getSupabaseAnonKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return value;
}

export function getSupabaseServiceRoleKey(): string {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY",
    );
  }
  return value;
}

export function getIpHashSecret(): string {
  const value = process.env.IP_HASH_SECRET;
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing required environment variable: IP_HASH_SECRET. Generate one with `openssl rand -hex 32`.",
    );
  }

  return "quietpress-development-ip-hash-secret";
}

export function getDefaultSiteUrl(): string {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
}

export function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}
