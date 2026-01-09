import React from 'react'
import { lexMarkdown, lexMarkdownContent, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getDocumentPathFromMetadata } from '@/features/graph-data-table/graphDataTable'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import {
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { getNodeBaseFill, getEdgeBaseStroke } from '@/components/GraphCanvas/helpers'

export type MarkdownPreviewPresentationApi = {
  prev: () => void
  next: () => void
}

export type MarkdownPreviewPresentationSlideState = {
  activeSlideIndex: number
  slideCount: number
}

type MarkdownPreviewProps = {
  markdownText: string
  activeDocumentPath: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  markdownTextHighlight: boolean
  selectionKind?: 'node' | 'edge' | null
  highlightBackgroundColor?: string | null
  highlightUnderlineColor?: string | null
  selectionId?: string | null
  alwaysOnHighlightMode?: boolean
  presentationApiRef?: React.MutableRefObject<MarkdownPreviewPresentationApi | null>
  onPresentationSlideStateChange?: (state: MarkdownPreviewPresentationSlideState) => void
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  previewOverlayScope?: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  previewScrollable?: boolean
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
}

const normalizeSlideOrder = (prev: number[], slideCount: number): number[] => {
  const n = Math.max(0, slideCount)
  const raw = Array.isArray(prev) ? prev : []
  const normalized = raw.filter(i => Number.isFinite(i) && i >= 0 && i < n)
  const seen = new Set<number>()
  const deduped: number[] = []
  for (const i of normalized) {
    if (seen.has(i)) continue
    seen.add(i)
    deduped.push(i)
  }
  for (let i = 0; i < n; i += 1) {
    if (!seen.has(i)) deduped.push(i)
  }
  return deduped
}

const MarkdownPreview = React.forwardRef<HTMLDivElement, MarkdownPreviewProps>(function MarkdownPreview(
  {
    markdownText,
    activeDocumentPath,
    highlightedLineRange,
    markdownWordWrap,
    markdownPresentationMode,
    markdownTextHighlight,
    selectionKind,
    highlightBackgroundColor,
    highlightUnderlineColor,
    selectionId,
    alwaysOnHighlightMode = false,
    presentationApiRef,
    onPresentationSlideStateChange,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    previewOverlayScope = 'viewport',
    previewOverlayPortalTarget,
    previewScrollable = true,
    onScroll,
  },
  ref,
  ) {

  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const rootThemeMode = useRootThemeMode()
  const [flashSelectionId, setFlashSelectionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectionId) {
      setFlashSelectionId(null)
      return
    }
    setFlashSelectionId(selectionId)
    let timer: number | null = null
    try {
      timer = window.setTimeout(() => {
        setFlashSelectionId(current => (current === selectionId ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          window.clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [selectionId, selectionFlashDurationMs])
  const rootElRef = React.useRef<HTMLDivElement | null>(null)
  const setRootRef = React.useCallback((el: HTMLDivElement | null) => {
    rootElRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [ref])

  const { headMeta, slides } = React.useMemo(() => splitSlides(markdownText || ''), [markdownText])
  const mermaidFrontmatterConfig = React.useMemo(() => parseMermaidConfigFromFrontmatter(headMeta), [headMeta])

  const [activeSlideIndex, setActiveSlideIndex] = React.useState(0)
  const [isSlidesFullscreenOpen, setIsSlidesFullscreenOpen] = React.useState(false)
  const [slideOrder, setSlideOrder] = React.useState<number[]>([])

  const orderedSlideIndices = React.useMemo(
    () => normalizeSlideOrder(slideOrder, slides.length),
    [slideOrder, slides.length],
  )

  const activeSlideId = orderedSlideIndices[Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1))] ?? 0
  const activeSlide = slides[activeSlideId] || slides[0]

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    setSlideOrder(prev => normalizeSlideOrder(prev, slides.length))
  }, [markdownPresentationMode, slides.length])

  React.useEffect(() => {
    const maxIdx = Math.max(0, orderedSlideIndices.length - 1)
    setActiveSlideIndex(i => Math.min(Math.max(0, i), maxIdx))
  }, [orderedSlideIndices.length])

  const goPrev = React.useCallback(() => {
    setActiveSlideIndex(i => Math.max(0, i - 1))
  }, [])

  const goNext = React.useCallback(() => {
    setActiveSlideIndex(i => Math.min(Math.max(0, orderedSlideIndices.length - 1), i + 1))
  }, [orderedSlideIndices.length])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      if (presentationApiRef) presentationApiRef.current = null
      return
    }
    if (presentationApiRef) {
      presentationApiRef.current = { prev: goPrev, next: goNext }
    }
    onPresentationSlideStateChange?.({
      activeSlideIndex: Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1)),
      slideCount: Math.max(0, slides.length),
    })
  }, [
    activeSlideIndex,
    goNext,
    goPrev,
    markdownPresentationMode,
    onPresentationSlideStateChange,
    presentationApiRef,
    orderedSlideIndices.length,
    slides.length,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    if (!highlightedLineRange) return
    const target = highlightedLineRange.start
    const idx = slides.findIndex(s => target >= s.startLine && target <= s.endLine)
    if (idx >= 0) {
      const next = orderedSlideIndices.indexOf(idx)
      const nextIdx = next >= 0 ? next : idx
      setActiveSlideIndex(prev => (prev === nextIdx ? prev : nextIdx))
    }
  }, [highlightedLineRange, markdownPresentationMode, orderedSlideIndices, slides])

  const [presentationViewport, setPresentationViewport] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 })
  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const el = rootElRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      setPresentationViewport(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [markdownPresentationMode])

  const baseSlideSize = React.useMemo(() => ({ w: 1280, h: 720 }), [])
  const slideScale = React.useMemo(() => {
    const availableW = Math.max(1, presentationViewport.w)
    const availableH = Math.max(1, presentationViewport.h)
    return Math.max(0.05, Math.min(availableW / baseSlideSize.w, availableH / baseSlideSize.h))
  }, [baseSlideSize.h, baseSlideSize.w, presentationViewport.h, presentationViewport.w])

  const { tokens } = React.useMemo(() => lexMarkdown(markdownText || ''), [markdownText])

  const graphData = useGraphStore(s => s.graphData)
  const schema = useGraphStore(s => s.schema as GraphSchema | null)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)

  const [contextMenu, setContextMenu] = React.useState<{
    x: number
    y: number
    startLine: number
    endLine: number
  } | null>(null)

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null)
  }, [])

  React.useEffect(() => {
    if (!contextMenu) return
    const handler = () => {
      closeContextMenu()
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [contextMenu, closeContextMenu])

  type TokenHighlightSpec = {
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }

  const buildAlwaysOnTokenHighlights = React.useCallback(
    (sourceTokens: TokenWithLines[] | null): TokenHighlightSpec[] | null => {
      if (!alwaysOnHighlightMode) return null
      const data = graphData as GraphData | null
      if (!data) return null
      const trimmedPath = (activeDocumentPath || '').trim()
      if (!trimmedPath) return null
      if (!sourceTokens || sourceTokens.length === 0) return null
      const parseLine = (raw: unknown): number | null => {
        if (typeof raw === 'number') return Number.isFinite(raw) ? Math.floor(raw) : null
        if (typeof raw === 'string') {
          const parsed = Number.parseInt(raw, 10)
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      }
      type Range = { start: number; end: number; color: string }
      const nodeRanges: Range[] = []
      const edgeRanges: Range[] = []
      const nodes = data.nodes || []
      const edges = data.edges || []
      for (const n of nodes) {
        const meta = n.metadata as unknown
        const record =
          meta && typeof meta === 'object' && !Array.isArray(meta)
            ? (meta as Record<string, unknown>)
            : {}
        const docPath = getDocumentPathFromMetadata(record)
        if (!docPath || docPath.trim() !== trimmedPath) continue
        const start = parseLine(record.lineStart)
        const endRaw = parseLine(record.lineEnd)
        if (start == null) continue
        const end = endRaw != null ? endRaw : start
        const s = Math.max(1, Math.min(start, end))
        const e = Math.max(s, Math.max(start, end))
        const baseColor =
          schema && (n as GraphNode)
            ? getNodeBaseFill(n as GraphNode, schema)
            : ''
        const color = typeof baseColor === 'string' ? baseColor.trim() : ''
        if (!color) continue
        nodeRanges.push({ start: s, end: e, color })
      }
      for (const e of edges) {
        const meta = e.metadata as unknown
        const record =
          meta && typeof meta === 'object' && !Array.isArray(meta)
            ? (meta as Record<string, unknown>)
            : {}
        const docPath = getDocumentPathFromMetadata(record)
        if (!docPath || docPath.trim() !== trimmedPath) continue
        const start = parseLine(record.lineStart)
        const endRaw = parseLine(record.lineEnd)
        if (start == null) continue
        const end = endRaw != null ? endRaw : start
        const s = Math.max(1, Math.min(start, end))
        const e2 = Math.max(s, Math.max(start, end))
        const baseColor =
          schema && (e as GraphEdge)
            ? getEdgeBaseStroke(e as GraphEdge, schema)
            : ''
        const color = typeof baseColor === 'string' ? baseColor.trim() : ''
        if (!color) continue
        edgeRanges.push({ start: s, end: e2, color })
      }
      if (!nodeRanges.length && !edgeRanges.length) return null

      const toLayerRgbaWithAlpha = (color: string, alpha: number): string | null => {
        const raw = String(color || '').trim()
        if (!raw) return null
        if (raw.startsWith('#')) {
          if (raw.length === 4) {
            const r = raw[1]
            const g = raw[2]
            const b = raw[3]
            const rr = Number.parseInt(r + r, 16)
            const gg = Number.parseInt(g + g, 16)
            const bb = Number.parseInt(b + b, 16)
            if (Number.isFinite(rr) && Number.isFinite(gg) && Number.isFinite(bb)) {
              return `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, alpha))})`
            }
          }
          if (raw.length === 7) {
            const rr = Number.parseInt(raw.slice(1, 3), 16)
            const gg = Number.parseInt(raw.slice(3, 5), 16)
            const bb = Number.parseInt(raw.slice(5, 7), 16)
            if (Number.isFinite(rr) && Number.isFinite(gg) && Number.isFinite(bb)) {
              return `rgba(${rr}, ${gg}, ${bb}, ${Math.max(0, Math.min(1, alpha))})`
            }
          }
        }
        return raw
      }

      let layerBackground: string | null = null
      if (schema && schema.layers && schema.layers.mode === 'semantic') {
        const three = getThreeConfig(schema)
        const rawBg =
          typeof three.backgroundColor === 'string' ? three.backgroundColor.trim() : ''
        if (rawBg) {
          const rawAlpha = three.markdownAlwaysOnAlpha
          const alpha =
            typeof rawAlpha === 'number' && Number.isFinite(rawAlpha)
              ? Math.max(0, Math.min(1, rawAlpha))
              : 0.08
          const softened = toLayerRgbaWithAlpha(rawBg, alpha)
          layerBackground = softened || rawBg
        }
      }
      const specs: TokenHighlightSpec[] = sourceTokens.map(() => ({
        textColor: null,
        underlineColor: null,
        backgroundColor: null,
      }))
      for (let i = 0; i < sourceTokens.length; i += 1) {
        const t = sourceTokens[i]
        const tStart = t.startLine
        const tEnd = t.endLine || t.startLine
        let bestNodeColor: string | null = null
        let bestNodeOverlap = 0
        let bestNodeSpan = Number.POSITIVE_INFINITY
        for (const r of nodeRanges) {
          const overlapStart = Math.max(tStart, r.start)
          const overlapEnd = Math.min(tEnd, r.end)
          const overlap = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0
          if (overlap <= 0) continue
          const span = r.end - r.start + 1
          if (overlap > bestNodeOverlap || (overlap === bestNodeOverlap && span < bestNodeSpan)) {
            bestNodeOverlap = overlap
            bestNodeSpan = span
            bestNodeColor = r.color
          }
        }
        let bestEdgeColor: string | null = null
        let bestEdgeOverlap = 0
        let bestEdgeSpan = Number.POSITIVE_INFINITY
          for (const r of edgeRanges) {
          const overlapStart = Math.max(tStart, r.start)
          const overlapEnd = Math.min(tEnd, r.end)
          const overlap = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0
          if (overlap <= 0) continue
          const span = r.end - r.start + 1
          if (overlap > bestEdgeOverlap || (overlap === bestEdgeOverlap && span < bestEdgeSpan)) {
            bestEdgeOverlap = overlap
            bestEdgeSpan = span
            bestEdgeColor = r.color
          }
        }
        specs[i] = {
          textColor: bestNodeColor,
          underlineColor: bestEdgeColor,
          backgroundColor: bestNodeColor || bestEdgeColor ? layerBackground : null,
        }
      }
      return specs
    },
    [activeDocumentPath, alwaysOnHighlightMode, graphData, schema],
  )

  const alwaysOnTokenHighlights = React.useMemo(
    () => buildAlwaysOnTokenHighlights(tokens),
    [buildAlwaysOnTokenHighlights, tokens],
  )

  const findSelectionTarget = React.useCallback(
    (data: GraphData | null, documentPath: string, startLine: number, endLine: number) => {
      if (!data) return null
      const trimmedPath = documentPath.trim()
      if (!trimmedPath) return null
      const safeStart = Math.max(1, Math.min(startLine, endLine))
      const safeEnd = Math.max(safeStart, Math.max(startLine, endLine))
      let bestKind: 'node' | 'edge' | null = null
      let bestId: string | null = null
      let bestOverlap = 0
      let bestSpan = Number.POSITIVE_INFINITY
      const consider = (kind: 'node' | 'edge', id: string, meta: unknown) => {
        const record = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}
        const docPath = getDocumentPathFromMetadata(record)
        if (!docPath || docPath.trim() !== trimmedPath) return
        const rawStart = record.lineStart
        const rawEnd = record.lineEnd
        const start =
          typeof rawStart === 'number'
            ? (Number.isFinite(rawStart) ? Math.floor(rawStart) : null)
            : typeof rawStart === 'string'
            ? (() => {
                const parsed = Number.parseInt(rawStart, 10)
                return Number.isFinite(parsed) ? parsed : null
              })()
            : null
        const endRaw =
          typeof rawEnd === 'number'
            ? (Number.isFinite(rawEnd) ? Math.floor(rawEnd) : null)
            : typeof rawEnd === 'string'
            ? (() => {
                const parsed = Number.parseInt(rawEnd, 10)
                return Number.isFinite(parsed) ? parsed : null
              })()
            : null
        if (start == null) return
        const end = endRaw != null ? endRaw : start
        const candStart = Math.max(1, Math.min(start, end))
        const candEnd = Math.max(candStart, Math.max(start, end))
        const overlapStart = Math.max(safeStart, candStart)
        const overlapEnd = Math.min(safeEnd, candEnd)
        const overlap = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0
        if (overlap <= 0) return
        const span = candEnd - candStart + 1
        if (overlap > bestOverlap || (overlap === bestOverlap && span < bestSpan)) {
          bestOverlap = overlap
          bestSpan = span
          bestKind = kind
          bestId = id
        }
      }
      const nodes = data.nodes || []
      const edges = data.edges || []
      for (const n of nodes) {
        consider('node', String(n.id || ''), n.metadata)
      }
      for (const e of edges) {
        consider('edge', String(e.id || ''), e.metadata)
      }
      if (!bestKind || !bestId) return null
      return { kind: bestKind, id: bestId }
    },
    [],
  )

  const handleShowOnCanvas = React.useCallback(
    (startLine: number, endLine: number) => {
      const target = findSelectionTarget(graphData as GraphData | null, activeDocumentPath, startLine, endLine)
      if (!target) return
      setSelectionSource('editor')
      if (target.kind === 'node') {
        selectNode(target.id)
      } else {
        selectEdge(target.id)
      }
    },
    [activeDocumentPath, findSelectionTarget, graphData, selectEdge, selectNode, setSelectionSource],
  )

  const handleCmdClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!e.metaKey) return
      if (!rootElRef.current) return
      const targetEl = e.target as HTMLElement | null
      if (!targetEl) return
      let el: HTMLElement | null = targetEl
      let startLine: number | null = null
      let endLine: number | null = null
      const root = rootElRef.current
      while (el && el !== root) {
        const ds = el.dataset
        if (ds && ds.startLine) {
          const s = Number.parseInt(ds.startLine, 10)
          const eLine = ds.endLine ? Number.parseInt(ds.endLine, 10) : s
          if (Number.isFinite(s) && Number.isFinite(eLine)) {
            startLine = s
            endLine = eLine
            break
          }
        }
        el = el.parentElement
      }
      if (startLine == null || endLine == null) return
      e.preventDefault()
      e.stopPropagation()
      handleShowOnCanvas(startLine, endLine)
    },
    [handleShowOnCanvas],
  )

  const flashActive = !!flashSelectionId && !!selectionId && flashSelectionId === selectionId
  const flashBg = flashActive ? 'rgba(249,115,22,0.28)' : null
  const flashUnderline = flashActive ? '#fbbf24' : null
  const effectiveHighlightBackgroundColor = flashBg || highlightBackgroundColor || null
  const effectiveHighlightUnderlineColor = flashUnderline || highlightUnderlineColor || null

  const body = React.useMemo(
    () =>
      (
        <MarkdownTokenRenderer
          tokens={tokens}
          activeDocumentPath={activeDocumentPath}
          highlightedLineRange={highlightedLineRange}
          markdownWordWrap={markdownWordWrap}
          markdownPresentationMode={markdownPresentationMode}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
          mermaidFrontmatterConfig={mermaidFrontmatterConfig}
          rootThemeMode={rootThemeMode}
          previewOverlayScope={previewOverlayScope}
          previewOverlayPortalTarget={previewOverlayPortalTarget}
          alwaysOnHighlightMode={alwaysOnHighlightMode}
          alwaysOnTokenHighlights={alwaysOnTokenHighlights}
          markdownTextHighlight={markdownTextHighlight}
          selectionKind={selectionKind || null}
          highlightBackgroundColor={effectiveHighlightBackgroundColor}
          highlightUnderlineColor={effectiveHighlightUnderlineColor}
        />
      ),
    [
      activeDocumentPath,
      highlightedLineRange,
      markdownPresentationMode,
      markdownWordWrap,
      mermaidFrontmatterConfig,
      previewOverlayScope,
      previewOverlayPortalTarget,
      rootThemeMode,
      tokens,
      uiPanelMonospaceTextClass,
      uiPanelTextFontClass,
      alwaysOnHighlightMode,
      alwaysOnTokenHighlights,
      markdownTextHighlight,
      selectionKind,
      effectiveHighlightBackgroundColor,
      effectiveHighlightUnderlineColor,
    ],
  )

  const slideTokens = React.useMemo(() => {
    if (!markdownPresentationMode) return null
    const slide = activeSlide
    const out = lexMarkdownContent(slide.text || '', Math.max(0, (slide.startLine || 1) - 1))
    return out.tokens
  }, [activeSlide, markdownPresentationMode])

  const slideBody = React.useMemo(() => {
    if (!markdownPresentationMode) return null
    if (!slideTokens) return null
    const slide = activeSlide
    const slideMermaidConfig = parseMermaidConfigFromFrontmatter(slide.meta || {})
    return (
      <MarkdownTokenRenderer
        tokens={slideTokens}
        activeDocumentPath={activeDocumentPath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={true}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        mermaidFrontmatterConfig={slideMermaidConfig || mermaidFrontmatterConfig}
        rootThemeMode={rootThemeMode}
        previewOverlayScope={previewOverlayScope}
        previewOverlayPortalTarget={previewOverlayPortalTarget}
        alwaysOnHighlightMode={alwaysOnHighlightMode}
        alwaysOnTokenHighlights={buildAlwaysOnTokenHighlights(slideTokens)}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={selectionKind || null}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
      />
    )
  }, [
    activeDocumentPath,
    activeSlide,
    highlightedLineRange,
    markdownWordWrap,
    mermaidFrontmatterConfig,
    previewOverlayScope,
    previewOverlayPortalTarget,
    rootThemeMode,
    slideTokens,
    uiPanelMonospaceTextClass,
    uiPanelTextFontClass,
    markdownPresentationMode,
    markdownTextHighlight,
    selectionKind,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    alwaysOnHighlightMode,
    buildAlwaysOnTokenHighlights,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const el = rootElRef.current
    if (!el) return
    el.focus?.()
  }, [markdownPresentationMode])

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveSlideIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveSlideIndex(Math.max(0, slides.length - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev, markdownPresentationMode, slides.length])

  const scrollClass = previewScrollable ? 'overflow-auto' : 'overflow-hidden'

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootElRef.current) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.isCollapsed) return
    let el = e.target as HTMLElement | null
    let startLine: number | null = null
    let endLine: number | null = null
    const root = rootElRef.current
    while (el && el !== root) {
      const ds = (el as HTMLElement).dataset
      if (ds && ds.startLine) {
        const s = Number.parseInt(ds.startLine, 10)
        const eLine = ds.endLine ? Number.parseInt(ds.endLine, 10) : s
        if (Number.isFinite(s) && Number.isFinite(eLine)) {
          startLine = s
          endLine = eLine
          break
        }
      }
      el = el.parentElement
    }
    if (startLine == null || endLine == null) return
    e.preventDefault()
    const rect = root.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setContextMenu({
      x,
      y,
      startLine,
      endLine,
    })
  }

  if (markdownPresentationMode) {
    const slideClass = String(activeSlide?.meta?.class || '').trim()
    const layout = String(activeSlide?.meta?.layout || '').trim()
    const background = String(activeSlide?.meta?.background || '').trim()
    const slideStyle: React.CSSProperties = background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}
    const slideOuterClass =
      layout === 'center'
        ? 'w-full h-full flex items-center justify-center'
        : 'w-full h-full flex'
    const slideContentClass =
      layout === 'center'
        ? 'max-w-4xl max-h-full px-12 py-10 overflow-auto mx-auto flex items-center justify-center'
        : 'w-full h-full px-12 py-10 overflow-auto'
    const slideContent = slideBody
    return (
      <>
        <div
          ref={setRootRef}
          tabIndex={0}
          onContextMenu={handleContextMenu}
          onClick={handleCmdClick}
          className={[
            'relative flex-1 min-h-0 w-full overflow-hidden bg-gray-100 outline-none flex flex-col',
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div
              className="flex items-center justify-center"
              style={{
                width: `${Math.max(1, baseSlideSize.w * slideScale)}px`,
                height: `${Math.max(1, baseSlideSize.h * slideScale)}px`,
              }}
            >
              <div
                className="origin-top-left"
                style={{
                  width: `${baseSlideSize.w}px`,
                  height: `${baseSlideSize.h}px`,
                  transform: `scale(${slideScale})`,
                }}
              >
                <div
                  className={[
                    'w-full h-full rounded border border-gray-200 shadow bg-white overflow-hidden',
                    slideClass,
                  ].filter(Boolean).join(' ')}
                  style={slideStyle}
                  onDoubleClick={() => setIsSlidesFullscreenOpen(true)}
                >
                  <div className={slideOuterClass}>
                    <div className={slideContentClass}>
                      {slideContent}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {contextMenu && (
            <div
              className="absolute z-10 bg-white border border-gray-200 rounded shadow-md text-xs text-gray-700"
              style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            >
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-gray-100"
                onClick={() => {
                  handleShowOnCanvas(contextMenu.startLine, contextMenu.endLine)
                  closeContextMenu()
                }}
              >
                Show on Canvas
              </button>
            </div>
          )}
        </div>
        <PreviewOverlay
          open={isSlidesFullscreenOpen}
          onClose={() => setIsSlidesFullscreenOpen(false)}
          scope={previewOverlayScope}
          portalTarget={previewOverlayPortalTarget}
        >
          <div className="w-full h-full flex">
            <div className="w-60 shrink-0 border-r border-gray-200 bg-white overflow-auto">
              <PreviewGallery
                items={orderedSlideIndices.map((slideIdx, i) => ({ id: String(slideIdx), label: `Slide ${i + 1}` }))}
                activeId={String(activeSlideId)}
                onSelect={(id) => {
                  const idx = Number.parseInt(id, 10)
                  if (!Number.isFinite(idx)) return
                  const pos = orderedSlideIndices.indexOf(idx)
                  if (pos < 0) return
                  setActiveSlideIndex(pos)
                }}
                onReorder={(nextIds) => {
                  const next = nextIds.map(x => Number.parseInt(x, 10)).filter(n => Number.isFinite(n))
                  const normalized = normalizeSlideOrder(next, slides.length)
                  setSlideOrder(normalized)
                  const nextPos = normalized.indexOf(activeSlideId)
                  if (nextPos >= 0) setActiveSlideIndex(nextPos)
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ZoomPanViewport
                open={isSlidesFullscreenOpen}
                storageKey={LS_KEYS.previewZoomPanSlides}
                getContentSize={() => ({ w: baseSlideSize.w, h: baseSlideSize.h })}
                fitOnOpen
              >
                <div style={{ width: `${baseSlideSize.w}px`, height: `${baseSlideSize.h}px` }}>
                  <div
                    className={[
                      'w-full h-full rounded border border-gray-200 shadow bg-white overflow-hidden',
                      slideClass,
                    ].filter(Boolean).join(' ')}
                    style={slideStyle}
                >
                  <div className={slideOuterClass}>
                      <div className={slideContentClass}>
                        {slideContent}
                      </div>
                    </div>
                  </div>
                </div>
              </ZoomPanViewport>
            </div>
          </div>
        </PreviewOverlay>
      </>
    )
  }

  return (
    <div
      ref={setRootRef}
      onScroll={onScroll}
      onContextMenu={handleContextMenu}
      onClick={handleCmdClick}
      className={[
        'relative flex-1 min-h-0 px-2 py-2',
        scrollClass,
        uiPanelTextFontClass,
      ].join(' ')}
      data-testid="markdown-preview-root"
    >
      <div>{body}</div>
      {contextMenu && (
        <div
          className="absolute z-10 bg-white border border-gray-200 rounded shadow-md text-xs text-gray-700"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          <button
            type="button"
            className="block w-full px-3 py-1 text-left hover:bg-gray-100"
            onClick={() => {
              handleShowOnCanvas(contextMenu.startLine, contextMenu.endLine)
              closeContextMenu()
            }}
          >
            Show on Canvas
          </button>
        </div>
      )}
    </div>
  )
})

export default MarkdownPreview
