"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/lazy-toast";
import { createTag, deleteTag, updateTag } from "@/lib/actions";
import type { Tag } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagManagerProps {
  tags: Tag[];
}

export function TagManager({ tags }: TagManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newTagName, setNewTagName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const startEditing = (tag: Tag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
    setDeleteConfirm(null);
  };

  const handleUpdate = async (tagId: string) => {
    if (!editingName.trim()) return;
    startTransition(async () => {
      try {
        const result = await updateTag(tagId, editingName.trim());
        if (!result.success) {
          toast.error(result.error || "更新失败");
          return;
        }
        setEditingId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "更新失败");
      }
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    startTransition(async () => {
      try {
        const result = await createTag(newTagName.trim());
        if (!result.success) {
          toast.error(result.error || "创建失败");
          return;
        }
        setNewTagName("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "创建失败");
      }
    });
  };

  const handleDelete = (tagId: string) => {
    startTransition(async () => {
      try {
        const result = await deleteTag(tagId);
        if (!result.success) {
          toast.error(result.error || "删除失败");
          return;
        }
        setDeleteConfirm(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="admin-panel flex gap-2 p-4">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="新标签名称"
          className="max-w-xs"
        />
        <Button type="submit" disabled={isPending || !newTagName.trim()}>
          {isPending ? "创建中..." : "创建标签"}
        </Button>
      </form>

      {tags.length === 0 ? (
        <div className="admin-empty">
          <p className="text-sm text-muted-foreground">暂无标签</p>
        </div>
      ) : (
        <div className="admin-panel overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/25">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  名称
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className="hover:bg-muted/25 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {editingId === tag.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="max-w-[180px] h-8 text-sm font-sans"
                        autoFocus
                      />
                    ) : (
                      `#${tag.name}`
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {editingId === tag.id ? (
                      <span className="text-xs text-muted-foreground/60 italic">
                        保存后重新生成
                      </span>
                    ) : (
                      tag.slug
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === tag.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(tag.id)}
                          disabled={
                            isPending ||
                            !editingName.trim() ||
                            editingName.trim() === tag.name
                          }
                        >
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          取消
                        </Button>
                      </div>
                    ) : deleteConfirm === tag.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-muted-foreground">
                          确定?
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(tag.id)}
                          disabled={isPending}
                        >
                          确定
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={isPending}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(tag)}
                          disabled={isPending}
                        >
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent"
                          onClick={() => setDeleteConfirm(tag.id)}
                          disabled={isPending}
                        >
                          删除
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
