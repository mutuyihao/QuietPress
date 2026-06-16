"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ForwardedRef,
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

interface InitializedMDXEditorProps extends MDXEditorProps {
  editorRef: ForwardedRef<MDXEditorMethods> | null;
  imageUploadConfig: ImageUploadConfig;
}

export default function InitializedMDXEditor({
  editorRef,
  imageUploadConfig,
  onChange,
  ...props
}: InitializedMDXEditorProps) {
  const mountedRef = useRef(false);

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
        codeBlockLanguages: {
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
        },
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
    <MDXEditor
      {...props}
      ref={editorRef}
      onChange={handleChange}
      plugins={plugins}
      contentEditableClassName="prose-editorial rich-editor-content"
      className="rich-editor-shell"
      toMarkdownOptions={{
        bullet: "-",
        emphasis: "_",
      }}
    />
  );
}
