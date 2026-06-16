"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/blog-utils";
import { readApiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, Clock, Loader2 } from "lucide-react";

interface Revision {
  id: string;
  post_id: string;
  title: string;
  content_markdown: string;
  excerpt: string | null;
  created_at: string;
  created_by: string | null;
}

interface RevisionViewerProps {
  postId: string;
  currentContent: string;
  currentTitle: string;
  currentExcerpt: string | null;
}

export function RevisionViewer({
  postId,
  currentContent,
  currentTitle,
  currentExcerpt,
}: RevisionViewerProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    fetch(`/api/admin/revisions?postId=${postId}`)
      .then((res) =>
        readApiJson<{ revisions: Revision[]; message?: string }>(res),
      )
      .then((data) => {
        if (cancelled) return;
        if (data.message) setError(data.message);
        else setRevisions(data.revisions || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, expanded]);

  const toggleExpanded = () => {
    if (expanded) {
      setSelected(null);
    }
    setExpanded((value) => !value);
  };

  return (
    <section className="admin-panel overflow-hidden">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" />
          修订历史
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {expanded ? "收起" : "查看"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-3">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  className="h-8 gap-1 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  返回
                </Button>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDate(selected.created_at)}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    标题
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selected.title}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    内容
                  </span>
                  <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {selected.content_markdown}
                  </pre>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : error ? (
            <p className="py-3 text-sm text-muted-foreground">{error}</p>
          ) : revisions.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">暂无修订记录。</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() =>
                  setSelected({
                    id: "current",
                    post_id: postId,
                    title: currentTitle,
                    content_markdown: currentContent,
                    excerpt: currentExcerpt,
                    created_at: new Date().toISOString(),
                    created_by: null,
                  })
                }
                className="w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    当前版本
                  </span>
                  <span className="text-xs text-muted-foreground">最新</span>
                </div>
              </button>

              {revisions.map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setSelected(rev)}
                  className="w-full border-t border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-muted-foreground">
                      {rev.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                      {formatDate(rev.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
