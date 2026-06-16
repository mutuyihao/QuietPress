"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin render error:", error);
  }, [error]);

  return (
    <div className="admin-page flex min-h-[60vh] items-center justify-center">
      <section className="admin-panel max-w-lg p-8 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
          Admin Error
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          后台页面加载失败
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          数据加载或渲染过程中发生异常。请重试，或返回后台首页继续处理其他内容。
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted-foreground/60">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            重试
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            返回后台首页
          </Link>
        </div>
      </section>
    </div>
  );
}
