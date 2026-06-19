"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock3,
  FileText,
  Loader2,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { readApiJson } from "@/lib/api-client";
import { postPath } from "@/lib/route-segments";

interface PostSearchItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
}

const SEARCH_HISTORY_KEY = "quietpress:search-history";
const MAX_HISTORY_ITEMS = 5;
const MAX_HISTORY_QUERY_LENGTH = 60;
const MAX_SEARCH_QUERY_LENGTH = 200;

function normalizeHistoryTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_HISTORY_QUERY_LENGTH);
}

function readSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) =>
        typeof item === "string" ? normalizeHistoryTerm(item) : "",
      )
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function writeSearchHistory(items: string[]): void {
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Search history is purely progressive enhancement.
  }
}

function rememberSearchQuery(value: string): string[] {
  const term = normalizeHistoryTerm(value);
  if (!term) return readSearchHistory();

  const next = [
    term,
    ...readSearchHistory().filter((item) => item !== term),
  ].slice(0, MAX_HISTORY_ITEMS);
  writeSearchHistory(next);
  return next;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const pieces: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerNeedle);
  let key = 0;

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      pieces.push(text.slice(cursor, matchIndex));
    }

    const end = matchIndex + needle.length;
    pieces.push(
      <mark
        key={`match-${key}`}
        className="rounded-sm bg-foreground/10 px-0.5 text-foreground"
      >
        {text.slice(matchIndex, end)}
      </mark>,
    );

    cursor = end;
    key += 1;
    matchIndex = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) {
    pieces.push(text.slice(cursor));
  }

  return <>{pieces}</>;
}

function DiscoveryLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
      <Link
        href="/tags"
        className="rounded-full border border-border/60 px-3 py-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        浏览标签
      </Link>
      <Link
        href="/archive"
        className="rounded-full border border-border/60 px-3 py-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        查看归档
      </Link>
    </div>
  );
}

export function Search() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<PostSearchItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const listboxId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || dialogRef.current?.contains(target))
        return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const doSearch = useCallback(async (q: string, signal: AbortSignal) => {
    const params = new URLSearchParams({ q });
    try {
      const res = await fetch(`/api/search?${params.toString()}`, { signal });
      const results = await readApiJson<PostSearchItem[]>(res);
      if (signal.aborted) return;

      setPosts(results);
      setSelectedIndex(0);
      setErrorMessage(null);
    } catch (err) {
      if (signal.aborted || isAbortError(err)) return;

      setPosts([]);
      setErrorMessage("搜索暂时不可用，请稍后重试。");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isOpen) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      queueMicrotask(() => {
        if (!cancelled) {
          setQuery("");
          setPosts([]);
          setSelectedIndex(0);
          setLoading(false);
          setErrorMessage(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    inputRef.current?.focus();
    queueMicrotask(() => {
      if (!cancelled) setSearchHistory(readSearchHistory());
    });

    const normalizedQuery = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!normalizedQuery) {
      queueMicrotask(() => {
        if (!cancelled) {
          setPosts([]);
          setSelectedIndex(0);
          setLoading(false);
          setErrorMessage(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    debounceRef.current = setTimeout(() => {
      void doSearch(normalizedQuery, controller.signal);
    }, 300);

    return () => {
      cancelled = true;
      controller.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, query, doSearch]);

  const filteredPosts = posts;
  const selectedOptionId =
    filteredPosts.length > 0
      ? `${listboxId}-option-${selectedIndex}`
      : undefined;

  const openPost = useCallback(
    (slug: string) => {
      setSearchHistory(rememberSearchQuery(query));
      router.push(postPath(slug));
      setIsOpen(false);
    },
    [query, router],
  );

  useEffect(() => {
    if (!isOpen || filteredPosts.length === 0) return;

    const handleNavigation = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredPosts.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredPosts.length) % filteredPosts.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedPost = filteredPosts[selectedIndex];
        if (selectedPost) {
          openPost(selectedPost.slug);
        }
      }
    };

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [isOpen, filteredPosts, selectedIndex, openPost]);

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    writeSearchHistory([]);
    setSearchHistory([]);
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full border border-border/50 hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground bg-transparent transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring gap-1"
        aria-label="打开搜索"
      >
        <SearchIcon className="h-[14px] w-[14px]" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/40 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="搜索文章"
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={dialogRef}
            className="bg-card border border-border/60 max-w-[540px] w-full rounded-xl shadow-2xl overflow-hidden flex flex-col scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <SearchIcon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                maxLength={MAX_SEARCH_QUERY_LENGTH}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="搜索文章标题或摘要..."
                aria-label="搜索关键词"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={filteredPosts.length > 0}
                aria-controls={listboxId}
                aria-activedescendant={selectedOptionId}
                className="w-full bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 text-[14px] font-sans"
              />
              {loading && (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
              )}
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/80">
                ESC
              </kbd>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground/60 hover:text-foreground p-0.5"
                aria-label="关闭搜索弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              id={listboxId}
              role={filteredPosts.length > 0 ? "listbox" : undefined}
              aria-live="polite"
              className="max-h-[360px] overflow-y-auto p-2 space-y-1"
            >
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground/60 font-sans">
                  正在搜索文章...
                </div>
              ) : errorMessage ? (
                <div className="space-y-4 py-10 text-center font-sans">
                  <p className="text-sm text-muted-foreground/70">
                    {errorMessage}
                  </p>
                  <DiscoveryLinks />
                </div>
              ) : filteredPosts.length > 0 ? (
                filteredPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    href={postPath(post.slug)}
                    onClick={() => {
                      setSearchHistory(rememberSearchQuery(query));
                      setIsOpen(false);
                    }}
                    className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-150 group/item ${
                      index === selectedIndex
                        ? "bg-muted/80 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60 group-hover/item:text-foreground" />
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[13.5px] font-sans font-medium text-foreground truncate">
                        <HighlightedText text={post.title} query={query} />
                      </div>
                      {post.excerpt && (
                        <div className="text-[12px] font-sans text-muted-foreground/60 line-clamp-1">
                          <HighlightedText text={post.excerpt} query={query} />
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : query.trim() ? (
                <div className="space-y-4 py-10 text-center font-sans">
                  <div>
                    <p className="text-sm text-muted-foreground/70">
                      没有找到匹配的文章。
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/45">
                      换个关键词，或从标签和归档继续浏览。
                    </p>
                  </div>
                  <DiscoveryLinks />
                </div>
              ) : (
                <div className="space-y-5 py-8 font-sans">
                  {searchHistory.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <p className="text-[12px] tracking-wide text-muted-foreground/60">
                          最近搜索
                        </p>
                        <button
                          type="button"
                          onClick={handleClearHistory}
                          className="text-[12px] text-muted-foreground/50 transition-colors hover:text-foreground"
                        >
                          清除
                        </button>
                      </div>
                      <div className="space-y-1">
                        {searchHistory.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => handleHistoryClick(term)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                          >
                            <Clock3 className="h-4 w-4 text-muted-foreground/50" />
                            <span className="truncate">{term}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 text-center">
                      <p className="text-sm text-muted-foreground/70">
                        输入关键词搜索文章标题和摘要。
                      </p>
                    </div>
                  )}
                  <DiscoveryLinks />
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-muted/30 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/45 select-none font-mono">
              <div className="flex items-center gap-3">
                {filteredPosts.length > 0 ? (
                  <>
                    <span>↑↓ 切换</span>
                    <span>Enter 选择</span>
                  </>
                ) : (
                  <span>输入关键词搜索</span>
                )}
              </div>
              <div>
                <span>Ctrl+K 唤出</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
