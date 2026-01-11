import React from 'react'
import { lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import {
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import {
  type MarkdownFragmentConfig,
  DEFAULT_FRAGMENT_CONFIG,
  buildSlideFragmentConfig,
  normalizeSlideOrder,
} from './markdownPreviewFragments'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import {
  getDocumentLocationFromMetadata,
  getEdgeBaseColor,
  getNodeBaseColor,
  normalizeLineRange,
} from '@/lib/graph/markdownMetadata'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import { MarkdownPreviewPresentation } from '@/features/markdown/ui/MarkdownPreviewPresentation'
import { MarkdownPreviewContextMenu } from '@/features/markdown/ui/MarkdownPreviewContextMenu'
import { computeMarkdownPreviewMenuPosition } from '@/features/markdown/ui/markdownPreviewContextMenuUtils'

const COPY_SHOW_ON_CANVAS = 'Show on Canvas'

export const ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET = 500000

export type MarkdownPreviewPresentationApi = {
  prev: () => void
  next: () => void
  enterFullscreen?: () => void
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

const findLineRangeFromTarget = (
  root: HTMLDivElement | null,
  target: EventTarget | null,
): { startLine: number; endLine: number } | null => {
  if (!root) return null
  const element = target as HTMLElement | null
  if (!element) return null
  let el: HTMLElement | null = element
  let startLine: number | null = null
  let endLine: number | null = null
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
  if (startLine == null || endLine == null) return null
  return { startLine, endLine }
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
  const setMarkdownPreviewMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
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
  const mermaidFrontmatterConfig = React.useMemo(
    () => parseMermaidConfigFromFrontmatter(headMeta),
    [headMeta],
  )
  const frontmatterMermaidCode = React.useMemo(() => {
    const meta = headMeta as Record<string, unknown>
    const raw = String(meta.mermaid || '').trim()
    return raw
  }, [headMeta])
  const hasFrontmatterMermaid = !!frontmatterMermaidCode

  const [activeSlideIndex, setActiveSlideIndex] = React.useState(0)
  const [slideOrder, setSlideOrder] = React.useState<number[]>([])

  const orderedSlideIndices = React.useMemo(
    () => normalizeSlideOrder(slideOrder, slides.length),
    [slideOrder, slides.length],
  )

  const activeSlideId =
    orderedSlideIndices[
      Math.min(Math.max(0, activeSlideIndex), Math.max(0, orderedSlideIndices.length - 1))
    ] ?? 0

  const slideFragmentConfigs = React.useMemo(() => {
    const headMetaRecord = headMeta as Record<string, unknown>
    if (!slides.length) return [] as MarkdownFragmentConfig[]
    return slides.map(slide =>
      buildSlideFragmentConfig(headMetaRecord, (slide.meta || {}) as Record<string, unknown>),
    )
  }, [headMeta, slides])

  const [activeFragmentStep, setActiveFragmentStep] = React.useState(0)
  const [fullscreenHandler, setFullscreenHandler] = React.useState<(() => void) | null>(null)

  React.useEffect(() => {
    if (!markdownPresentationMode) return
    setSlideOrder(prev => normalizeSlideOrder(prev, slides.length))
  }, [markdownPresentationMode, slides.length])

  React.useEffect(() => {
    const maxIdx = Math.max(0, orderedSlideIndices.length - 1)
    setActiveSlideIndex(i => Math.min(Math.max(0, i), maxIdx))
  }, [orderedSlideIndices.length])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      setActiveFragmentStep(0)
      return
    }
    setActiveFragmentStep(0)
  }, [markdownPresentationMode, activeSlideId])

  const activeFragmentConfig =
    slideFragmentConfigs[activeSlideId] || DEFAULT_FRAGMENT_CONFIG

  const handleRegisterFullscreenHandler = React.useCallback((fn: (() => void) | null) => {
    setFullscreenHandler(() => (fn ? () => fn() : null))
  }, [])

  const goPrev = React.useCallback(() => {
    const cfg = activeFragmentConfig
    if (cfg.enabled && activeFragmentStep > 0) {
      setActiveFragmentStep(step => (step > 0 ? step - 1 : 0))
      return
    }
    const maxOrderedIndex = Math.max(0, orderedSlideIndices.length - 1)
    const currentOrderedIndex = Math.min(Math.max(0, activeSlideIndex), maxOrderedIndex)
    const prevOrderedIndex = Math.max(0, currentOrderedIndex - 1)
    const prevSlideId = orderedSlideIndices[prevOrderedIndex] ?? 0
    const prevCfg = slideFragmentConfigs[prevSlideId] || DEFAULT_FRAGMENT_CONFIG
    setActiveSlideIndex(prevOrderedIndex)
    if (prevCfg.enabled && prevCfg.steps > 0) {
      setActiveFragmentStep(prevCfg.steps)
    } else {
      setActiveFragmentStep(0)
    }
  }, [
    activeFragmentConfig,
    activeFragmentStep,
    activeSlideIndex,
    orderedSlideIndices,
    slideFragmentConfigs,
  ])

  const goNext = React.useCallback(() => {
    const cfg = activeFragmentConfig
    if (cfg.enabled && cfg.steps > 0 && activeFragmentStep < cfg.steps) {
      setActiveFragmentStep(step => {
        const next = step + 1
        return next > cfg.steps ? cfg.steps : next
      })
      return
    }
    const maxOrderedIndex = Math.max(0, orderedSlideIndices.length - 1)
    const currentOrderedIndex = Math.min(Math.max(0, activeSlideIndex), maxOrderedIndex)
    if (currentOrderedIndex >= maxOrderedIndex) return
    const nextOrderedIndex = Math.min(maxOrderedIndex, currentOrderedIndex + 1)
    setActiveSlideIndex(nextOrderedIndex)
    setActiveFragmentStep(0)
  }, [
    activeFragmentConfig,
    activeFragmentStep,
    activeSlideIndex,
    orderedSlideIndices,
  ])

  React.useEffect(() => {
    if (!markdownPresentationMode) {
      if (presentationApiRef) presentationApiRef.current = null
      return
    }
    if (presentationApiRef) {
      presentationApiRef.current = {
        prev: goPrev,
        next: goNext,
        enterFullscreen: () => {
          if (fullscreenHandler) {
            fullscreenHandler()
          }
        },
      }
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
    fullscreenHandler,
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

  const { tokens } = React.useMemo(() => lexMarkdown(markdownText || ''), [markdownText])

  const graphData = useGraphStore(s => s.graphData)
  const markdownAlwaysOnHighlightComplexityBudget = useGraphStore(
    s => s.markdownAlwaysOnHighlightComplexityBudget ?? null,
  )
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
      const tokenCount = sourceTokens ? sourceTokens.length : 0
      if (!tokenCount) return null
      const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0
      const edgeCount = Array.isArray(data.edges) ? data.edges.length : 0
      const totalEntities = nodeCount + edgeCount
      if (!totalEntities) return null
      const complexityBudget =
        typeof markdownAlwaysOnHighlightComplexityBudget === 'number'
          ? markdownAlwaysOnHighlightComplexityBudget
          : ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET
      if (tokenCount * totalEntities > complexityBudget) return null
      const trimmedPath = (activeDocumentPath || '').trim()
      if (!trimmedPath) return null
      type Range = { start: number; end: number; color: string }
      const nodeRanges: Range[] = []
      const edgeRanges: Range[] = []
      const nodes = data.nodes || []
      const edges = data.edges || []
      for (const n of nodes) {
        const location = getDocumentLocationFromMetadata(n.metadata as unknown)
        if (!location) continue
        const docPath = (location.documentPath || '').trim()
        if (!docPath || docPath !== trimmedPath) continue
        const start = location.lineStart
        const end = location.lineEnd
        const color = getNodeBaseColor(n as GraphNode, schema)
        if (!color) continue
        nodeRanges.push({ start, end, color })
      }
      for (const e of edges) {
        const location = getDocumentLocationFromMetadata(e.metadata as unknown)
        if (!location) continue
        const docPath = (location.documentPath || '').trim()
        if (!docPath || docPath !== trimmedPath) continue
        const start = location.lineStart
        const end = location.lineEnd
        const color = getEdgeBaseColor(e as GraphEdge, schema)
        if (!color) continue
        edgeRanges.push({ start, end, color })
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
    [activeDocumentPath, alwaysOnHighlightMode, graphData, markdownAlwaysOnHighlightComplexityBudget, schema],
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
      const safeRange = normalizeLineRange(startLine, endLine)
      let bestKind: 'node' | 'edge' | null = null
      let bestId: string | null = null
      let bestOverlap = 0
      let bestSpan = Number.POSITIVE_INFINITY
      const consider = (kind: 'node' | 'edge', id: string, meta: unknown) => {
        const location = getDocumentLocationFromMetadata(meta)
        if (!location) return
        const docPath = (location.documentPath || '').trim()
        if (!docPath || docPath !== trimmedPath) return
        const candStart = location.lineStart
        const candEnd = location.lineEnd
        const overlapStart = Math.max(safeRange.start, candStart)
        const overlapEnd = Math.min(safeRange.end, candEnd)
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
      const range = findLineRangeFromTarget(rootElRef.current, e.target)
      if (!range) return
      e.preventDefault()
      e.stopPropagation()
      handleShowOnCanvas(range.startLine, range.endLine)
    },
    [handleShowOnCanvas],
  )

  const flashActive = !!flashSelectionId && !!selectionId && flashSelectionId === selectionId
  const flashBg = flashActive ? 'rgba(249,115,22,0.28)' : null
  const flashUnderline = flashActive ? '#fbbf24' : null
  const effectiveHighlightBackgroundColor = flashBg || highlightBackgroundColor || null
  const effectiveHighlightUnderlineColor = flashUnderline || highlightUnderlineColor || null


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

  const handleClickFrontmatterMermaidHint = React.useCallback(() => {
    if (!frontmatterMermaidCode) return
    try {
      setMarkdownPreviewActiveMediaKey(null)
    } catch {
      void 0
    }
    try {
      setMarkdownPreviewMermaidFocus({
        code: frontmatterMermaidCode,
        frontmatterConfig: (mermaidFrontmatterConfig as unknown as Record<string, unknown> | null) || null,
      })
    } catch {
      void 0
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
        )
      }
    } catch {
      void 0
    }
  }, [
    frontmatterMermaidCode,
    mermaidFrontmatterConfig,
    setMarkdownPreviewActiveMediaKey,
    setMarkdownPreviewMermaidFocus,
  ])

  const scrollClass = previewScrollable ? 'overflow-auto' : 'overflow-hidden'

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootElRef.current) return
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.isCollapsed) return
    const range = findLineRangeFromTarget(rootElRef.current, e.target)
    if (!range) return
    e.preventDefault()
    const rootEl = rootElRef.current
    const rect = rootEl.getBoundingClientRect()
    const targetBlock = rootEl.querySelector(
      `[data-start-line="${range.startLine}"]`,
    ) as HTMLElement | null
    const selectionBlockRect = targetBlock ? targetBlock.getBoundingClientRect() : null
    const pos = computeMarkdownPreviewMenuPosition({
      containerRect: rect,
      clientX: e.clientX,
      clientY: e.clientY,
      clampToContainer: true,
      selectionBlockRect,
      biasToSelectionBlock: true,
    })
    setContextMenu({
      x: pos.x,
      y: pos.y,
      startLine: range.startLine,
      endLine: range.endLine,
    })
  }

  if (markdownPresentationMode) {
    return (
      <>
        <div
          onContextMenu={handleContextMenu}
          onClick={handleCmdClick}
        >
          <MarkdownPreviewPresentation
            rootRef={setRootRef}
            onRegisterFullscreenHandler={handleRegisterFullscreenHandler}
            headMeta={headMeta as Record<string, unknown>}
            slides={slides as never}
            activeSlideId={activeSlideId}
            orderedSlideIndices={orderedSlideIndices}
            activeSlideIndex={activeSlideIndex}
            setActiveSlideIndex={setActiveSlideIndex}
            slideOrder={slideOrder}
            setSlideOrder={setSlideOrder}
            activeFragmentConfig={activeFragmentConfig}
            activeFragmentStep={activeFragmentStep}
            markdownWordWrap={markdownWordWrap}
            markdownTextHighlight={markdownTextHighlight}
            selectionKind={selectionKind || null}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            previewOverlayScope={previewOverlayScope}
            previewOverlayPortalTarget={previewOverlayPortalTarget || null}
            alwaysOnHighlightMode={alwaysOnHighlightMode}
            buildAlwaysOnTokenHighlights={buildAlwaysOnTokenHighlights}
            highlightedLineRange={highlightedLineRange}
            activeDocumentPath={activeDocumentPath}
            mermaidFrontmatterConfig={mermaidFrontmatterConfig as Record<string, unknown> | null}
            rootThemeMode={rootThemeMode}
            effectiveHighlightBackgroundColor={effectiveHighlightBackgroundColor}
            effectiveHighlightUnderlineColor={effectiveHighlightUnderlineColor}
          />
        </div>
        <MarkdownPreviewContextMenu
          contextMenu={contextMenu}
          label={COPY_SHOW_ON_CANVAS}
          onClickShowOnCanvas={handleShowOnCanvas}
          onClose={closeContextMenu}
        />
      </>
    )
  }

  const contextMenuNode = (
    <MarkdownPreviewContextMenu
      contextMenu={contextMenu}
      label={COPY_SHOW_ON_CANVAS}
      onClickShowOnCanvas={handleShowOnCanvas}
      onClose={closeContextMenu}
    />
  )

  return (
    <MarkdownPreviewViewer
      rootRef={setRootRef}
      tokens={tokens}
      activeDocumentPath={activeDocumentPath}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={selectionKind || null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      mermaidFrontmatterConfig={mermaidFrontmatterConfig as Record<string, unknown> | null}
      rootThemeMode={rootThemeMode}
      previewOverlayScope={previewOverlayScope}
      previewOverlayPortalTarget={previewOverlayPortalTarget || null}
      alwaysOnHighlightMode={alwaysOnHighlightMode}
      alwaysOnTokenHighlights={alwaysOnTokenHighlights}
      effectiveHighlightBackgroundColor={effectiveHighlightBackgroundColor}
      effectiveHighlightUnderlineColor={effectiveHighlightUnderlineColor}
      scrollClass={scrollClass}
      hasFrontmatterMermaid={hasFrontmatterMermaid}
      onScroll={onScroll}
      onContextMenu={handleContextMenu}
      onClick={handleCmdClick}
      onClickFrontmatterHint={handleClickFrontmatterMermaidHint}
      contextMenu={contextMenuNode}
    />
  )
})

export default MarkdownPreview
