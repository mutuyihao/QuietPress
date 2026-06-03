'use client'

import { useEffect, useRef } from 'react'

interface ViewCounterProps {
  postId: string
}

export function ViewCounter({ postId }: ViewCounterProps) {
  const countedRef = useRef(false)

  useEffect(() => {
    if (countedRef.current) return

    const storageKey = `post_view_${postId}`
    const viewedAt = sessionStorage.getItem(storageKey)

    // Dedup within same session (same tab/window), 30-min cooldown
    if (viewedAt) {
      const elapsed = Date.now() - parseInt(viewedAt, 10)
      if (elapsed < 30 * 60 * 1000) return
    }

    countedRef.current = true
    sessionStorage.setItem(storageKey, String(Date.now()))

    fetch('/api/view-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    }).catch(() => { /* non-critical */ })
  }, [postId])

  return null
}
