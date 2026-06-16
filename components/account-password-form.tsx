"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/lazy-toast";

import { updateAdminPassword } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.append("current_password", currentPassword);
    formData.append("new_password", newPassword);
    formData.append("confirm_password", confirmPassword);

    startTransition(async () => {
      const result = await updateAdminPassword(formData);

      if (!result.success) {
        toast.error(result.error || "密码更新失败");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("密码已更新");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-panel max-w-xl space-y-5 p-5"
    >
      <div className="space-y-1">
        <h2 className="admin-section-title">修改密码</h2>
        <p className="text-sm text-muted-foreground">
          首次登录后请修改一键部署创建的临时密码。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">新密码</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "更新中..." : "更新密码"}
      </Button>
    </form>
  );
}
