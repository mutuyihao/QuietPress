"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

interface LocalPostDraft {
  title?: unknown;
  content?: unknown;
  excerpt?: unknown;
  coverImageUrl?: unknown;
  selectedTags?: unknown;
}

interface UseLocalDraftOptions {
  enabled: boolean;
  draftKey: string;
  title: string;
  content: string;
  excerpt: string;
  coverImageUrl: string;
  selectedTags: string[];
  setTitle: Dispatch<SetStateAction<string>>;
  setContent: Dispatch<SetStateAction<string>>;
  setExcerpt: Dispatch<SetStateAction<string>>;
  setCoverImageUrl: Dispatch<SetStateAction<string>>;
  setSelectedTags: Dispatch<SetStateAction<string[]>>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

export function useLocalDraft({
  enabled,
  draftKey,
  title,
  content,
  excerpt,
  coverImageUrl,
  selectedTags,
  setTitle,
  setContent,
  setExcerpt,
  setCoverImageUrl,
  setSelectedTags,
}: UseLocalDraftOptions) {
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;

      const draft = JSON.parse(saved) as LocalPostDraft;
      queueMicrotask(() => {
        if (cancelled) return;

        const draftTitle = asString(draft.title);
        const draftContent = asString(draft.content);
        const draftExcerpt = asString(draft.excerpt);
        const draftCoverImageUrl = asString(draft.coverImageUrl);
        const draftSelectedTags = asStringArray(draft.selectedTags);

        if (draftTitle) setTitle(draftTitle);
        if (draftContent) setContent(draftContent);
        if (draftExcerpt) setExcerpt(draftExcerpt);
        if (draftCoverImageUrl) setCoverImageUrl(draftCoverImageUrl);
        if (draftSelectedTags) setSelectedTags(draftSelectedTags);
        setDraftRestored(true);
      });
    } catch {
      // Ignore malformed local drafts.
    }

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    draftKey,
    setTitle,
    setContent,
    setExcerpt,
    setCoverImageUrl,
    setSelectedTags,
  ]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      if (!title && !content) return;

      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            title,
            content,
            excerpt,
            coverImageUrl,
            selectedTags,
          }),
        );
      } catch {
        // Ignore storage quota and privacy-mode failures.
      }
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [enabled, draftKey, title, content, excerpt, coverImageUrl, selectedTags]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore storage errors.
    }

    setDraftRestored(false);
  }, [draftKey]);

  return { draftRestored, clearDraft };
}
