import React from 'react'
import type { MarkdownSelectionInfo } from './markdownUtils'
import { computeHighlightedLineRange } from './markdownUtils'
import {
  getTextMeasureContext,
  estimateWrappedRowCountByChars,
} from './markdownLayoutUtils'
import { useMarkdownScrollSync } from './useMarkdownScrollSync'

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

  const editorTextAreaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const gutterLayerRef = React.useRef<HTMLDivElement | null>(null)

  const [splitRatio, setSplitRatio] = React.useState(0.5)
  const [lineHeightPx, setLineHeightPx] = React.useState(16)
  const [editorPaddingTopPx, setEditorPaddingTopPx] = React.useState(8)
  const [editorPaddingBottomPx, setEditorPaddingBottomPx] = React.useState(8)
  const [editorContentWidthPx, setEditorContentWidthPx] = React.useState(320)
  const [editorFontCss, setEditorFontCss] = React.useState('12px monospace')
  const [visibleLineRange, setVisibleLineRange] = React.useState({ startLine: 1, endLine: 1 })

  const dragStateRef = React.useRef<{
    active: boolean
    startX: number
    startRatio: number
    containerWidth: number
  } | null>(null)

  const editorLineCountRef = React.useRef(1)
  const wrapModelRef = React.useRef<{
    prefixRows: number[]
    rowStartByLine: number[]
    totalRows: number
  } | null>(null)

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
    const ta = editorTextAreaRef.current
    if (!ta) return
    const computeLineHeightPx = (): number => {
      try {
        const raw = window.getComputedStyle(ta).lineHeight
        const parsed = Number.parseFloat(raw)
        if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
        return 16
      } catch {
        return 16
      }
    }
    const computePaddingPx = (): { top: number; bottom: number } => {
      try {
        const style = window.getComputedStyle(ta)
        const top = Math.max(0, Math.round(Number.parseFloat(style.paddingTop || '0') || 0))
        const bottom = Math.max(0, Math.round(Number.parseFloat(style.paddingBottom || '0') || 0))
        return { top, bottom }
      } catch {
        return { top: 8, bottom: 8 }
      }
    }
    const computeTextMeasure = (): { contentWidthPx: number; fontCss: string } => {
      try {
        const style = window.getComputedStyle(ta)
        const padLeft = Math.max(0, Math.round(Number.parseFloat(style.paddingLeft || '0') || 0))
        const padRight = Math.max(0, Math.round(Number.parseFloat(style.paddingRight || '0') || 0))
        const width = Math.max(1, Math.floor(ta.clientWidth - padLeft - padRight))
        const fontCss = (style.font && style.font.trim()) || `${style.fontSize || '12px'} ${style.fontFamily || 'monospace'}`
        return { contentWidthPx: width, fontCss }
      } catch {
        return { contentWidthPx: 320, fontCss: '12px monospace' }
      }
    }

    const lh = computeLineHeightPx()
    const pad = computePaddingPx()
    const measure = computeTextMeasure()
    setLineHeightPx(prev => (prev === lh ? prev : lh))
    setEditorPaddingTopPx(prev => (prev === pad.top ? prev : pad.top))
    setEditorPaddingBottomPx(prev => (prev === pad.bottom ? prev : pad.bottom))
    setEditorContentWidthPx(prev => (prev === measure.contentWidthPx ? prev : measure.contentWidthPx))
    setEditorFontCss(prev => (prev === measure.fontCss ? prev : measure.fontCss))
  }, [uiPanelMonospaceTextClass])

  const wrapModel = React.useMemo(() => {
    if (!markdownWordWrap) return null
    const text = markdownText || ''
    const lines = text ? text.split('\n') : ['']
    const lineCount = Math.max(1, lines.length)
    const ctx = getTextMeasureContext(editorFontCss)
    if (!ctx) return null
    const prefixRows = new Array<number>(lineCount + 1)
    const rowStartByLine = new Array<number>(lineCount + 1)
    prefixRows[0] = 0
    rowStartByLine[0] = 1
    for (let i = 1; i <= lineCount; i += 1) {
      rowStartByLine[i] = prefixRows[i - 1] + 1
      const rows = estimateWrappedRowCountByChars({
        text: lines[i - 1] ?? '',
        maxWidthPx: editorContentWidthPx,
        ctx,
      })
      prefixRows[i] = prefixRows[i - 1] + Math.max(1, rows)
    }
    const totalRows = Math.max(1, prefixRows[lineCount] || 1)
    return { prefixRows, rowStartByLine, totalRows }
  }, [editorContentWidthPx, editorFontCss, markdownText, markdownWordWrap])

  React.useEffect(() => {
    wrapModelRef.current = wrapModel
  }, [wrapModel])

  const editorRowStartByLine = React.useMemo(() => {
    const lineCount = editorLineCount
    const model = wrapModel
    if (markdownWordWrap && model?.rowStartByLine) {
      if (model.rowStartByLine.length === lineCount + 1) return model.rowStartByLine
    }
    const fallback = new Array<number>(lineCount + 1)
    fallback[0] = 1
    for (let i = 1; i <= lineCount; i += 1) fallback[i] = i
    return fallback
  }, [editorLineCount, markdownWordWrap, wrapModel])

  const editorContentHeightPx = React.useMemo(() => {
    const lh = Math.max(1, lineHeightPx || 16)
    const model = wrapModel
    const rowCount = markdownWordWrap && model ? model.totalRows : editorLineCount
    return editorPaddingTopPx + editorPaddingBottomPx + rowCount * lh
  }, [
    editorLineCount,
    editorPaddingBottomPx,
    editorPaddingTopPx,
    lineHeightPx,
    markdownWordWrap,
    wrapModel,
  ])

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

  const { handleViewerScroll } = useMarkdownScrollSync({
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

  React.useEffect(() => {
    const ta = editorTextAreaRef.current
    const layer = gutterLayerRef.current
    if (!ta || !layer) return
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
      clearTimeout(id as unknown as NodeJS.Timeout)
    }
    let raf = 0
    let attempts = 0
    const align = () => {
      attempts += 1
      const totalLines = editorLineCount || 1
      const line = Math.max(1, Math.min(selectionInfo.lineStart || 1, totalLines))
      const lh = Math.max(1, lineHeightPx || 16)
      const model = wrapModelRef.current
      const rowStartByLine =
        markdownWordWrap && model?.rowStartByLine && model.rowStartByLine.length === totalLines + 1
          ? model.rowStartByLine
          : null
      const rowIndex = rowStartByLine ? Math.max(0, (rowStartByLine[line] || 1) - 1) : Math.max(0, line - 1)
      const desiredTop = rowIndex * lh
      const editorScrollable = Math.max(0, ta.scrollHeight - ta.clientHeight)
      if (editorScrollable <= 0 && attempts < 8) {
        raf = rafFn(align)
        return
      }
      const targetTop = editorScrollable > 0 ? Math.min(desiredTop, editorScrollable) : desiredTop
      ta.scrollTop = targetTop
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
    e.preventDefault()
    const container = e.currentTarget.parentElement as HTMLElement | null
    const width = container ? container.offsetWidth : window.innerWidth
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startRatio: splitRatio,
      containerWidth: width,
    }
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
      clearTimeout(id as unknown as NodeJS.Timeout)
    }
    let raf = 0
    let pendingRatio = splitRatio
    const handleMove = (ev: PointerEvent) => {
      const st = dragStateRef.current
      if (!st || !st.active) return
      const dx = ev.clientX - st.startX
      const delta = st.containerWidth > 0 ? dx / st.containerWidth : 0
      pendingRatio = Math.max(0.2, Math.min(0.8, st.startRatio + delta))
      if (raf) return
      raf = rafFn(() => {
        raf = 0
        setSplitRatio(prev => (prev === pendingRatio ? prev : pendingRatio))
      })
    }
    const handleUp = () => {
      dragStateRef.current = null
      if (raf) {
        cancelRafFn(raf)
        raf = 0
      }
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerup', handleUp)
  }, [splitRatio])

  return {
    editorTextAreaRef,
    viewerRef,
    gutterLayerRef,
    splitRatio,
    handleDividerPointerDown,
    handleViewerScroll,
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
