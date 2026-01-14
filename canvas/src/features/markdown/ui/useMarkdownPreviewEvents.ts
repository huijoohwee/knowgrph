import React from 'react'
import { findLineRangeFromTarget, computeMarkdownPreviewMenuPosition } from '@/features/markdown/ui/markdownPreviewContextMenuUtils'
import type { MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'

type UseMarkdownPreviewEventsProps = {
  rootElRef: React.MutableRefObject<HTMLDivElement | null>
  onShowInEditor?: (line: number) => void
  onPreviewClick?: (line: number) => void
  handleShowOnCanvas: (startLine: number, endLine: number) => void
  setSelectionToolbar: (state: MarkdownSelectionToolbarState | null) => void
}

export function useMarkdownPreviewEvents({
  rootElRef,
  onShowInEditor,
  onPreviewClick,
  handleShowOnCanvas,
  setSelectionToolbar,
}: UseMarkdownPreviewEventsProps) {

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Double click selects text, which triggers handleMouseUp to show the toolbar.
      // But user requested auto-position to editor on double-click.
      const range = findLineRangeFromTarget(e.currentTarget, e.target as HTMLElement)
      if (range && onShowInEditor) {
        onShowInEditor(range.startLine)
      }
    },
    [onShowInEditor],
  )

  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't show if simple click (handled by click handlers)
      // But we need to check selection
      const sel = typeof window !== 'undefined' ? window.getSelection() : null
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0 && rootElRef.current) {
        // Find line range for the selection
        // We use the anchorNode of selection
        let target = sel.anchorNode
        if (target && target.nodeType === Node.TEXT_NODE) {
            target = target.parentElement
        }
        const range = findLineRangeFromTarget(rootElRef.current, target)
        if (range) {
             const rect = rootElRef.current.getBoundingClientRect()
             // Position near mouse
             const x = e.clientX - rect.left
             const y = e.clientY - rect.top + 20
             setSelectionToolbar({
                 x,
                 y,
                 startLine: range.startLine,
                 endLine: range.endLine,
                 text: sel.toString()
             })
             // Stop propagation to prevent clearing selection immediately?
             // But mousedown listener clears it.
             e.stopPropagation() 
             return
        }
      }
      // If we are here, maybe it was a double click that selected a word?
      // handleClick handles double click action if we want to override it.
    },
    [rootElRef, setSelectionToolbar]
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

      if (e.detail >= 2) {
          // Double click
          // Check if selection exists, if so handleMouseUp will handle it (or has handled it)
          // But handleMouseUp fires after mouseup. click fires after mouseup.
          // dblclick fires after second click.
          // e.detail is on click event.
          
          // If we want to replace the default "edit" action with the toolbar,
          // we should ensure the toolbar shows up.
          // Double click usually selects a word.
          
          // Let's defer to onMouseUp for selection-based toolbar.
          // If the user wants double-click to just show toolbar, onMouseUp covers it because double-click selects text.
          
          // If onPreviewClick is present (which triggers edit), we might want to disable it if we show toolbar.
          // Or make "Edit" an option in toolbar.
          
          // We'll disable direct jump on double click if we have the toolbar feature enabled (which is implied by presence of onShowInEditor etc)
          if (onShowInEditor) {
              return 
          }
      }

      if (!onPreviewClick) return
      if (e.detail < 2) return
      const range = findLineRangeFromTarget(rootElRef.current, e.target)
      if (range) {
        onPreviewClick(range.startLine)
      }
    }, [handleShowOnCanvas, onPreviewClick, onShowInEditor, rootElRef],
  )

  const handleContextMenu = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rootEl = (e.currentTarget as HTMLDivElement) || rootElRef.current
    if (!rootEl) return
    
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    
    // If there is a selection, show the Selection Toolbar on context menu instead of the simple context menu
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
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
          text: sel.toString()
        })
      }
      return
    }

    const range = findLineRangeFromTarget(rootEl, e.target)
    if (!range) return
    e.preventDefault()
    const rect = rootEl.getBoundingClientRect()
    const pos = computeMarkdownPreviewMenuPosition({
      containerRect: rect,
      clientX: e.clientX,
      clientY: e.clientY,
      clampToContainer: true,
      selectionBlockRect: null, // Don't bias to block for simple click
      biasToSelectionBlock: false,
    })
    
    // For right-click without selection, we can also show the toolbar but with single line scope
    // But the toolbar is designed for "Show in..." actions which work for single line too.
    // Let's unify by showing the Selection Toolbar for right click too, effectively replacing the old ContextMenu
    
    setSelectionToolbar({
      x: pos.x,
      y: pos.y,
      startLine: range.startLine,
      endLine: range.endLine,
      text: '' // No text selected
    })
  }, [rootElRef, setSelectionToolbar])

  return { handleDoubleClick, handleMouseUp, handleClick, handleContextMenu }
}
