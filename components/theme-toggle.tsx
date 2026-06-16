"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

function useHydrated() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-full border border-border/30 bg-transparent flex items-center justify-center text-muted-foreground/30">
        <Sun className="h-[14px] w-[14px] opacity-40" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-8 h-8 rounded-full border border-border/50 hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun className="h-[14px] w-[14px] transition-all duration-300" />
      ) : (
        <Moon className="h-[14px] w-[14px] transition-all duration-300" />
      )}
    </button>
  );
}
