'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

export function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href
    const title = document.title

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        })
      } catch (err) {
        // User cancelled or error occurred
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error sharing:', err)
        }
      }
    } else {
      // Desktop fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer focus:outline-none"
      aria-label="Share post"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400">已复制</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          <span>分享</span>
        </>
      )}
    </button>
  )
}
