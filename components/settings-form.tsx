"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/lazy-toast";
import { updateSiteSettings } from "@/lib/actions";
import type { SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface SettingsFormProps {
  settings: SiteSettings | null;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [siteName, setSiteName] = useState(settings?.site_name || "");
  const [siteDescription, setSiteDescription] = useState(
    settings?.site_description || "",
  );
  const [baseUrl, setBaseUrl] = useState(settings?.base_url || "");
  const [authorName, setAuthorName] = useState(settings?.author_name || "");
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState(
    settings?.default_og_image_url || "",
  );
  const [commentsEnabled, setCommentsEnabled] = useState(
    settings?.comments_enabled ?? true,
  );
  const [imageUploadMaxSizeMb, setImageUploadMaxSizeMb] = useState(
    settings?.image_upload_max_size_mb ?? 10,
  );
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(
    settings?.image_compression_enabled ?? true,
  );
  const [imageCompressionQuality, setImageCompressionQuality] = useState(
    settings?.image_compression_quality ?? 82,
  );
  const [imageMaxWidth, setImageMaxWidth] = useState(
    settings?.image_max_width ?? 1920,
  );
  const [imageMaxHeight, setImageMaxHeight] = useState(
    settings?.image_max_height ?? 1920,
  );
  const [aboutContent, setAboutContent] = useState(
    settings?.about_content || "",
  );

  const socialLinks = settings?.social_links || {};
  const [twitter, setTwitter] = useState(socialLinks.twitter || "");
  const [github, setGithub] = useState(socialLinks.github || "");
  const [linkedin, setLinkedin] = useState(socialLinks.linkedin || "");
  const [instagram, setInstagram] = useState(socialLinks.instagram || "");

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    if (tab === "preview") {
      import("marked").then(({ marked }) => {
        import("sanitize-html").then(({ default: sanitizeHtml }) => {
          Promise.resolve(marked.parse(aboutContent)).then((rawHtml) => {
            const safeHtml = sanitizeHtml(rawHtml, {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
              allowedAttributes: {
                a: ["href", "name", "target", "rel"],
                img: ["src", "alt", "title", "width", "height", "loading"],
                code: ["class"],
                pre: ["class"],
              },
              allowedSchemes: ["http", "https", "mailto", "tel"],
              allowProtocolRelative: false,
            });
            setPreviewHtml(safeHtml);
          });
        });
      });
    }
  }, [tab, aboutContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("site_name", siteName);
    formData.append("site_description", siteDescription);
    formData.append("base_url", baseUrl);
    formData.append("author_name", authorName);
    formData.append("default_og_image_url", defaultOgImageUrl);
    formData.append("comments_enabled", String(commentsEnabled));
    formData.append("image_upload_max_size_mb", String(imageUploadMaxSizeMb));
    formData.append(
      "image_compression_enabled",
      String(imageCompressionEnabled),
    );
    formData.append(
      "image_compression_quality",
      String(imageCompressionQuality),
    );
    formData.append("image_max_width", String(imageMaxWidth));
    formData.append("image_max_height", String(imageMaxHeight));
    formData.append("about_content", aboutContent);
    formData.append("social_twitter", twitter);
    formData.append("social_github", github);
    formData.append("social_linkedin", linkedin);
    formData.append("social_instagram", instagram);

    startTransition(async () => {
      try {
        const result = await updateSiteSettings(formData);
        if (!result.success) {
          toast.error(result.error || "保存失败");
          return;
        }
        toast.success("设置已保存");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "保存失败");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="admin-panel space-y-4 p-5">
        <h2 className="admin-section-title">基本信息</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">站点名称</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="我的博客"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorName">作者名称</Label>
            <Input
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="张三"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="siteDescription">站点描述</Label>
          <Textarea
            id="siteDescription"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="A quiet space for thoughts and ideas."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">站点 URL</Label>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://myblog.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultOgImageUrl">默认 OG 图片 URL</Label>
          <Input
            id="defaultOgImageUrl"
            type="url"
            value={defaultOgImageUrl}
            onChange={(e) => setDefaultOgImageUrl(e.target.value)}
            placeholder="https://myblog.com/og-image.jpg"
          />
        </div>
      </section>

      <section className="admin-panel space-y-4 p-5">
        <h2 className="admin-section-title">互动设置</h2>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-4">
          <div className="space-y-1">
            <Label htmlFor="commentsEnabled" className="text-sm font-medium">
              开启评论区
            </Label>
            <p className="text-sm text-muted-foreground">
              关闭后，前台文章页不显示评论区，评论接口也会拒绝新的评论提交。
            </p>
          </div>
          <Switch
            id="commentsEnabled"
            checked={commentsEnabled}
            onCheckedChange={setCommentsEnabled}
            aria-label="开启评论区"
            disabled={isPending}
          />
        </div>
      </section>

      <section className="admin-panel space-y-4 p-5">
        <h2 className="admin-section-title">关于页面</h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <Label htmlFor="aboutContent" className="text-sm font-medium">
              关于页面内容 (Markdown)
            </Label>
            <div className="admin-tabs text-[11px] font-sans">
              <button
                type="button"
                onClick={() => setTab("edit")}
                className={`admin-tab px-2.5 py-0.5 ${
                  tab === "edit" ? "admin-tab-active font-medium" : ""
                }`}
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`admin-tab px-2.5 py-0.5 ${
                  tab === "preview" ? "admin-tab-active font-medium" : ""
                }`}
              >
                预览
              </button>
            </div>
          </div>

          {tab === "edit" ? (
            <Textarea
              id="aboutContent"
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              placeholder="介绍一下你自己..."
              rows={10}
              className="font-mono text-sm"
            />
          ) : (
            <div
              className="prose-editorial min-h-[220px] max-h-[400px] overflow-y-auto rounded-md border border-border bg-background p-6 text-left"
              dangerouslySetInnerHTML={{
                __html:
                  previewHtml ||
                  '<p class="text-muted-foreground/60 text-sm">暂无内容预览...</p>',
              }}
            />
          )}
        </div>
      </section>

      <section className="admin-panel space-y-4 p-5">
        <h2 className="admin-section-title">社交链接</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="twitter">Twitter</Label>
            <Input
              id="twitter"
              type="url"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="https://twitter.com/username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github">GitHub</Label>
            <Input
              id="github"
              type="url"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/username"
            />
          </div>
        </div>
      </section>

      <section className="admin-panel space-y-4 p-5">
        <div>
          <h2 className="admin-section-title">图片上传设置</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            控制编辑器图片上传和压缩参数。
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Label htmlFor="imageCompressionEnabled" className="font-medium">
                自动压缩图片
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                上传前转为 WebP。
              </p>
            </div>
            <Switch
              id="imageCompressionEnabled"
              checked={imageCompressionEnabled}
              onCheckedChange={setImageCompressionEnabled}
              aria-label="自动压缩图片"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="imageUploadMaxSizeMb">单张上限 (MB)</Label>
              <Input
                id="imageUploadMaxSizeMb"
                type="number"
                min={1}
                max={10}
                value={imageUploadMaxSizeMb}
                onChange={(e) =>
                  setImageUploadMaxSizeMb(Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">服务端校验上限。</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageMaxWidth">最大宽度 (px)</Label>
              <Input
                id="imageMaxWidth"
                type="number"
                min={640}
                max={4096}
                value={imageMaxWidth}
                onChange={(e) => setImageMaxWidth(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageMaxHeight">最大高度 (px)</Label>
              <Input
                id="imageMaxHeight"
                type="number"
                min={640}
                max={4096}
                value={imageMaxHeight}
                onChange={(e) => setImageMaxHeight(Number(e.target.value))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="imageCompressionQuality">压缩质量</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {imageCompressionQuality}%
                </span>
              </div>
              <Slider
                id="imageCompressionQuality"
                min={40}
                max={95}
                step={1}
                value={[imageCompressionQuality]}
                onValueChange={(value) =>
                  setImageCompressionQuality(value[0] ?? 82)
                }
                disabled={!imageCompressionEnabled || isPending}
              />
            </div>
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "保存中..." : "保存设置"}
      </Button>
    </form>
  );
}
