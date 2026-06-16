import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { formatDateTime } from "@/lib/date-format";

const mdCache = new Map<string, { html: string; expiresAt: number }>();
const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;

export function slugify(text: string): string {
  const slug = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

export function createPostSlug(title: string): string {
  return title.normalize("NFKC").trim() || "untitled";
}

export function calculateReadingTime(markdown: string): number {
  const cleanText = markdown.replace(/[#*`\[\]()]/g, "");

  const cjkRegex =
    /[\u4e00-\u9fa5]|[\u3040-\u309f]|[\u30a0-\u30ff]|[\uac00-\ud7af]/g;
  const cjkMatches = cleanText.match(cjkRegex);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  const westernText = cleanText.replace(cjkRegex, " ");
  const westernWords = westernText
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const westernCount = westernWords.length;

  const readingTime = cjkCount / 350 + westernCount / 200;

  return Math.max(1, Math.ceil(readingTime));
}

const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const id = slugify(html.replace(/<[^>]*>/g, ""));
      return `<h${depth} id="${id}">${html}</h${depth}>`;
    },
  },
});

export async function markdownToHtml(markdown: string): Promise<string> {
  const cached = mdCache.get(markdown);
  if (cached && cached.expiresAt > Date.now()) return cached.html;
  if (cached) mdCache.delete(markdown);

  const html = await markedInstance.parse(markdown);

  const result = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      code: ["class"],
      pre: ["class"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const nextAttribs: Record<string, string> = {
          ...attribs,
          rel: "noopener noreferrer",
        };
        if (nextAttribs.target !== "_blank") {
          delete nextAttribs.target;
        }
        return { tagName, attribs: nextAttribs };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: attribs.loading || "lazy" },
      }),
    },
  });

  if (mdCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mdCache.keys().next().value;
    if (firstKey) mdCache.delete(firstKey);
  }
  mdCache.set(markdown, { html: result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}

export function formatDate(date: string | Date): string {
  return formatDateTime(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateISO(date: string | Date): string {
  return new Date(date).toISOString();
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + "...";
}
