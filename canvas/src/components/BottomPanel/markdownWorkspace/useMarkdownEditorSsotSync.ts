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
  const lastSeenRef = React.useRef<{ key: string; textRaw: string } | null>(null)
  const debounceRef = React.useRef<number | null>(null)
  const idleRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (idleRef.current != null) {
      try {
        ;(window as any).cancelIdleCallback?.(idleRef.current)
      } catch {
        void 0
      }
      idleRef.current = null
    }

    const key = String(args.activeDocumentKey || '').trim()
    const textRaw = String(args.activeText || '')
    if (!key) return

    const lastSeen = lastSeenRef.current
    if (lastSeen && lastSeen.key === key && lastSeen.textRaw === textRaw) return
    lastSeenRef.current = { key, textRaw }

    const commit = () => {
      const currentKey = String(args.activeDocumentKey || '').trim()
      if (currentKey !== key) return
      const rawNow = String(args.activeText || '')
      if (!rawNow.trim()) return

      const normalized = normalizeWebpageFrontmatterView(rawNow, 'markdown')
      const prev = lastPushedRef.current
      if (prev && prev.key === key && prev.text === normalized) return
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
    }

    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout?: number }) => number)
    if (typeof ric === 'function') {
      idleRef.current = ric(() => {
        idleRef.current = null
        commit()
      }, { timeout: 1200 })
    } else {
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        commit()
      }, 800)
    }

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      if (idleRef.current != null) {
        try {
          ;(window as any).cancelIdleCallback?.(idleRef.current)
        } catch {
          void 0
        }
        idleRef.current = null
      }
    }
  }, [args.activeDocumentKey, args.activeDocumentSourceUrl, args.activeText, args.setActiveMarkdownDocument])
}
