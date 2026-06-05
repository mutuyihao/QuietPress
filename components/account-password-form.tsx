'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { updateAdminPassword } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountPasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData()
    formData.append('current_password', currentPassword)
    formData.append('new_password', newPassword)
    formData.append('confirm_password', confirmPassword)

    startTransition(async () => {
      const result = await updateAdminPassword(formData)

      if (!result.success) {
        toast.error(result.error || 'Failed to update password')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="admin-panel max-w-xl space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="admin-section-title">Password</h2>
        <p className="text-sm text-muted-foreground">
          Change the temporary deployment password after the first login.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
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
        <Label htmlFor="newPassword">New password</Label>
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
        <Label htmlFor="confirmPassword">Confirm new password</Label>
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
        {isPending ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}
