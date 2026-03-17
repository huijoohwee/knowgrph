import React from 'react'
import type { MarkdownLayoutMode } from '../BottomPanelMarkdownSection'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { scrollToLineInViewer } from '../markdownScrollUtils'

type UseMarkdownScrollEffectProps = {
  pendingScrollLine: number | null
  setPendingScrollLine: (line: number | null) => void
  markdownLayoutMode: MarkdownLayoutMode
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  viewerRef: React.RefObject<HTMLDivElement>
}

export function useMarkdownScrollEffect(props: UseMarkdownScrollEffectProps) {
  const {
    pendingScrollLine,
    setPendingScrollLine,
    markdownLayoutMode,
    editorTextAreaRef,
    viewerRef,
  } = props

  React.useEffect(() => {
    if (pendingScrollLine === null) return

    if (markdownLayoutMode === 'editor') {
      const handle = editorTextAreaRef.current
      if (!handle) return

      const run = () => {
        // Use handle method directly
        const top = handle.getTopForLineNumber(pendingScrollLine)
        handle.setScrollTop(top)
        setPendingScrollLine(null)
      }

      let raf1: number | null = null
      let raf2: number | null = null
      try {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => run())
          })
        } else {
          const timer = setTimeout(() => run(), 0)
          return () => clearTimeout(timer)
        }
      } catch {
        run()
      }
      return () => {
        if (raf1 != null) {
          try {
            window.cancelAnimationFrame(raf1)
          } catch {
            void 0
          }
        }
        if (raf2 != null) {
          try {
            window.cancelAnimationFrame(raf2)
          } catch {
            void 0
          }
        }
      }
    } else {
      const run = () => {
        scrollToLineInViewer(viewerRef.current, pendingScrollLine)
        setPendingScrollLine(null)
      }

      let raf1: number | null = null
      let raf2: number | null = null
      try {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => run())
          })
        } else {
          const timer = setTimeout(() => run(), 0)
          return () => clearTimeout(timer)
        }
      } catch {
        run()
      }
      return () => {
        if (raf1 != null) {
          try {
            window.cancelAnimationFrame(raf1)
          } catch {
            void 0
          }
        }
        if (raf2 != null) {
          try {
            window.cancelAnimationFrame(raf2)
          } catch {
            void 0
          }
        }
      }
    }
  }, [pendingScrollLine, markdownLayoutMode, editorTextAreaRef, viewerRef, setPendingScrollLine])
}
