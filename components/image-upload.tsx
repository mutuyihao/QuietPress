"use client";

/* eslint-disable @next/next/no-img-element -- Upload previews use local object URLs that next/image cannot optimize. */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import {
  DEFAULT_IMAGE_UPLOAD_CONFIG,
  getImageUploadMaxSizeBytes,
  type ImageUploadConfig,
} from "@/lib/image-upload-config";
import { readApiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface UploadedImage {
  url: string;
  path: string;
  contentType: string;
  originalSize: number;
  uploadedSize: number;
  compressed: boolean;
  maxSizeBytes: number;
}

interface ImageUploadProps {
  onUploaded: (url: string, image?: UploadedImage) => void;
  className?: string;
  config?: ImageUploadConfig;
  compact?: boolean;
}

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function getCompressedFileName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, "") || "image"}.webp`;
}

async function loadImage(
  file: File,
): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败"));
    };
    image.src = objectUrl;
  });
}

async function compressImageIfNeeded(
  file: File,
  config: ImageUploadConfig,
): Promise<{ file: File; compressed: boolean }> {
  if (!config.compressionEnabled || !COMPRESSIBLE_IMAGE_TYPES.has(file.type)) {
    return { file, compressed: false };
  }

  const { image, objectUrl } = await loadImage(file);

  try {
    const scale = Math.min(
      1,
      config.maxWidth / image.naturalWidth,
      config.maxHeight / image.naturalHeight,
    );
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return { file, compressed: false };

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", config.compressionQuality / 100);
    });

    if (!blob) return { file, compressed: false };
    if (scale === 1 && blob.size >= file.size)
      return { file, compressed: false };

    return {
      file: new File([blob], getCompressedFileName(file.name), {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      compressed: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadImageFile(
  file: File,
  config: ImageUploadConfig = DEFAULT_IMAGE_UPLOAD_CONFIG,
): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }

  const maxSizeBytes = getImageUploadMaxSizeBytes(config);
  const processed = await compressImageIfNeeded(file, config);

  if (processed.file.size > maxSizeBytes) {
    throw new Error(
      `图片超过大小限制：${formatBytes(processed.file.size)} / ${formatBytes(maxSizeBytes)}`,
    );
  }

  const formData = new FormData();
  formData.append("file", processed.file);
  formData.append("originalSize", String(file.size));
  formData.append("compressed", String(processed.compressed));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  });
  const data = await readApiJson<UploadedImage>(res);

  return data;
}

export function ImageUpload({
  onUploaded,
  className,
  config = DEFAULT_IMAGE_UPLOAD_CONFIG,
  compact = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadedImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    setLastUpload(null);

    try {
      const uploaded = await uploadImageFile(file, config);
      setLastUpload(uploaded);
      onUploaded(uploaded.url, uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  return (
    <div className={cn("relative space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="max-h-32 rounded border border-border/50"
          />
          {uploading && (
            <div className="absolute inset-0 bg-background/60 rounded flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex items-center gap-2 border transition-all duration-200 cursor-pointer",
            compact
              ? "h-8 rounded-md px-3 text-xs"
              : "rounded-lg border-2 border-dashed px-4 py-3 text-sm",
            dragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {compact ? "上传图片" : "拖拽图片或点击上传"}
            </>
          )}
        </button>
      )}

      {lastUpload && !compact && (
        <p className="text-xs text-muted-foreground">
          已上传 {formatBytes(lastUpload.uploadedSize)}
          {lastUpload.compressed
            ? `，已从 ${formatBytes(lastUpload.originalSize)} 自动压缩`
            : ""}
        </p>
      )}

      {error && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs text-destructive",
            compact &&
              "absolute left-0 top-full z-10 mt-2 w-64 rounded-md border border-destructive/30 bg-background px-2 py-1.5 shadow-sm",
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

export function ImageUploadInline({
  onInsert,
  config = DEFAULT_IMAGE_UPLOAD_CONFIG,
}: {
  onInsert: (markdown: string, image?: UploadedImage) => void;
  config?: ImageUploadConfig;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImageFile(file, config);
      const alt = file.name.replace(/\.[^.]+$/, "");
      onInsert(`\n![${alt}](${uploaded.url})\n`, uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md transition-all duration-200 cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        )}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? "上传中..." : "拖拽/粘贴图片"}
      </button>
      {error && (
        <p className="absolute left-0 top-full mt-1 w-64 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
