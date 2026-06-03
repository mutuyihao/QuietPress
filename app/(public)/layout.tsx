import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ScrollToTop } from '@/components/scroll-to-top'
import { DEFAULT_SITE_NAME } from '@/lib/site-defaults'
import { getSiteSettings } from '@/lib/queries'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSiteSettings()
  const siteName = settings?.site_name || DEFAULT_SITE_NAME

  return (
    <>
      <Header siteName={siteName} />
      <main className="flex-1 min-h-0">
        {children}
      </main>
      <Footer siteName={siteName} socialLinks={settings?.social_links} />
      <ScrollToTop />
    </>
  )
}
