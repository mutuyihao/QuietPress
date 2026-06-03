'use client'

import { ImageIcon } from 'lucide-react'
import type { StoredFile } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MediaLibrary } from '@/components/media-library'

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (file: StoredFile) => void
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: MediaPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <ImageIcon className="h-3.5 w-3.5" />
          媒体库
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>从媒体库插入图片</DialogTitle>
          <DialogDescription>
            选择已上传图片，会插入到编辑器当前光标位置。也可以继续使用编辑器内的直接上传。
          </DialogDescription>
        </DialogHeader>
        <MediaLibrary mode="select" onSelect={onSelect} />
      </DialogContent>
    </Dialog>
  )
}
