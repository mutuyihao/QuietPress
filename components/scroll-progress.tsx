'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'

export function ScrollProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const show = useMemo(() => pathname.includes('/posts/'), [pathname])

  useEffect(() => {
    setProgress(0)

    const handleScroll = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY

      if (documentHeight > windowHeight) {
        const totalScroll = documentHeight - windowHeight
        setProgress((scrollTop / totalScroll) * 100)
      } else {
        setProgress(0)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname])

  if (!show) return null

  return (
    <div
      className="absolute bottom-0 left-0 h-[2px] bg-foreground transition-all duration-75 ease-out"
      style={{ width: `${progress}%` }}
    />
  )
}
