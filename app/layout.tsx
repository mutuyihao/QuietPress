import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
} from "@/lib/site-defaults";
import { DEFAULT_LOCALE } from "@/lib/date-format";
import { getDefaultSiteUrl } from "@/lib/env";
import { getSiteSettings } from "@/lib/queries";
import { ThemeProvider } from "@/components/theme-provider";
import { OrganizationLD, WebSiteLD } from "@/components/json-ld";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-400-italic.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "./globals.css";

function getPreconnectOrigins(): string[] {
  return Array.from(
    new Set(
      [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.S3_PUBLIC_URL_BASE]
        .map((value) => {
          if (!value) return null;
          try {
            return new URL(value).origin;
          } catch {
            return null;
          }
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getMetadataBase(baseUrl: string | null | undefined): URL {
  try {
    return new URL(baseUrl || getDefaultSiteUrl());
  } catch {
    return new URL(getDefaultSiteUrl());
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings?.site_name || DEFAULT_SITE_NAME;
  const siteDescription =
    settings?.site_description || DEFAULT_SITE_DESCRIPTION;

  return {
    metadataBase: getMetadataBase(settings?.base_url),
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    alternates: {
      types: {
        "application/rss+xml": "/rss.xml",
      },
    },
    openGraph: {
      title: siteName,
      description: siteDescription,
      siteName,
      images: settings?.default_og_image_url
        ? [{ url: settings.default_og_image_url, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: siteDescription,
      images: settings?.default_og_image_url
        ? [settings.default_og_image_url]
        : undefined,
    },
    icons: {
      icon: [
        {
          url: "/icon-light-32x32.png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/icon-dark-32x32.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      apple: "/apple-icon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const preconnectOrigins = getPreconnectOrigins();

  return (
    <html
      lang={DEFAULT_LOCALE}
      className="bg-background"
      suppressHydrationWarning
    >
      <head>
        {preconnectOrigins.map((origin) => (
          <link key={origin} rel="preconnect" href={origin} crossOrigin="" />
        ))}
        <OrganizationLD settings={settings} />
        <WebSiteLD settings={settings} />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
