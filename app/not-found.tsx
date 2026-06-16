import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
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
          此页面已在虚无中归档
        </h1>
        <p className="mt-4 text-sm text-muted-foreground/80 max-w-[360px] leading-relaxed">
          您所寻找的文字或许已随风消逝，或者被移到了别处。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-foreground border-b border-foreground/30 hover:border-foreground pb-0.5 transition-all duration-300"
          >
            返回首页搜索 &rarr;
          </Link>
          <Link
            href="/tags"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-muted-foreground border-b border-transparent hover:border-muted-foreground/50 hover:text-foreground pb-0.5 transition-all duration-300"
          >
            浏览标签
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-[13px] tracking-wide text-muted-foreground border-b border-transparent hover:border-muted-foreground/50 hover:text-foreground pb-0.5 transition-all duration-300"
          >
            查看关于
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
