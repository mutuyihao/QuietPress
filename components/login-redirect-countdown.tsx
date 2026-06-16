"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LoginRedirectCountdownProps {
  seconds?: number;
}

export function LoginRedirectCountdown({
  seconds = 3,
}: LoginRedirectCountdownProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      router.replace("/admin");
    }, seconds * 1000);

    const countdownTimer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [router, seconds]);

  return (
    <div className="space-y-4 text-center">
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground shadow-xs"
      >
        登录成功，{remaining} 秒后进入管理后台。
      </div>
      <Button
        type="button"
        className="w-full"
        onClick={() => router.replace("/admin")}
      >
        立即进入后台
      </Button>
    </div>
  );
}
