"use client";

/* eslint-disable @next/next/no-img-element -- Admin media previews may point at private/custom storage URLs. */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, ExternalLink } from "lucide-react";
import type { StoredFile } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_LOCALE } from "@/lib/date-format";
import { cn } from "@/lib/utils";

interface MediaImageViewerProps {
  file: StoredFile | null;
  files: StoredFile[];
  onFileChange: (file: StoredFile | null) => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "未知大小";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function formatDate(value: string | null): string {
  if (!value) return "未知时间";
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MediaImageViewer({
  file,
  files,
  onFileChange,
}: MediaImageViewerProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const currentIndex = useMemo(
    () => (file ? files.findIndex((item) => item.path === file.path) : -1),
    [file, files],
  );
  const activeFile = currentIndex >= 0 ? files[currentIndex] : file;
  const canBrowse = files.length > 1 && currentIndex >= 0;
  const isCopied = activeFile ? copiedPath === activeFile.path : false;

  const selectOffset = (offset: number) => {
    if (!canBrowse) return;

    const nextIndex = (currentIndex + offset + files.length) % files.length;
    onFileChange(files[nextIndex]);
  };

  const copyUrl = async () => {
    if (!activeFile) return;

    await navigator.clipboard.writeText(activeFile.url);
    setCopiedPath(activeFile.path);
    window.setTimeout(() => setCopiedPath(null), 1200);
  };

  useEffect(() => {
    if (!activeFile || !canBrowse) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const offset = event.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = (currentIndex + offset + files.length) % files.length;
      onFileChange(files[nextIndex]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, canBrowse, currentIndex, files, onFileChange]);

  if (!activeFile) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onFileChange(null)}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-[min(96vw,1120px)]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="truncate text-base">
            {activeFile.name}
          </DialogTitle>
          <DialogDescription className="truncate">
            {activeFile.path}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(92vh-5rem)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative flex min-h-[46vh] items-center justify-center overflow-hidden bg-muted/70 p-3 lg:min-h-[70vh]">
            {canBrowse && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => selectOffset(-1)}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background"
                aria-label="上一张"
                title="上一张"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            <img
              src={activeFile.url}
              alt={activeFile.name}
              className="max-h-[64vh] max-w-full rounded-md object-contain shadow-sm lg:max-h-[72vh]"
            />

            {canBrowse && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => selectOffset(1)}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-md hover:bg-background"
                aria-label="下一张"
                title="下一张"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>

          <aside className="space-y-4 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                当前位置
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {currentIndex >= 0
                  ? `${currentIndex + 1} / ${files.length}`
                  : "预览"}
              </p>
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">大小</dt>
                <dd className="mt-1 text-foreground">
                  {formatBytes(activeFile.size)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">类型</dt>
                <dd className="mt-1 text-foreground">
                  {activeFile.contentType ?? "未知类型"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">更新时间</dt>
                <dd className="mt-1 text-foreground">
                  {formatDate(activeFile.lastModified)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyUrl}
                className={cn(isCopied && "border-primary text-primary")}
              >
                <Copy className="h-4 w-4" />
                {isCopied ? "已复制链接" : "复制链接"}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={activeFile.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打开原图
                </a>
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
