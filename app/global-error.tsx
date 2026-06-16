"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global render error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20 text-center text-foreground">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
            Critical Error
          </span>
          <h1 className="mt-4 font-serif text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2rem]">
            应用启动失败
          </h1>
          <p className="mt-4 max-w-[380px] text-sm leading-relaxed text-muted-foreground/80">
            根布局加载时发生异常。请重试；如果问题持续，请使用页面上的 ref
            信息排查服务端日志。
          </p>
          {error.digest && (
            <p className="mt-4 font-mono text-xs text-muted-foreground/60">
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-10 inline-flex items-center gap-1 border-b border-foreground/30 pb-0.5 text-[13px] tracking-wide text-foreground transition-all duration-300 hover:border-foreground"
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
