import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SeoPanelProps {
  showSeo: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  onShowSeoChange: (showSeo: boolean) => void;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onCanonicalUrlChange: (value: string) => void;
  onNoindexChange: (value: boolean) => void;
}

export function SeoPanel({
  showSeo,
  seoTitle,
  seoDescription,
  canonicalUrl,
  noindex,
  onShowSeoChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onCanonicalUrlChange,
  onNoindexChange,
}: SeoPanelProps) {
  return (
    <section className="admin-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">SEO</h2>
        <button
          type="button"
          onClick={() => onShowSeoChange(!showSeo)}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          aria-expanded={showSeo}
        >
          {showSeo ? "收起" : "展开"}
        </button>
      </div>

      {showSeo && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seoTitle">SEO 标题</Label>
            <Input
              id="seoTitle"
              value={seoTitle}
              onChange={(event) => onSeoTitleChange(event.target.value)}
              placeholder="自定义 SEO 标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seoDescription">SEO 描述</Label>
            <Textarea
              id="seoDescription"
              value={seoDescription}
              onChange={(event) => onSeoDescriptionChange(event.target.value)}
              placeholder="自定义 SEO 描述"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="canonicalUrl">Canonical URL</Label>
            <Input
              id="canonicalUrl"
              type="url"
              value={canonicalUrl}
              onChange={(event) => onCanonicalUrlChange(event.target.value)}
              placeholder="https://example.com/original-post"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              id="noindex"
              checked={noindex}
              onChange={(event) => onNoindexChange(event.target.checked)}
              className="rounded border-input"
            />
            禁止搜索引擎索引
          </label>
        </div>
      )}
    </section>
  );
}
