"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const COPY_RESET_DELAY_MS = 2000;

function getCodeLanguage(pre: Element, code: Element): string {
  const dataLanguage = pre.getAttribute("data-language");
  if (dataLanguage) return dataLanguage;

  const className = code.className || "";
  return className.match(/language-([\w-]+)/)?.[1] || "";
}

export function CodeBlockEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const preBlocks = document.querySelectorAll(".prose-editorial pre");

    preBlocks.forEach((pre) => {
      if (pre.querySelector(".code-actions-container")) return;

      pre.classList.add("relative", "group");

      const code = pre.querySelector("code");
      if (!code) return;

      const actionsDiv = document.createElement("div");
      actionsDiv.className =
        "code-actions-container absolute right-3 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto";

      const language = getCodeLanguage(pre, code);
      if (language) {
        const languageLabel = document.createElement("span");
        languageLabel.className =
          "text-[10px] font-mono tracking-wider text-muted-foreground/50 uppercase select-none";
        languageLabel.innerText = language;
        actionsDiv.appendChild(languageLabel);
      }

      const copyButton = document.createElement("button");
      copyButton.className =
        "code-copy-btn text-[10px] font-sans tracking-wide text-muted-foreground/75 hover:text-foreground border border-border/40 bg-background/80 hover:bg-background px-2 py-0.5 rounded transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
      copyButton.innerText = "复制";
      copyButton.type = "button";
      copyButton.setAttribute("aria-label", "复制代码");

      copyButton.addEventListener("click", async () => {
        try {
          if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API unavailable");
          }

          await navigator.clipboard.writeText(code.innerText.trim());
          copyButton.innerText = "已复制";
          copyButton.classList.add(
            "text-green-600",
            "dark:text-green-400",
            "border-green-600/30",
          );
        } catch {
          copyButton.innerText = "复制失败";
          copyButton.classList.add("text-destructive", "border-destructive/30");
        } finally {
          window.setTimeout(() => {
            copyButton.innerText = "复制";
            copyButton.classList.remove(
              "text-green-600",
              "dark:text-green-400",
              "border-green-600/30",
              "text-destructive",
              "border-destructive/30",
            );
          }, COPY_RESET_DELAY_MS);
        }
      });

      actionsDiv.appendChild(copyButton);
      pre.appendChild(actionsDiv);
    });
  }, [pathname]);

  return null;
}
