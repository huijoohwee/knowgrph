import React from 'react'
import { findLineRangeFromTarget } from '@/features/markdown/ui/markdownPreviewContextMenuUtils'
import type { MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'

type UseMarkdownPreviewEventsProps = {
  rootElRef: React.MutableRefObject<HTMLDivElement | null>
  handleShowOnCanvas: (startLine: number, endLine: number) => void
  setSelectionToolbar: (state: MarkdownSelectionToolbarState | null) => void
}

export function useMarkdownPreviewEvents({
  rootElRef,
  handleShowOnCanvas,
  setSelectionToolbar,
}: UseMarkdownPreviewEventsProps) {

  const handleDoubleClick = React.useCallback(
    () => {
      return
    },
    [],
  )

  const handleMouseUp = React.useCallback(
    () => {
      return
    },
    [],
  )

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rootElRef.current) return

      if (e.metaKey) {
        const range = findLineRangeFromTarget(rootElRef.current, e.target)
        if (!range) return
        e.preventDefault()
        e.stopPropagation()
        handleShowOnCanvas(range.startLine, range.endLine)
        return
      }
    },
    [handleShowOnCanvas, rootElRef],
  )

  const handleContextMenu = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rootEl = (e.currentTarget as HTMLDivElement) || rootElRef.current
    if (!rootEl) return
    
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    
    // If there is a selection, show the Selection Toolbar on context menu instead of the simple context menu
    const selectionText =
      sel && !sel.isCollapsed && sel.anchorNode && typeof sel.toString === 'function'
        ? sel.toString()
        : ''
    if (selectionText.trim().length > 0) {
      e.preventDefault()
      const rect = rootEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      let target = sel.anchorNode
      if (target && target.nodeType === Node.TEXT_NODE) {
          target = target.parentElement
      }
      const range = findLineRangeFromTarget(rootEl, target)
      
      if (range) {
        setSelectionToolbar({
          x,
          y,
          startLine: range.startLine,
          endLine: range.endLine,
          text: selectionText
        })
        return
      }
    }

    const range = findLineRangeFromTarget(rootEl, e.target)
    if (!range) return
    e.preventDefault()
    const rect = rootEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // For right-click without selection, we can also show the toolbar but with single line scope
    // But the toolbar is designed for "Show in..." actions which work for single line too.
    // Let's unify by showing the Selection Toolbar for right click too, effectively replacing the old ContextMenu
    
    setSelectionToolbar({
      x,
      y,
      startLine: range.startLine,
      endLine: range.endLine,
      text: '' // No text selected
    })
  }, [rootElRef, setSelectionToolbar])

  return { handleDoubleClick, handleMouseUp, handleClick, handleContextMenu }
}
