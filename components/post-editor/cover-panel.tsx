/* eslint-disable @next/next/no-img-element -- Cover previews can be temporary or custom storage URLs. */

import type { ImageUploadConfig } from "@/lib/image-upload-config";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import { Input } from "@/components/ui/input";

interface CoverPanelProps {
  coverImageUrl: string;
  uploadConfig: ImageUploadConfig;
  onCoverImageUrlChange: (url: string) => void;
}

export function CoverPanel({
  coverImageUrl,
  uploadConfig,
  onCoverImageUrlChange,
}: CoverPanelProps) {
  return (
    <section className="admin-panel p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">封面</h2>
      <div className="space-y-3">
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt="Cover preview"
            loading="lazy"
            decoding="async"
            className="aspect-video w-full rounded-md border border-border object-cover"
          />
        )}
        <Input
          id="cover"
          type="url"
          value={coverImageUrl}
          onChange={(event) => onCoverImageUrlChange(event.target.value)}
          placeholder="https://example.com/image.jpg"
          className="h-8 text-xs"
          aria-label="封面图片 URL"
        />
        <div className="flex items-center gap-2">
          <ImageUpload
            compact
            config={uploadConfig}
            onUploaded={onCoverImageUrlChange}
          />
          {coverImageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCoverImageUrlChange("")}
              className="text-muted-foreground"
            >
              清除
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
