import React from 'react'
import { findLineRangeFromTarget } from '@/features/markdown/ui/markdownPreviewContextMenuUtils'
import type { MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import { cancelCoalescedTask, scheduleCoalescedTask } from '@/lib/async/coalescedScheduler'

type UseMarkdownPreviewEventsProps = {
  rootElRef: React.MutableRefObject<HTMLElement | null>
  handleShowOnCanvas: (startLine: number, endLine: number) => void
  setSelectionToolbar: (state: MarkdownSelectionToolbarState | null) => void
}

let markdownPreviewSelectionScheduleSeq = 0

export function useMarkdownPreviewEvents({
  rootElRef,
  handleShowOnCanvas,
  setSelectionToolbar,
}: UseMarkdownPreviewEventsProps) {
  const lastToolbarEmitRef = React.useRef<{ signature: string; atMs: number } | null>(null)
  const selectionScheduleKeyRef = React.useRef(`markdown-preview:selection:${++markdownPreviewSelectionScheduleSeq}`)
  const pendingSelectionArgsRef = React.useRef<{
    rootEl: HTMLElement
    eventTarget: EventTarget | null
    clientX?: number
    clientY?: number
    menuOpen?: boolean
  } | null>(null)
  const emitSelectionToolbar = React.useCallback((next: MarkdownSelectionToolbarState | null) => {
    if (!next) {
      setSelectionToolbar(null)
      return
    }
    if (!next.text.trim() && !next.menuOpen) {
      setSelectionToolbar(null)
      return
    }
    const signature = [
      next.startLine,
      next.endLine,
      next.menuOpen ? 1 : 0,
      next.text,
      Math.round(next.x),
      Math.round(next.y),
    ].join('|')
    const now = Date.now()
    const last = lastToolbarEmitRef.current
    if (last && last.signature === signature && now - last.atMs < 140) return
    lastToolbarEmitRef.current = { signature, atMs: now }
    setSelectionToolbar(next)
  }, [setSelectionToolbar])

  const resolveSelectionToolbarState = React.useCallback((args: {
    rootEl: HTMLElement
    eventTarget: EventTarget | null
    clientX?: number
    clientY?: number
    menuOpen?: boolean
  }): MarkdownSelectionToolbarState | null => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    const selectionText =
      sel && !sel.isCollapsed && sel.anchorNode && typeof sel.toString === 'function'
        ? String(sel.toString() || '')
        : ''
    const hasSelectionText = selectionText.trim().length > 0
    let range = findLineRangeFromTarget(args.rootEl, args.eventTarget)
    let anchorRect: DOMRect | null = null
    if (sel && hasSelectionText) {
      let selectionTarget: EventTarget | null = sel.anchorNode
      if (selectionTarget && (selectionTarget as Node).nodeType === Node.TEXT_NODE) {
        selectionTarget = (selectionTarget as Node).parentElement
      }
      if (!range) {
        range = findLineRangeFromTarget(args.rootEl, selectionTarget)
      }
      if (!range && typeof sel.getRangeAt === 'function' && sel.rangeCount > 0) {
        try {
          const domRange = sel.getRangeAt(0)
          const commonTarget = domRange.commonAncestorContainer
          range = findLineRangeFromTarget(args.rootEl, commonTarget)
          const rect = domRange.getBoundingClientRect()
          if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
            anchorRect = rect
          }
        } catch {
          void 0
        }
      }
    }
    if (!range) return null
    const rootRect = args.rootEl.getBoundingClientRect()
    const fallbackX = Number.isFinite(args.clientX as number) ? Number(args.clientX) : rootRect.left + (rootRect.width / 2)
    const fallbackY = Number.isFinite(args.clientY as number) ? Number(args.clientY) : rootRect.top + 8
    const xRaw = anchorRect ? (anchorRect.left + (anchorRect.width / 2)) : fallbackX
    const yRaw = anchorRect ? (anchorRect.top - 12) : fallbackY
    const x = Math.max(0, Math.min(rootRect.width - 16, xRaw - rootRect.left))
    const y = Math.max(0, Math.min(rootRect.height - 16, yRaw - rootRect.top))
    return {
      x,
      y,
      startLine: range.startLine,
      endLine: range.endLine,
      text: hasSelectionText ? selectionText : '',
      menuOpen: !!args.menuOpen,
    }
  }, [])

  const scheduleSelectionToolbarResolve = React.useCallback((args: {
    rootEl: HTMLElement
    eventTarget: EventTarget | null
    clientX?: number
    clientY?: number
    menuOpen?: boolean
  }) => {
    pendingSelectionArgsRef.current = args
    scheduleCoalescedTask(selectionScheduleKeyRef.current, () => {
      const pendingArgs = pendingSelectionArgsRef.current
      pendingSelectionArgsRef.current = null
      if (!pendingArgs) return
      const next = resolveSelectionToolbarState(pendingArgs)
      emitSelectionToolbar(next)
    }, 0)
  }, [emitSelectionToolbar, resolveSelectionToolbarState])

  React.useEffect(() => {
    const scheduleKey = selectionScheduleKeyRef.current
    return () => {
      pendingSelectionArgsRef.current = null
      cancelCoalescedTask(scheduleKey)
    }
  }, [])

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rootEl = (e.currentTarget as HTMLElement) || rootElRef.current
      if (!rootEl) return
    },
    [rootElRef],
  )

  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rootEl = (e.currentTarget as HTMLElement) || rootElRef.current
      if (!rootEl) return
      const target = e.target as HTMLElement | null
      const isMediaBlock = !!target?.closest('figure')
      const sel = typeof window !== 'undefined' ? window.getSelection() : null
      const hasText = sel && !sel.isCollapsed && sel.toString().trim().length > 0
      scheduleSelectionToolbarResolve({
        rootEl,
        eventTarget: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
        menuOpen: isMediaBlock && !hasText ? true : false,
      })
    },
    [rootElRef, scheduleSelectionToolbarResolve],
  )

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
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

  const handleContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rootEl = (e.currentTarget as HTMLElement) || rootElRef.current
    if (!rootEl) return
    e.preventDefault()
    scheduleSelectionToolbarResolve({
      rootEl,
      eventTarget: e.target,
      clientX: e.clientX,
      clientY: e.clientY,
      menuOpen: true,
    })
  }, [rootElRef, scheduleSelectionToolbarResolve])

  return { handleDoubleClick, handleMouseUp, handleClick, handleContextMenu }
}
