"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, List } from "lucide-react";
import type { MarkdownHeading } from "@/lib/blog-utils";
import { cn } from "@/lib/utils";

interface TOCProps {
  headings: MarkdownHeading[];
}

export function TOC({ headings }: TOCProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (headings.length < 2) return;

    const headingElements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-100px 0px -60% 0px",
        threshold: 0.1,
      },
    );

    headingElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  const topLevel = Math.min(...headings.map((item) => item.level));
  const currentActiveId = headings.some((heading) => heading.id === activeId)
    ? activeId
    : headings[0]?.id || "";

  const handleScrollTo = (event: React.MouseEvent, id: string) => {
    event.preventDefault();

    const element = document.getElementById(id);
    if (!element) return;

    const offset = 90;
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = element.getBoundingClientRect().top;
    const elementPosition = elementRect - bodyRect;

    window.scrollTo({
      top: elementPosition - offset,
      behavior: "smooth",
    });
    setActiveId(id);
  };

  return (
    <>
      <div className="xl:hidden block mb-10 border border-border/50 rounded-xl bg-card overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          aria-controls="mobile-table-of-contents"
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <List className="h-4.5 w-4.5 text-muted-foreground" />
            <span className="font-serif text-[15px] font-medium text-foreground">
              目录
            </span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <nav
            id="mobile-table-of-contents"
            aria-label="文章目录"
            className="border-t border-border/30 px-5 py-3.5 bg-muted/5 max-h-[300px] overflow-y-auto"
          >
            <ul className="space-y-2.5 text-[14px]">
              {headings.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - topLevel) * 16}px` }}
                >
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => handleScrollTo(event, item.id)}
                    className={cn(
                      "block py-0.5 hover:text-foreground transition-colors font-sans leading-relaxed",
                      currentActiveId === item.id
                        ? "text-foreground font-medium"
                        : "text-muted-foreground/75",
                    )}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <div className="hidden xl:block absolute left-[calc(100%+64px)] top-16 bottom-0 w-60 pointer-events-none">
        <aside className="sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto select-none pr-4 scrollbar-thin pointer-events-auto">
          <div className="flex items-center gap-2 mb-4">
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="font-serif text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
              目录
            </span>
          </div>
          <nav aria-label="文章目录">
            <ul className="space-y-3.5 text-[13.5px] border-l border-border/40 relative">
              {headings.map((item) => (
                <li
                  key={item.id}
                  className="relative"
                  style={{
                    paddingLeft: `${16 + (item.level - topLevel) * 12}px`,
                  }}
                >
                  {currentActiveId === item.id && (
                    <div className="absolute left-[-1px] top-0 bottom-0 w-[1.5px] bg-foreground transition-all duration-300" />
                  )}
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => handleScrollTo(event, item.id)}
                    className={cn(
                      "block hover:text-foreground transition-all duration-200 font-sans leading-relaxed",
                      currentActiveId === item.id
                        ? "text-foreground font-medium translate-x-[2px]"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </>
  );
}
