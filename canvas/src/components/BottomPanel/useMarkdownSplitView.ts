import React from 'react'
import type { MarkdownSelectionInfo } from './markdownUtils'
import { computeHighlightedLineRange, computeVisibleLineRange } from './markdownUtils'
import {
  getTextMeasureContext,
  estimateWrappedRowCountByChars,
  computeVisibleLineRangeWrapped,
} from './markdownLayoutUtils'

export function useBottomPanelMarkdownSplitView(args: {
  markdownText: string
  markdownWordWrap: boolean
  selectionInfo: MarkdownSelectionInfo | null
  uiPanelMonospaceTextClass: string
}) {
  const { markdownText, markdownWordWrap, selectionInfo, uiPanelMonospaceTextClass } = args

  const editorTextAreaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const viewerRef = React.useRef<HTMLDivElement | null>(null)
  const gutterLayerRef = React.useRef<HTMLDivElement | null>(null)

  const [splitRatio, setSplitRatio] = React.useState(0.5)
  const [markdownFullscreen, setMarkdownFullscreen] = React.useState(false)
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

  const syncingFromEditorRef = React.useRef(false)
  const syncingFromViewerRef = React.useRef(false)
  const lastEditorUserScrollAtRef = React.useRef(0)
  const lastViewerUserScrollAtRef = React.useRef(0)
  const lastEditorResizeAtRef = React.useRef(0)
  const editorLineCountRef = React.useRef(1)
  const editorScrollTopRef = React.useRef(0)
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

  React.useEffect(() => {
    const ta = editorTextAreaRef.current
    if (!ta) return
    let raf = 0
    let clearSyncRaf = 0
    let pending: 'scroll' | 'resize' | null = null
    const schedule = (reason: 'scroll' | 'resize') => {
      pending = pending === 'scroll' ? pending : reason
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const reasonToUse = pending || 'resize'
        pending = null

        const nextScrollTop = Math.max(0, Math.floor(ta.scrollTop))
        editorScrollTopRef.current = nextScrollTop
        const lh = Math.max(1, lineHeightPx || 16)
        const viewportSansPadding = Math.max(0, ta.clientHeight - editorPaddingTopPx - editorPaddingBottomPx)
        const model = wrapModelRef.current
        const range =
          markdownWordWrap && model?.prefixRows
            ? computeVisibleLineRangeWrapped({
                scrollTop: nextScrollTop,
                viewportHeight: viewportSansPadding,
                lineCount: editorLineCountRef.current,
                lineHeight: lh,
                prefixRows: model.prefixRows,
              })
            : computeVisibleLineRange({
                scrollTop: nextScrollTop,
                viewportHeight: viewportSansPadding,
                lineCount: editorLineCountRef.current,
                lineHeight: lh,
              })
        setVisibleLineRange(prev => (
          prev.startLine === range.startLine && prev.endLine === range.endLine ? prev : range
        ))
        const layer = gutterLayerRef.current
        if (layer) {
          const model = wrapModelRef.current
          const baseRow =
            markdownWordWrap && model?.rowStartByLine
              ? Math.max(1, model.rowStartByLine[range.startLine] || 1)
              : range.startLine
          layer.style.transform = `translateY(${(baseRow - 1) * lh - nextScrollTop}px)`
        }
        const viewer = viewerRef.current
        if (!viewer) return
        if (syncingFromViewerRef.current) return
        if (reasonToUse === 'scroll') {
          if (dragStateRef.current?.active) return
          if (clearSyncRaf) cancelAnimationFrame(clearSyncRaf)
          syncingFromEditorRef.current = true
          const editorScrollable = ta.scrollHeight - ta.clientHeight
          const ratio = editorScrollable > 0 ? ta.scrollTop / editorScrollable : 0
          const viewerScrollable = viewer.scrollHeight - viewer.clientHeight
          viewer.scrollTop = viewerScrollable > 0 ? ratio * viewerScrollable : 0
          clearSyncRaf = requestAnimationFrame(() => {
            syncingFromEditorRef.current = false
            clearSyncRaf = 0
          })
        }
      })
    }

    schedule('resize')
    const onScroll = () => {
      if (!syncingFromViewerRef.current) {
        lastEditorUserScrollAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      }
      schedule('scroll')
    }
    ta.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      lastEditorResizeAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      schedule('resize')
    })
    ro.observe(ta)
    const onWindowResize = () => schedule('resize')
    window.addEventListener('resize', onWindowResize)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (clearSyncRaf) cancelAnimationFrame(clearSyncRaf)
      ta.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [editorPaddingBottomPx, editorPaddingTopPx, lineHeightPx, markdownWordWrap])

  React.useEffect(() => {
    const viewer = viewerRef.current
    const ta = editorTextAreaRef.current
    if (!viewer || !ta) return
    let clearSyncRaf = 0
    const handleScroll = () => {
      if (syncingFromEditorRef.current) return
      lastViewerUserScrollAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const viewerScrollable = viewer.scrollHeight - viewer.clientHeight
      const ratio = viewerScrollable > 0 ? viewer.scrollTop / viewerScrollable : 0
      const editorScrollable = ta.scrollHeight - ta.clientHeight
      if (clearSyncRaf) cancelAnimationFrame(clearSyncRaf)
      syncingFromViewerRef.current = true
      ta.scrollTop = editorScrollable > 0 ? ratio * editorScrollable : 0
      clearSyncRaf = requestAnimationFrame(() => {
        syncingFromViewerRef.current = false
        clearSyncRaf = 0
      })
    }
    viewer.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      viewer.removeEventListener('scroll', handleScroll)
      if (clearSyncRaf) cancelAnimationFrame(clearSyncRaf)
    }
  }, [])

  React.useEffect(() => {
    const handler = () => {
      try {
        const el = viewerRef.current
        const active = typeof document !== 'undefined' && !!el && document.fullscreenElement === el
        setMarkdownFullscreen(active)
      } catch {
        setMarkdownFullscreen(false)
      }
    }
    try {
      document.addEventListener('fullscreenchange', handler)
    } catch {
      void 0
    }
    handler()
    return () => {
      try {
        document.removeEventListener('fullscreenchange', handler)
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    const ta = editorTextAreaRef.current
    const layer = gutterLayerRef.current
    if (!ta || !layer) return
    let raf = 0
    raf = requestAnimationFrame(() => {
      raf = 0
      const maxScrollable = Math.max(0, ta.scrollHeight - ta.clientHeight)
      const nextScrollTop = Math.max(0, Math.min(Math.floor(ta.scrollTop), Math.floor(maxScrollable)))
      if (ta.scrollTop !== nextScrollTop) {
        ta.scrollTop = nextScrollTop
      }
      const lh = Math.max(1, lineHeightPx || 16)
      const viewportSansPadding = Math.max(0, ta.clientHeight - editorPaddingTopPx - editorPaddingBottomPx)
      const model = wrapModelRef.current
      const range =
        markdownWordWrap && model?.prefixRows
          ? computeVisibleLineRangeWrapped({
              scrollTop: nextScrollTop,
              viewportHeight: viewportSansPadding,
              lineCount: editorLineCountRef.current,
              lineHeight: lh,
              prefixRows: model.prefixRows,
            })
          : computeVisibleLineRange({
              scrollTop: nextScrollTop,
              viewportHeight: viewportSansPadding,
              lineCount: editorLineCountRef.current,
              lineHeight: lh,
            })
      const baseRow =
        markdownWordWrap && model?.rowStartByLine
          ? Math.max(1, model.rowStartByLine[range.startLine] || 1)
          : range.startLine
      layer.style.transform = `translateY(${(baseRow - 1) * lh - nextScrollTop}px)`
      setVisibleLineRange(prev => (
        prev.startLine === range.startLine && prev.endLine === range.endLine ? prev : range
      ))
    })
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [editorPaddingBottomPx, editorPaddingTopPx, lineHeightPx, markdownText, markdownWordWrap])

  React.useEffect(() => {
    const ta = editorTextAreaRef.current
    const viewer = viewerRef.current
    if (!ta || !viewer) return
    if (!selectionInfo || selectionInfo.lineStart == null) return
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    if (dragStateRef.current?.active) return
    if (now - lastEditorResizeAtRef.current < 350) return
    if (now - lastEditorUserScrollAtRef.current < 350) return
    if (now - lastViewerUserScrollAtRef.current < 350) return
    const totalLines = editorLineCount || 1
    const line = Math.max(1, Math.min(selectionInfo.lineStart, totalLines))
    const denom = Math.max(1, totalLines - 1)
    const ratio = (line - 1) / denom
    const editorScrollable = ta.scrollHeight - ta.clientHeight
    const viewerScrollable = viewer.scrollHeight - viewer.clientHeight
    const editorTarget = editorScrollable > 0 ? ratio * editorScrollable : 0
    const viewerTarget = viewerScrollable > 0 ? ratio * viewerScrollable : 0
    ta.scrollTop = editorTarget
    viewer.scrollTop = viewerTarget
  }, [editorLineCount, selectionInfo])

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
    let raf = 0
    let pendingRatio = splitRatio
    const handleMove = (ev: PointerEvent) => {
      const st = dragStateRef.current
      if (!st || !st.active) return
      const dx = ev.clientX - st.startX
      const delta = st.containerWidth > 0 ? dx / st.containerWidth : 0
      pendingRatio = Math.max(0.2, Math.min(0.8, st.startRatio + delta))
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        setSplitRatio(prev => (prev === pendingRatio ? prev : pendingRatio))
      })
    }
    const handleUp = () => {
      dragStateRef.current = null
      if (raf) {
        window.cancelAnimationFrame(raf)
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
    markdownFullscreen,
    lineHeightPx,
    editorPaddingTopPx,
    editorPaddingBottomPx,
    editorLineCount,
    editorRowStartByLine,
    editorContentHeightPx,
    editorGutterWidthCh,
    visibleLineRange,
    highlightedLineRange,
  }
}
