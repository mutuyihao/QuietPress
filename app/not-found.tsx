import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getSiteSettings } from "@/lib/queries";
import { DEFAULT_SITE_NAME } from "@/lib/site-defaults";

export default async function RootNotFound() {
  const settings = await getSiteSettings();
  const siteName = settings?.site_name || DEFAULT_SITE_NAME;

  return (
    <>
      <Header siteName={siteName} />
      <main className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6 animate-fade-in">
        <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground/60">
          404 Error
        </span>
        <h1 className="mt-4 font-serif text-[1.75rem] sm:text-[2rem] font-bold text-foreground leading-tight tracking-tight">
          页面没有找到
        </h1>
        <p className="mt-4 text-sm text-muted-foreground/80 max-w-[360px] leading-relaxed">
          这篇内容可能已经移动或不存在。你可以从首页、标签或归档继续浏览。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-foreground border-b border-foreground/30 hover:border-foreground pb-0.5 transition-all duration-300"
          >
            返回首页 &rarr;
          </Link>
          <Link
            href="/tags"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-muted-foreground border-b border-transparent hover:border-muted-foreground/50 hover:text-foreground pb-0.5 transition-all duration-300"
          >
            浏览标签
          </Link>
          <Link
            href="/archive"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-muted-foreground border-b border-transparent hover:border-muted-foreground/50 hover:text-foreground pb-0.5 transition-all duration-300"
          >
            查看归档
          </Link>
        </div>
      </main>
      <Footer siteName={siteName} socialLinks={settings?.social_links} />
    </>
  );
}

export const metadata = {
  title: "页面未找到",
};
