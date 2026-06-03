import type { Metadata } from 'next'
import { Source_Serif_4, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME } from '@/lib/site-defaults'
import { getSiteSettings } from '@/lib/queries'
import { ThemeProvider } from '@/components/theme-provider'
import { OrganizationLD, WebSiteLD } from '@/components/json-ld'
import './globals.css'

const sourceSerif = Source_Serif_4({ 
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const siteName = settings?.site_name || DEFAULT_SITE_NAME
  const siteDescription = settings?.site_description || DEFAULT_SITE_DESCRIPTION

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    alternates: {
      types: {
        'application/rss+xml': '/rss.xml',
      },
    },
    openGraph: {
      title: siteName,
      description: siteDescription,
      siteName,
      images: settings?.default_og_image_url ? [{ url: settings.default_og_image_url, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: siteName,
      description: siteDescription,
      images: settings?.default_og_image_url ? [settings.default_og_image_url] : undefined,
    },
    icons: {
      icon: [
        {
          url: '/icon-light-32x32.png',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/icon-dark-32x32.png',
          media: '(prefers-color-scheme: dark)',
        },
        {
          url: '/icon.svg',
          type: 'image/svg+xml',
        },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await getSiteSettings()

  return (
    <html lang="zh-CN" className={`${sourceSerif.variable} ${inter.variable} bg-background`} suppressHydrationWarning>
      <head>
        <OrganizationLD settings={settings} />
        <WebSiteLD settings={settings} />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
