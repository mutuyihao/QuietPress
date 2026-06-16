"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App render error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center animate-fade-in">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
        Application Error
      </span>
      <h1 className="mt-4 font-serif text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-[2rem]">
        页面暂时无法加载
      </h1>
      <p className="mt-4 max-w-[380px] text-sm leading-relaxed text-muted-foreground/80">
        这通常是临时数据或网络异常导致的。你可以重试，或返回首页继续浏览。
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground/60">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 border-b border-foreground/30 pb-0.5 text-[13px] tracking-wide text-foreground transition-all duration-300 hover:border-foreground"
        >
          重试
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1 border-b border-transparent pb-0.5 text-[13px] tracking-wide text-muted-foreground transition-all duration-300 hover:border-muted-foreground/50 hover:text-foreground"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
