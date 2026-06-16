import type { PostStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PublishPanelProps {
  status: PostStatus;
  isPending: boolean;
  hasPost: boolean;
  showDelete: boolean;
  onStatusChange: (status: PostStatus) => void;
  onCancel: () => void;
  onDelete: () => void;
  onShowDeleteChange: (showDelete: boolean) => void;
}

export function PublishPanel({
  status,
  isPending,
  hasPost,
  showDelete,
  onStatusChange,
  onCancel,
  onDelete,
  onShowDeleteChange,
}: PublishPanelProps) {
  return (
    <section className="admin-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">发布</h2>
        <span className="text-xs text-muted-foreground">
          {status === "published"
            ? "已发布"
            : status === "archived"
              ? "已归档"
              : "草稿"}
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">状态</Label>
        <select
          id="status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as PostStatus)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : hasPost ? "更新" : "创建"}
        </Button>
      </div>

      {hasPost &&
        (showDelete ? (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isPending}
              className="flex-1"
            >
              删除
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onShowDeleteChange(false)}
              className="flex-1"
            >
              保留
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onShowDeleteChange(true)}
            className="mt-3 w-full text-muted-foreground hover:text-destructive"
          >
            删除文章
          </Button>
        ))}
    </section>
  );
}
