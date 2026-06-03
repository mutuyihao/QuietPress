'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    Prism?: {
      highlightAll: () => void
      plugins?: {
        autoloader?: {
          languages_path: string
        }
      }
    }
  }
}

export function CodeBlockEnhancer() {
  const pathname = usePathname()

  useEffect(() => {
    const highlightCode = () => {
      if (window.Prism) {
        window.Prism.highlightAll()
      }
    }

    const enhanceBlocks = () => {
      const preBlocks = document.querySelectorAll('.prose-editorial pre')

      preBlocks.forEach((pre) => {
        if (pre.querySelector('.code-actions-container')) return

        pre.classList.add('relative', 'group')

        const code = pre.querySelector('code')
        if (!code) return

        const actionsDiv = document.createElement('div')
        actionsDiv.className = 'code-actions-container absolute right-3 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto'

        const className = code.className || ''
        const langMatch = className.match(/language-(\w+)/)
        const lang = langMatch ? langMatch[1] : ''

        if (lang) {
          const langSpan = document.createElement('span')
          langSpan.className = 'text-[10px] font-mono tracking-wider text-muted-foreground/50 uppercase select-none'
          langSpan.innerText = lang
          actionsDiv.appendChild(langSpan)
        }

        const copyBtn = document.createElement('button')
        copyBtn.className = 'code-copy-btn text-[10px] font-sans tracking-wide text-muted-foreground/75 hover:text-foreground border border-border/40 bg-background/80 hover:bg-background px-2 py-0.5 rounded transition-all duration-200 cursor-pointer focus:outline-none'
        copyBtn.innerText = '复制'
        copyBtn.type = 'button'

        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code.innerText.trim())
            copyBtn.innerText = '已复制'
            copyBtn.classList.add('text-green-600', 'dark:text-green-400', 'border-green-600/30')
            setTimeout(() => {
              copyBtn.innerText = '复制'
              copyBtn.classList.remove('text-green-600', 'dark:text-green-400', 'border-green-600/30')
            }, 2000)
          } catch (err) {
            console.error('Failed to copy text: ', err)
          }
        })

        actionsDiv.appendChild(copyBtn)
        pre.appendChild(actionsDiv)
      })
    }

    const loadPrism = () => {
      if (window.Prism) {
        highlightCode()
        enhanceBlocks()
        return
      }

      if (document.getElementById('prism-core-js')) {
        const interval = setInterval(() => {
          if (window.Prism) {
            clearInterval(interval)
            highlightCode()
            enhanceBlocks()
          }
        }, 100)
        return
      }

      const script = document.createElement('script')
      script.id = 'prism-core-js'
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js'
      script.setAttribute('data-manual', 'true')

      script.onload = () => {
        const autoloader = document.createElement('script')
        autoloader.id = 'prism-autoloader'
        autoloader.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js'
        autoloader.onload = () => {
          if (window.Prism?.plugins?.autoloader) {
            window.Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/'
          }
          highlightCode()
          enhanceBlocks()
        }
        document.head.appendChild(autoloader)
      }
      document.head.appendChild(script)
    }

    loadPrism()
  }, [pathname])

  return null
}
