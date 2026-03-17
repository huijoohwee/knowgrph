import React from 'react'
import type { MarkdownSelectionInfo } from './markdownUtils'
import { computeHighlightedLineRange } from './markdownUtils'
import { useMarkdownScrollSync } from './useMarkdownScrollSync'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { UI_LAYOUT } from '@/lib/config'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'

export function useBottomPanelMarkdownSplitView(args: {
  markdownText: string
  markdownWordWrap: boolean
  selectionInfo: MarkdownSelectionInfo | null
  uiPanelMonospaceTextClass: string
  syncScroll: boolean
}) {
  const {
    markdownText,
    markdownWordWrap,
    selectionInfo,
    uiPanelMonospaceTextClass,
    syncScroll,
  } = args

  const editorTextAreaRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const gutterLayerRef = React.useRef<HTMLDivElement | null>(null)

  const [splitRatio, setSplitRatio] = React.useState(0.5)
  const [lineHeightPx, setLineHeightPx] = React.useState(16)
  const [editorPaddingTopPx, setEditorPaddingTopPx] = React.useState(0)
  const [editorPaddingBottomPx, setEditorPaddingBottomPx] = React.useState(0)
  const [visibleLineRange, setVisibleLineRange] = React.useState({ startLine: 1, endLine: 1 })

  const dragStateRef = React.useRef<{
    active: boolean
    startX: number
    startRatio: number
    containerWidth: number
  } | null>(null)

  const editorLineCountRef = React.useRef(1)
  const wrapModelRef = React.useRef<unknown>(null)

  const editorLineCount = React.useMemo(() => {
    const text = markdownText || ''
    if (!text) return 1
    return text.split('\n').length || 1
  }, [markdownText])

  const highlightedLineRange = React.useMemo(
    () => computeHighlightedLineRange(editorLineCount, selectionInfo),
    [editorLineCount, selectionInfo],
  )

  const editorGutterWidthCh = React.useMemo(() => {
    const digits = Math.max(2, String(Math.max(1, editorLineCount)).length)
    return Math.max(4, digits + 2)
  }, [editorLineCount])

  React.useLayoutEffect(() => {
    const handle = editorTextAreaRef.current
    if (!handle) return
    
    const updateMeasures = () => {
        const lh = handle.getLineHeight() || 16
        setLineHeightPx(lh)
        setEditorPaddingTopPx(UI_LAYOUT.toolbarOffsetPx)
        setEditorPaddingBottomPx(0)
    }

    updateMeasures()
    const layoutSub = handle.onDidLayoutChange(() => updateMeasures())
    
    return () => {
      layoutSub.dispose()
    }
  }, [uiPanelMonospaceTextClass])

  const editorRowStartByLine = React.useMemo(() => {
    const lineCount = editorLineCount
    const fallback = new Array<number>(lineCount + 1)
    fallback[0] = 1
    for (let i = 1; i <= lineCount; i += 1) fallback[i] = i
    return fallback
  }, [editorLineCount])

  const editorContentHeightPx = React.useMemo(() => {
    const lh = Math.max(1, lineHeightPx || 16)
    return editorLineCount * lh
  }, [editorLineCount, lineHeightPx])

  React.useEffect(() => {
    editorLineCountRef.current = editorLineCount
    setVisibleLineRange(prev => {
      if (prev.endLine > editorLineCount) {
        const startLine = Math.min(prev.startLine, editorLineCount)
        return { startLine, endLine: editorLineCount }
      }
      return prev
    })
  }, [editorLineCount])

  const { handleViewerScroll, syncViewerFromEditor } = useMarkdownScrollSync({
    editorTextAreaRef,
    viewerRef,
    gutterLayerRef,
    lineHeightPx,
    editorPaddingTopPx,
    editorPaddingBottomPx,
    markdownWordWrap,
    syncScroll,
    wrapModelRef,
    editorLineCountRef,
    visibleLineRangeRef: {
      value: visibleLineRange,
      set: next => {
        setVisibleLineRange(prev => (
          prev.startLine === next.startLine && prev.endLine === next.endLine ? prev : next
        ))
      },
    },
    dragStateRef,
  })

  React.useLayoutEffect(() => {
    const handle = editorTextAreaRef.current
    const layer = gutterLayerRef.current
    if (!handle || !layer) return
    if (!selectionInfo || selectionInfo.lineStart == null) return
    if (dragStateRef.current?.active) return
    const rafFn = (cb: FrameRequestCallback) => {
      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        return window.requestAnimationFrame(cb)
      }
      return setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const cancelRafFn = (id: number) => {
      if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(id)
        return
      }
      clearTimeout(id)
    }
    let raf = 0
    let attempts = 0
    const align = () => {
      attempts += 1
      const totalLines = editorLineCount || 1
      const line = Math.max(1, Math.min(selectionInfo.lineStart || 1, totalLines))
      
      const desiredTop = handle.getTopForLineNumber(line)
      const editorScrollable = Math.max(0, handle.getScrollHeight() - handle.getClientHeight())
      
      if (editorScrollable <= 0 && attempts < 8) {
        raf = rafFn(align)
        return
      }
      
      const targetTop = editorScrollable > 0 ? Math.min(desiredTop, editorScrollable) : desiredTop
      handle.setScrollTop(targetTop)
      
      const viewer = viewerRef.current
      if (viewer) {
        const container = viewer
        const targetLine = line
        let viewerTargetTop: number | null = null
        try {
          const nodes = container.querySelectorAll<HTMLElement>('[data-start-line]')
          let best: HTMLElement | null = null
          let bestStart = Number.POSITIVE_INFINITY
          let fallback: HTMLElement | null = null
          let fallbackStart = 0
          nodes.forEach(el => {
            const raw = el.getAttribute('data-start-line')
            if (!raw) return
            const n = Number.parseInt(raw, 10)
            if (!Number.isFinite(n)) return
            if (n >= targetLine && n < bestStart) {
              bestStart = n
              best = el
            }
            if (n <= targetLine && n >= fallbackStart) {
              fallbackStart = n
              fallback = el
            }
          })
          const el = best || fallback
          if (el) {
            const containerRect =
              typeof container.getBoundingClientRect === 'function'
                ? container.getBoundingClientRect()
                : null
            const elRect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
            if (containerRect && elRect) {
              const offset = elRect.top - containerRect.top + container.scrollTop
              const viewerScrollable = Math.max(0, container.scrollHeight - container.clientHeight)
              viewerTargetTop =
                viewerScrollable > 0 ? Math.min(Math.max(0, offset), viewerScrollable) : Math.max(0, offset)
            }
          }
        } catch {
          viewerTargetTop = null
        }
        if (viewerTargetTop == null && attempts < 8) {
          raf = rafFn(align)
          return
        }
        if (viewerTargetTop != null) {
          container.scrollTop = viewerTargetTop
        }
      }
    }
    raf = rafFn(align)
    return () => {
      if (raf) cancelRafFn(raf)
    }
  }, [editorLineCount, selectionInfo, lineHeightPx, markdownWordWrap])

  const handleDividerPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const container = e.currentTarget.parentElement as HTMLElement | null
    const width = container ? container.offsetWidth : window.innerWidth
    const startX = e.clientX
    const startRatio = splitRatio
    const containerWidth = width
    let raf = 0
    let pendingRatio = splitRatio
    const rafFn = (cb: FrameRequestCallback) => {
      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        return window.requestAnimationFrame(cb)
      }
      return setTimeout(() => cb(Date.now()), 0) as unknown as number
    }
    const cancelRafFn = (id: number) => {
      if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(id)
        return
      }
      clearTimeout(id)
    }

    dragStateRef.current = {
      active: true,
      startX,
      startRatio,
      containerWidth,
    }

    startPointerDrag({
      ev: e.nativeEvent,
      cursor: 'col-resize',
      shouldStart: ev => {
        if (ev.button !== undefined && ev.button !== 0) return false
        return true
      },
      onMove: mv => {
        const st = dragStateRef.current
        if (!st || !st.active) return
        const dx = mv.clientX - st.startX
        const delta = st.containerWidth > 0 ? dx / st.containerWidth : 0
        pendingRatio = Math.max(0.2, Math.min(0.8, st.startRatio + delta))
        if (raf) return
        raf = rafFn(() => {
          raf = 0
          setSplitRatio(prev => (prev === pendingRatio ? prev : pendingRatio))
        })
      },
      onEnd: () => {
        dragStateRef.current = null
        if (raf) {
          cancelRafFn(raf)
          raf = 0
        }
      },
      onCancel: () => {
        dragStateRef.current = null
        if (raf) {
          cancelRafFn(raf)
          raf = 0
        }
      },
    })
  }, [splitRatio])

  return {
    editorTextAreaRef,
    viewerRef,
    gutterLayerRef,
    splitRatio,
    handleDividerPointerDown,
    handleViewerScroll,
    syncViewerFromEditor,
    lineHeightPx,
    editorPaddingTopPx,
    editorLineCount,
    editorRowStartByLine,
    editorContentHeightPx,
    editorGutterWidthCh,
    visibleLineRange,
    highlightedLineRange,
  }
}
