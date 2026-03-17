import React from 'react'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

export type MarkdownScrollSyncConfig = {
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  viewerRef: React.RefObject<HTMLDivElement>
  gutterLayerRef: React.RefObject<HTMLDivElement>
  lineHeightPx: number
  editorPaddingTopPx: number
  editorPaddingBottomPx: number
  markdownWordWrap: boolean
  syncScroll: boolean
  wrapModelRef: React.MutableRefObject<unknown> // Legacy, unused with Monaco
  editorLineCountRef: React.MutableRefObject<number>
  visibleLineRangeRef: {
    value: { startLine: number; endLine: number }
    set: (next: { startLine: number; endLine: number }) => void
  }
  dragStateRef: React.MutableRefObject<{
    active: boolean
    startX: number
    startRatio: number
    containerWidth: number
  } | null>
}

const getViewportBias = () => {
  try {
    const g = globalThis as unknown as { __MARKDOWN_SCROLL_BIAS__?: unknown }
    const raw = g.__MARKDOWN_SCROLL_BIAS__
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw < 1) {
      return raw
    }
  } catch {
    void 0
  }
  return 0.45
}

const getScrollWeights = () => {
  try {
    const g = globalThis as unknown as { __MARKDOWN_SCROLL_WEIGHTS__?: unknown }
    const raw = g.__MARKDOWN_SCROLL_WEIGHTS__
    if (raw && typeof raw === 'object') {
      const obj = raw as {
        lineWeight?: unknown
        geomWeight?: unknown
        mediaBoost?: unknown
        tableBoost?: unknown
      }
      const lineWeight =
        typeof obj.lineWeight === 'number' && Number.isFinite(obj.lineWeight) && obj.lineWeight > 0
          ? obj.lineWeight
          : 2
      const geomWeight =
        typeof obj.geomWeight === 'number' && Number.isFinite(obj.geomWeight) && obj.geomWeight > 0
          ? obj.geomWeight
          : 1
      const mediaBoost =
        typeof obj.mediaBoost === 'number' && Number.isFinite(obj.mediaBoost) && obj.mediaBoost >= 0
          ? obj.mediaBoost
          : 0.5
      const tableBoost =
        typeof obj.tableBoost === 'number' && Number.isFinite(obj.tableBoost) && obj.tableBoost >= 0
          ? obj.tableBoost
          : 0.5
      return { lineWeight, geomWeight, mediaBoost, tableBoost }
    }
  } catch {
    void 0
  }
  return {
    lineWeight: 2,
    geomWeight: 1,
    mediaBoost: 0.5,
    tableBoost: 0.5,
  }
}

const getScrollDebugEnabled = () => {
  try {
    const g = globalThis as unknown as { __MARKDOWN_SCROLL_DEBUG__?: unknown }
    return g.__MARKDOWN_SCROLL_DEBUG__ === true
  } catch {
    return false
  }
}

const applyScrollDebugOutline = (
  el: HTMLElement | null,
  viewerDebugElRef: React.MutableRefObject<HTMLElement | null>,
) => {
  if (!getScrollDebugEnabled()) return
  const prev = viewerDebugElRef.current
  if (prev && prev !== el) {
    try {
      prev.style.outline = ''
    } catch {
      void 0
    }
  }
  if (el) {
    try {
      el.style.outline = '2px solid rgba(59,130,246,0.8)'
    } catch {
      void 0
    }
  }
  viewerDebugElRef.current = el
}

const getRaf = () => {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    return window.requestAnimationFrame.bind(window)
  }
  const g = globalThis as unknown as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }
  if (g.requestAnimationFrame) return g.requestAnimationFrame
  return (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
}

const getCancelRaf = () => {
  if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
    return window.cancelAnimationFrame.bind(window)
  }
  const g = globalThis as unknown as { cancelAnimationFrame?: (id: number) => void }
  if (g.cancelAnimationFrame) return g.cancelAnimationFrame
  return (id: number) => clearTimeout(id)
}

export function useMarkdownScrollSync(config: MarkdownScrollSyncConfig) {
  const {
    editorTextAreaRef,
    viewerRef,
    gutterLayerRef,
    lineHeightPx,
    syncScroll,
    editorLineCountRef,
    visibleLineRangeRef,
    dragStateRef,
  } = config

  const syncingFromEditorRef = React.useRef(false)
  const syncingFromViewerRef = React.useRef(false)
  const viewerSyncRafRef = React.useRef(0)
  const editorSyncRafRef = React.useRef(0)
  const editorClearSyncRafRef = React.useRef(0)
  const viewerClearSyncRafRef = React.useRef(0)
  const viewerDebugElRef = React.useRef<HTMLElement | null>(null)
  const syncScrollRef = React.useRef(syncScroll)
  const lastViewerSetEditorScrollTopRef = React.useRef<number | null>(null)
  const lastEditorSetViewerScrollTopRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    syncScrollRef.current = syncScroll
  }, [syncScroll])

  const syncViewerFromEditor = React.useCallback(() => {
    const handle = editorTextAreaRef.current
    if (!handle) return
    const rafFn = getRaf()
    const cancelRafFn = getCancelRaf()
    
    if (editorSyncRafRef.current) return
    editorSyncRafRef.current = rafFn(() => {
        editorSyncRafRef.current = 0
        
        const range = handle.getVisibleRange()
        visibleLineRangeRef.set(range)
        
        const layer = gutterLayerRef.current
        if (layer) {
          const startTop = handle.getTopForLineNumber(range.startLine)
          const scrollTop = handle.getScrollTop()
          // Adjust transform based on sub-pixel scroll if needed, but getTopForLineNumber includes scroll
          // Wait, getTopForLineNumber is relative to editor content top.
          // scrollTop is how much content is scrolled up.
          // So relative to viewport: top - scrollTop
          layer.style.transform = `translateY(${startTop - scrollTop}px)`
        }
        
        const viewer = viewerRef.current
        if (!viewer) return
        if (!syncScrollRef.current) return
        if (syncingFromViewerRef.current) return
        
        if (dragStateRef.current?.active) return
        if (editorClearSyncRafRef.current) cancelRafFn(editorClearSyncRafRef.current)
        syncingFromEditorRef.current = true

        const totalLines = editorLineCountRef.current || 1
        const midLine = Math.max(
            1,
            Math.min(
              range.startLine + Math.floor((range.endLine - range.startLine) / 2),
              totalLines,
            ),
        )
        
        let viewerTargetTop: number | null = null
        try {
            const container = viewer
            const containerRect =
              typeof container.getBoundingClientRect === 'function'
              ? container.getBoundingClientRect()
              : null
            if (containerRect && containerRect.height > 1 && containerRect.width > 1) {
              const bias = getViewportBias()
              const anchor = containerRect.top + containerRect.height * bias
              const nodes = container.querySelectorAll<HTMLElement>('[data-start-line]')
              const weights = getScrollWeights()
              const lh = Math.max(1, lineHeightPx || 16)
              const blocks: {
                el: HTMLElement
                start: number
                end: number
                midY: number
              }[] = []
              nodes.forEach(el => {
                const rawStart = el.getAttribute('data-start-line')
                if (!rawStart) return
                const start = Number.parseInt(rawStart, 10)
                if (!Number.isFinite(start)) return
                const rawEnd = el.getAttribute('data-end-line')
                const parsedEnd = rawEnd ? Number.parseInt(rawEnd, 10) : NaN
                const end = Number.isFinite(parsedEnd) ? parsedEnd : start
                const elRect =
                  typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
                if (!elRect) return
                const elMid = (elRect.top + elRect.bottom) / 2
                blocks.push({
                  el,
                  start: Math.max(1, Math.min(start, totalLines)),
                  end: Math.max(1, Math.min(Math.max(start, end), totalLines)),
                  midY: elMid,
                })
              })
              let best: HTMLElement | null = null
              let bestScore = Number.POSITIVE_INFINITY
              blocks.forEach(block => {
                const cls = block.el.className || ''
                const hasClass = (needle: string) =>
                  typeof cls === 'string' && needle && cls.indexOf(needle) >= 0
                const isMedia =
                  hasClass('MediaWrapper') ||
                  hasClass('aspect-video') ||
                  hasClass('markdown-media') ||
                  hasClass('max-w-xl')
                const isTable =
                  hasClass('MarkdownTable') ||
                  hasClass('min-w-full') ||
                  hasClass('table') ||
                  hasClass('overflow-auto')
                const inRange = midLine >= block.start && midLine <= block.end
                const lineDelta = inRange
                  ? 0
                  : Math.min(Math.abs(midLine - block.start), Math.abs(midLine - block.end))
                const geomDelta = Math.abs(block.midY - anchor)
                const baseScore = lineDelta * lh * weights.lineWeight + geomDelta * weights.geomWeight
                const bonus =
                  (isMedia ? weights.mediaBoost : 0) +
                  (isTable ? weights.tableBoost : 0)
                const score = baseScore - bonus * lh
                if (score < bestScore) {
                  bestScore = score
                  best = block.el
                }
              })
              if (best) {
                const elRect =
                  typeof best.getBoundingClientRect === 'function'
                    ? best.getBoundingClientRect()
                    : null
                if (elRect && elRect.height > 1 && elRect.width > 1) {
                  const bias = getViewportBias()
                  const anchorOffset = containerRect.height * bias
                  const offset =
                    container.scrollTop +
                    (elRect.top - containerRect.top) -
                    (anchorOffset - elRect.height / 2)
                  const viewerScrollable = Math.max(0, container.scrollHeight - container.clientHeight)
                  viewerTargetTop =
                    viewerScrollable > 0
                      ? Math.min(Math.max(0, offset), viewerScrollable)
                      : Math.max(0, offset)
                }

                applyScrollDebugOutline(best, viewerDebugElRef)
              }
            }
        } catch {
            viewerTargetTop = null
        }

        if (viewerTargetTop == null) {
            const nextScrollTop = Math.max(0, Math.floor(handle.getScrollTop()))
            const editorScrollable = Math.max(0, handle.getScrollHeight() - handle.getClientHeight())
            const viewerScrollable = Math.max(0, viewer.scrollHeight - viewer.clientHeight)
            const ratio = editorScrollable > 0 ? nextScrollTop / editorScrollable : 0
            const clamped = Math.min(1, Math.max(0, ratio))
            const nextViewerTop = viewerScrollable > 0 ? clamped * viewerScrollable : 0
            lastEditorSetViewerScrollTopRef.current = nextViewerTop
            viewer.scrollTop = nextViewerTop
        } else {
            lastEditorSetViewerScrollTopRef.current = viewerTargetTop
            viewer.scrollTop = viewerTargetTop
        }

        editorClearSyncRafRef.current = rafFn(() => {
            syncingFromEditorRef.current = false
            editorClearSyncRafRef.current = 0
        })
    })
  }, [lineHeightPx, editorLineCountRef, viewerRef, editorTextAreaRef, gutterLayerRef, visibleLineRangeRef, dragStateRef])

  React.useEffect(() => {
    const rafFn = getRaf()
    const cancelRafFn = getCancelRaf()
    let readyRafId: number | null = null
    let scrollSub: { dispose: () => void } | null = null
    let layoutSub: { dispose: () => void } | null = null
    let attachAttempts = 0

    const onWindowResize = () => syncViewerFromEditor()
    window.addEventListener('resize', onWindowResize)

    const attach = () => {
      const handle = editorTextAreaRef.current
      if (!handle) {
        attachAttempts += 1
        if (attachAttempts > 240) return
        readyRafId = rafFn(() => attach())
        return
      }

      syncViewerFromEditor()
      scrollSub = handle.onDidScrollChange(() => syncViewerFromEditor())
      layoutSub = handle.onDidLayoutChange(() => syncViewerFromEditor())
    }

    attach()

    return () => {
      if (readyRafId != null) cancelRafFn(readyRafId)
      if (editorSyncRafRef.current) {
          cancelRafFn(editorSyncRafRef.current)
          editorSyncRafRef.current = 0
      }
      if (editorClearSyncRafRef.current) {
          cancelRafFn(editorClearSyncRafRef.current)
          editorClearSyncRafRef.current = 0
      }
      if (scrollSub) scrollSub.dispose()
      if (layoutSub) layoutSub.dispose()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [editorTextAreaRef, syncViewerFromEditor])

  const handleViewerScroll = React.useCallback((e?: React.UIEvent<HTMLDivElement>) => {
    const rafFn = getRaf()
    const cancelRafFn = getCancelRaf()
    const viewerFromEvent = e?.currentTarget ?? null
    
    // Throttle scroll handling
    if (viewerSyncRafRef.current) return
    
    viewerSyncRafRef.current = rafFn(() => {
        viewerSyncRafRef.current = 0
        
        const viewer = viewerFromEvent || viewerRef.current
        const handle = editorTextAreaRef.current
        if (syncingFromEditorRef.current) {
          const last = lastEditorSetViewerScrollTopRef.current
          if (viewer && last != null && Math.abs(viewer.scrollTop - last) <= 1) return
        }
        if (!viewer || !handle) return
        if (!syncScrollRef.current) return
    
        const totalLines = editorLineCountRef.current || 1
    
        let targetLine: number | null = null
        try {
          const containerRect =
            typeof viewer.getBoundingClientRect === 'function' ? viewer.getBoundingClientRect() : null
          if (containerRect) {
            const bias = getViewportBias()
            const anchor = containerRect.top + containerRect.height * bias
            const nodes = viewer.querySelectorAll<HTMLElement>('[data-start-line]')
            let best: HTMLElement | null = null
            let bestDelta = Number.POSITIVE_INFINITY
            nodes.forEach(el => {
              const raw = el.getAttribute('data-start-line')
              if (!raw) return
              const start = Number.parseInt(raw, 10)
              if (!Number.isFinite(start)) return
              const elRect =
                typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
              if (!elRect) return
              const elMid = (elRect.top + elRect.bottom) / 2
              const delta = Math.abs(elMid - anchor)
              if (delta < bestDelta) {
                bestDelta = delta
                best = el
              }
            })
            if (best) {
              const rawStart = best.getAttribute('data-start-line')
              const rawEnd = best.getAttribute('data-end-line')
              const start = rawStart ? Number.parseInt(rawStart, 10) : NaN
              const endParsed = rawEnd ? Number.parseInt(rawEnd, 10) : NaN
              const end = Number.isFinite(endParsed) ? endParsed : start
              if (Number.isFinite(start)) {
                const s = Math.max(1, Math.min(start, totalLines))
                const e = Math.max(s, Math.min(end, totalLines))
                const mid = Math.round((s + e) / 2)
                targetLine = mid
              }
    
              applyScrollDebugOutline(best, viewerDebugElRef)
            }
          }
        } catch {
          targetLine = null
        }
    
        syncingFromViewerRef.current = true
    
        if (targetLine != null) {
          const desiredTop = handle.getTopForLineNumber(targetLine)
          lastViewerSetEditorScrollTopRef.current = desiredTop
          handle.setScrollTop(desiredTop)
        } else {
          const viewerScrollable = Math.max(0, viewer.scrollHeight - viewer.clientHeight)
          const ratio = viewerScrollable > 0 ? viewer.scrollTop / Math.max(1, viewerScrollable) : 0
          const clamped = Math.min(1, Math.max(0, ratio))
          const editorScrollable = Math.max(0, handle.getScrollHeight() - handle.getClientHeight())
          const desiredTop = editorScrollable > 0 ? clamped * editorScrollable : 0
          lastViewerSetEditorScrollTopRef.current = desiredTop
          handle.setScrollTop(desiredTop)
        }

        if (viewerClearSyncRafRef.current) cancelRafFn(viewerClearSyncRafRef.current)
        viewerClearSyncRafRef.current = rafFn(() => {
          syncingFromViewerRef.current = false
          viewerClearSyncRafRef.current = 0
        })
    })
  }, [editorLineCountRef, viewerRef, editorTextAreaRef])

  React.useEffect(() => {
    return () => {
      const cancelRafFn = getCancelRaf()
      const raf = viewerSyncRafRef.current
      if (raf) cancelRafFn(raf)
      const clearRaf = viewerClearSyncRafRef.current
      if (clearRaf) cancelRafFn(clearRaf)
    }
  }, [])

  return { handleViewerScroll, syncViewerFromEditor }
}
