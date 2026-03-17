import React from 'react'
import type { GraphState } from '@/hooks/store/types'
import { normalizeWebpageFrontmatterView } from '@/lib/markdown/frontmatter'

export function useMarkdownEditorSsotSync(args: {
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  activeText: string
  setActiveMarkdownDocument: GraphState['setActiveMarkdownDocument']
}): void {
  const lastPushedRef = React.useRef<{ key: string; text: string } | null>(null)
  const debounceRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    const key = String(args.activeDocumentKey || '').trim()
    const textRaw = String(args.activeText || '')
    if (!key) return
    if (!textRaw.trim()) return

    const normalized = normalizeWebpageFrontmatterView(textRaw, 'markdown')
    const prev = lastPushedRef.current
    if (prev && prev.key === key && prev.text === normalized) return

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      const currentKey = String(args.activeDocumentKey || '').trim()
      if (currentKey !== key) return
      try {
        void args.setActiveMarkdownDocument({
          name: key,
          text: normalized,
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: args.activeDocumentSourceUrl,
        })
        lastPushedRef.current = { key, text: normalized }
      } catch {
        void 0
      }
    }, 220)

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [args.activeDocumentKey, args.activeDocumentSourceUrl, args.activeText, args.setActiveMarkdownDocument])
}

