/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const staticImageRemotePatterns = [
  { protocol: "https", hostname: "**.supabase.co" },
  { protocol: "https", hostname: "**.supabase.in" },
];

function getOrigin(value) {
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

function getImageRemotePattern(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
    };
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

const configuredImageRemotePatterns = [
  getImageRemotePattern(process.env.NEXT_PUBLIC_SUPABASE_URL),
  getImageRemotePattern(process.env.S3_PUBLIC_URL_BASE),
].filter(Boolean);

const ogFontTraceIncludes = [
  "./node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff",
  "./node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff",
];

const defaultCspHeader = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in ${configuredImageOrigins.join(" ")}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    `connect-src 'self' https://*.supabase.co https://*.supabase.in https://vitals.vercel-insights.com${isDev ? " http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*" : ""}`,
    "form-action 'self'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; "),
};

const baseSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "**/opengraph-image*": ogFontTraceIncludes,
  },
  allowedDevOrigins: ["172.18.0.1"],
  compiler: {
    removeConsole: isDev ? false : { exclude: ["error"] },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    remotePatterns: [
      ...staticImageRemotePatterns,
      ...configuredImageRemotePatterns,
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        source: "/((?!admin(?:/|$)|auth(?:/|$)).*)",
        headers: [defaultCspHeader],
      },
    ];
  },
};

export default nextConfig;
