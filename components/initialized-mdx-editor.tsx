"use client";

import "@mdxeditor/editor/style.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type ForwardedRef,
  type MutableRefObject,
} from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  CodeToggle,
  ConditionalContents,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import { uploadImageFile } from "@/components/image-upload";
import type { ImageUploadConfig } from "@/lib/image-upload-config";

const FENCED_CODE_BLOCK_PATTERN =
  /(?:^|\r?\n)[ \t]{0,3}(`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*?\r?\n[ \t]{0,3}\1[ \t]*(?=\r?\n|$)/;

const CODE_BLOCK_LANGUAGES = {
  js: "JavaScript",
  jsx: "JavaScript React",
  ts: "TypeScript",
  tsx: "TypeScript React",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  bash: "Bash",
  sql: "SQL",
  markdown: "Markdown",
};

const CODE_BLOCK_LANGUAGE_ALIASES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  shell: "bash",
  sh: "bash",
  md: "markdown",
};

interface InitializedMDXEditorProps extends MDXEditorProps {
  editorRef: ForwardedRef<MDXEditorMethods> | null;
  imageUploadConfig: ImageUploadConfig;
}

function clipboardHasFiles(data: DataTransfer): boolean {
  return (
    data.files.length > 0 ||
    Array.from(data.items).some((item) => item.kind === "file")
  );
}

function normalizeCodeLanguage(language: string | null | undefined): string {
  const normalized = (language || "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "")
    .replace(/[^a-z0-9_+#.-]/g, "");

  return CODE_BLOCK_LANGUAGE_ALIASES[normalized] || normalized;
}

function getLanguageFromClassName(className: string | null): string {
  if (!className) return "";

  const languageClass = className
    .split(/\s+/)
    .find((classNamePart) => classNamePart.startsWith("language-"));

  return normalizeCodeLanguage(languageClass);
}

function getSingleHtmlCodeBlockLanguage(html: string): string | null {
  if (!html || typeof DOMParser === "undefined") return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const preBlocks = doc.body.querySelectorAll("pre");
  if (preBlocks.length !== 1) return null;

  const bodyWithoutPre = doc.body.cloneNode(true) as HTMLElement;
  bodyWithoutPre.querySelector("pre")?.remove();
  if (bodyWithoutPre.textContent?.trim()) return null;

  const pre = preBlocks[0];
  const code = pre.querySelector("code");
  return (
    normalizeCodeLanguage(code?.getAttribute("data-language")) ||
    normalizeCodeLanguage(pre.getAttribute("data-language")) ||
    getLanguageFromClassName(code?.getAttribute("class") || null) ||
    getLanguageFromClassName(pre.getAttribute("class")) ||
    ""
  );
}

function createFencedCodeBlock(code: string, language: string): string {
  const normalizedCode = code.replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
  const longestFenceLength = Math.max(
    2,
    ...Array.from(normalizedCode.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestFenceLength + 1));
  const info = language ? normalizeCodeLanguage(language) : "";

  return `${fence}${info}\n${normalizedCode}\n${fence}`;
}

function getMarkdownFromCodeBlockClipboard(data: DataTransfer): string | null {
  if (clipboardHasFiles(data)) return null;

  const plainText = data.getData("text/plain");
  if (!plainText.trim()) return null;

  if (FENCED_CODE_BLOCK_PATTERN.test(plainText)) {
    return plainText;
  }

  const html = data.getData("text/html");
  const language = getSingleHtmlCodeBlockLanguage(html);
  if (language === null) return null;

  return `\n\n${createFencedCodeBlock(plainText, language)}\n\n`;
}

function isCodeMirrorPasteTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".cm-editor"));
}

function setForwardedRef<T>(
  ref: ForwardedRef<T> | null,
  value: T | null,
): void {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  (ref as MutableRefObject<T | null>).current = value;
}

export default function InitializedMDXEditor({
  editorRef,
  imageUploadConfig,
  onChange,
  ...props
}: InitializedMDXEditorProps) {
  const mountedRef = useRef(false);
  const mdxEditorRef = useRef<MDXEditorMethods | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleChange = useCallback<NonNullable<MDXEditorProps["onChange"]>>(
    (markdown, initialMarkdownNormalize) => {
      if (!mountedRef.current || initialMarkdownNormalize) return;
      onChange?.(markdown, initialMarkdownNormalize);
    },
    [onChange],
  );

  const setEditorRef = useCallback(
    (instance: MDXEditorMethods | null) => {
      mdxEditorRef.current = instance;
      setForwardedRef(editorRef, instance);
    },
    [editorRef],
  );

  const handlePasteCapture = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (isCodeMirrorPasteTarget(event.target)) return;

      const markdown = getMarkdownFromCodeBlockClipboard(event.clipboardData);
      if (!markdown) return;

      const editor = mdxEditorRef.current;
      if (!editor) return;

      event.preventDefault();

      editor.focus(() => {
        editor.insertMarkdown(markdown);
        window.setTimeout(() => onChange?.(editor.getMarkdown(), false), 0);
      });
    },
    [onChange],
  );

  const plugins = useMemo(
    () => [
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin({
        validateUrl: (url) => {
          try {
            const parsed = new URL(url);
            return (
              parsed.protocol === "http:" ||
              parsed.protocol === "https:" ||
              parsed.protocol === "mailto:"
            );
          } catch {
            return false;
          }
        },
      }),
      linkDialogPlugin(),
      imagePlugin({
        imageUploadHandler: async (image) => {
          const uploaded = await uploadImageFile(image, imageUploadConfig);
          return uploaded.url;
        },
        allowSetImageDimensions: true,
      }),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "ts" }),
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
      }),
      diffSourcePlugin({ viewMode: "rich-text" }),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarClassName: "rich-editor-toolbar",
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={["rich-text", "source"]}>
            <ConditionalContents
              options={[
                {
                  when: (editor) => editor?.editorType === "codeblock",
                  contents: () => <ChangeCodeMirrorLanguage />,
                },
                {
                  fallback: () => (
                    <>
                      <UndoRedo />
                      <Separator />
                      <BlockTypeSelect />
                      <Separator />
                      <BoldItalicUnderlineToggles />
                      <CodeToggle />
                      <Separator />
                      <ListsToggle options={["bullet", "number", "check"]} />
                      <Separator />
                      <CreateLink />
                      <InsertImage />
                      <InsertTable />
                      <InsertThematicBreak />
                      <InsertCodeBlock />
                    </>
                  ),
                },
              ]}
            />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [imageUploadConfig],
  );

  return (
    <div onPasteCapture={handlePasteCapture}>
      <MDXEditor
        {...props}
        ref={setEditorRef}
        onChange={handleChange}
        plugins={plugins}
        contentEditableClassName="prose-editorial rich-editor-content"
        className="rich-editor-shell"
        toMarkdownOptions={{
          bullet: "-",
          emphasis: "_",
        }}
      />
    </div>
  );
}
