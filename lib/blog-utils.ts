import { Marked, type Token, type Tokens, type TokensList } from "marked";
import sanitizeHtml from "sanitize-html";
import { codeToHtml } from "shiki";
import { formatDateTime } from "@/lib/date-format";

export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
}

export interface MarkdownRenderResult {
  html: string;
  headings: MarkdownHeading[];
}

const mdCache = new Map<
  string,
  { result: MarkdownRenderResult; expiresAt: number }
>();
const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CODE_LANGUAGE = "text";
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const CJK_REGEX =
  /[\u4e00-\u9fa5]|[\u3040-\u309f]|[\u30a0-\u30ff]|[\uac00-\ud7af]/g;

type HighlightedCodeToken = Tokens.Code & {
  highlightedHtml?: string;
};

export function slugify(text: string): string {
  const slug = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

export function createPostSlug(title: string): string {
  return slugify(title);
}

export function calculateReadingTime(markdown: string): number {
  const cleanText = markdown.replace(/[#*`\[\]()]/g, "");

  const cjkMatches = cleanText.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  const westernText = cleanText.replace(CJK_REGEX, " ");
  const westernWords = westernText
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const westernCount = westernWords.length;

  const readingTime = cjkCount / 350 + westernCount / 200;

  return Math.max(1, Math.ceil(readingTime));
}

function cloneMarkdownResult(
  result: MarkdownRenderResult,
): MarkdownRenderResult {
  return {
    html: result.html,
    headings: result.headings,
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&(amp|lt|gt|quot|#39);/g,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
        })[entity] || entity,
    );
}

function getHeadingText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextForComparison(text: string): string {
  return decodeHtmlEntities(
    text
      .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, "$1")
      .replace(/<[^>]*>/g, ""),
  )
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarkdownHeadingTextForComparison(text: string): string {
  return normalizeTextForComparison(
    text
      .replace(/[ \t]+#+[ \t]*$/, "")
      .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/(`+)(.*?)\1/g, "$2")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/~~(.*?)~~/g, "$1"),
  );
}

export function removeDuplicateLeadingTitleHeading(
  markdown: string,
  title: string,
): string {
  const normalizedTitle = normalizeTextForComparison(title);
  if (!normalizedTitle) return markdown;

  let lineStart = markdown.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (lineStart < markdown.length) {
    let lineEnd = lineStart;
    while (
      lineEnd < markdown.length &&
      markdown[lineEnd] !== "\n" &&
      markdown[lineEnd] !== "\r"
    ) {
      lineEnd += 1;
    }

    const line = markdown.slice(lineStart, lineEnd);
    let nextLineStart = lineEnd;
    if (markdown[nextLineStart] === "\r") nextLineStart += 1;
    if (markdown[nextLineStart] === "\n") nextLineStart += 1;

    if (!line.trim()) {
      lineStart = nextLineStart;
      continue;
    }

    const headingMatch = line.match(/^[ \t]{0,3}#(?:[ \t]+|$)(.*)$/);
    if (!headingMatch) return markdown;

    const normalizedHeading = normalizeMarkdownHeadingTextForComparison(
      headingMatch[1] || "",
    );

    if (normalizedHeading !== normalizedTitle) return markdown;

    return markdown.slice(0, lineStart) + markdown.slice(nextLineStart);
  }

  return markdown;
}

function getUniqueHeadingId(
  text: string,
  slugCounts: Map<string, number>,
): string {
  const baseId = slugify(text);
  const nextCount = (slugCounts.get(baseId) || 0) + 1;
  slugCounts.set(baseId, nextCount);

  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
}

function getCodeLanguage(lang: string | undefined): {
  displayLanguage: string;
  highlightLanguage: string;
} {
  const displayLanguage = lang?.trim().split(/\s+/)[0]?.toLowerCase() || "";

  return {
    displayLanguage,
    highlightLanguage: displayLanguage || DEFAULT_CODE_LANGUAGE,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function addCodeBlockMetadata(html: string, displayLanguage: string): string {
  if (!displayLanguage) return html;

  return html.replace(
    "<pre ",
    `<pre data-language="${escapeHtml(displayLanguage)}" `,
  );
}

function renderPlainCodeBlock(code: string, displayLanguage: string): string {
  const escapedLines = escapeHtml(code).split("\n");
  const lineHtml = escapedLines
    .map((line) => `<span class="line">${line}</span>`)
    .join("\n");
  const dataLanguage = displayLanguage
    ? ` data-language="${escapeHtml(displayLanguage)}"`
    : "";

  return `<pre class="shiki shiki-themes github-light github-dark"${dataLanguage} tabindex="0"><code>${lineHtml}</code></pre>`;
}

async function renderCodeBlock(
  code: string,
  lang: string | undefined,
): Promise<string> {
  const { displayLanguage, highlightLanguage } = getCodeLanguage(lang);

  try {
    const highlighted = await codeToHtml(code, {
      lang: highlightLanguage,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    });

    return addCodeBlockMetadata(highlighted, displayLanguage);
  } catch {
    if (highlightLanguage === DEFAULT_CODE_LANGUAGE) {
      return renderPlainCodeBlock(code, displayLanguage);
    }

    try {
      const highlighted = await codeToHtml(code, {
        lang: DEFAULT_CODE_LANGUAGE,
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      });

      return addCodeBlockMetadata(highlighted, displayLanguage);
    } catch {
      return renderPlainCodeBlock(code, displayLanguage);
    }
  }
}

function createMarkdownRenderer(
  headings: MarkdownHeading[],
  slugCounts: Map<string, number>,
): Marked {
  return new Marked({
    gfm: true,
    breaks: true,
    renderer: {
      code(token: Tokens.Code) {
        const highlightedToken = token as HighlightedCodeToken;
        return (
          highlightedToken.highlightedHtml ||
          renderPlainCodeBlock(
            token.text,
            getCodeLanguage(token.lang).displayLanguage,
          )
        );
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const html = this.parser.parseInline(tokens);
        const text = getHeadingText(html);
        const id = getUniqueHeadingId(text, slugCounts);

        if (text && depth >= 1 && depth <= 4) {
          headings.push({ id, text, level: depth });
        }

        return `<h${depth} id="${id}">${html}</h${depth}>`;
      },
    },
  });
}

async function highlightCodeTokens(
  tokens: Token[] | TokensList,
): Promise<void> {
  await Promise.all(
    tokens.map(async (token) => {
      if (token.type === "code") {
        const codeToken = token as HighlightedCodeToken;
        codeToken.highlightedHtml = await renderCodeBlock(
          codeToken.text,
          codeToken.lang,
        );
        return;
      }

      const tokenWithChildren = token as Tokens.Generic;
      if (Array.isArray(tokenWithChildren.tokens)) {
        await highlightCodeTokens(tokenWithChildren.tokens);
      }

      if (token.type === "list") {
        const listToken = token as Tokens.List;
        await Promise.all(
          listToken.items.map((item: Tokens.ListItem) =>
            highlightCodeTokens(item.tokens),
          ),
        );
      }
    }),
  );
}

function sanitizeMarkdownHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "span"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      code: ["class"],
      pre: ["class", "style", "tabindex", "data-language"],
      span: ["class", "style"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
    allowedStyles: {
      pre: {
        "background-color": [HEX_COLOR_PATTERN],
        color: [HEX_COLOR_PATTERN],
        "--shiki-dark-bg": [HEX_COLOR_PATTERN],
        "--shiki-dark": [HEX_COLOR_PATTERN],
      },
      span: {
        color: [HEX_COLOR_PATTERN],
        "--shiki-dark": [HEX_COLOR_PATTERN],
      },
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
}

export async function renderMarkdown(
  markdown: string,
): Promise<MarkdownRenderResult> {
  const cached = mdCache.get(markdown);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneMarkdownResult(cached.result);
  }
  if (cached) mdCache.delete(markdown);

  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  const markedInstance = createMarkdownRenderer(headings, slugCounts);
  const tokens = markedInstance.lexer(markdown);
  await highlightCodeTokens(tokens);
  const html = markedInstance.parser(tokens);
  const result = {
    html: sanitizeMarkdownHtml(html),
    headings,
  };

  if (mdCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mdCache.keys().next().value;
    if (firstKey) mdCache.delete(firstKey);
  }
  mdCache.set(markdown, {
    result: cloneMarkdownResult(result),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return cloneMarkdownResult(result);
}

export async function markdownToHtml(markdown: string): Promise<string> {
  return (await renderMarkdown(markdown)).html;
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
