"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import type { ToasterProps } from "sonner";

const Sonner = dynamic<ToasterProps>(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false },
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
