import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import {
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import { useMarkdownPresentation } from './useMarkdownPresentation'
import type { GraphSchema } from '@/lib/graph/schema'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import { MarkdownPreviewPresentation } from '@/features/markdown/ui/MarkdownPreviewPresentation'
import { MarkdownSelectionToolbar, type MarkdownSelectionToolbarState } from '@/features/markdown/ui/MarkdownSelectionToolbar'
import {
  ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET,
  buildAlwaysOnTokenHighlights as computeAlwaysOnTokenHighlights,
  type TokenHighlightSpec,
} from '@/features/markdown/ui/markdownPreviewAlwaysOnHighlights'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'
import { useMarkdownPreviewTokens } from '@/features/markdown/ui/useMarkdownPreviewTokens'
import { useSelectionFlash } from '@/features/markdown/ui/useSelectionFlash'
import { useMarkdownPreviewEvents } from '@/features/markdown/ui/useMarkdownPreviewEvents'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

export { ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET }

export type MarkdownPreviewPresentationApi = {
  prev: () => void
  next: () => void
  enterFullscreen?: () => void
}

export type MarkdownPreviewPresentationSlideState = {
  activeSlideIndex: number
  slideCount: number
  activeSlideLine: number
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
  onSlidesReordered?: (nextOrder: number[]) => void
  onPreviewClick?: (line: number) => void
  tokens?: TokenWithLines[]
  showSidebar?: boolean
  onToggleSidebar?: (show: boolean) => void
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  frontmatterMermaidCode?: string
  onShowInViewer?: (line: number) => void
  onShowInEditor?: (line: number) => void
  onShowInPresentation?: (line: number) => void
  onShowInSlidesGallery?: (line: number) => void
  onShowInGraphDataTable?: (line: number) => void
  annotateDisplayMode?: 'inline' | 'beside'
  flashLine?: number | null
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
    onSlidesReordered,
    onPreviewClick,
    tokens: providedTokens,
    showSidebar,
    onToggleSidebar,
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
    frontmatterMermaidCode: frontmatterMermaidCodeProp,
    onShowInViewer,
    onShowInEditor,
    onShowInPresentation,
    onShowInSlidesGallery,
    onShowInGraphDataTable,
    annotateDisplayMode,
    flashLine,
  },
  ref,
) {
  const { flashSelectionId, flashAlpha } = useSelectionFlash(selectionId)
  const rootThemeMode = useRootThemeMode()

  const rootElRef = React.useRef<HTMLDivElement | null>(null)
  const setRootRef = React.useCallback((el: HTMLDivElement | null) => {
    rootElRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [ref])

  const { headMeta, slides } = React.useMemo(() => splitSlides(markdownText || ''), [markdownText])

  const codeAnnotations = React.useMemo(() => {
    const meta = headMeta as Record<string, unknown>
    const raw = (meta.codeAnnotations || meta.code_annotations) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const source = raw as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(source)) {
      const key = String(k || '').trim()
      if (!key) continue
      let val: string | null = null
      if (typeof v === 'string') {
        val = v
      } else if (v != null) {
        try {
          val = JSON.stringify(v)
        } catch {
          val = String(v)
        }
      }
      if (val && val.trim()) {
        out[key] = val
      }
    }
    return Object.keys(out).length ? out : null
  }, [headMeta])

  const mermaidFrontmatterConfig = React.useMemo(
    () => parseMermaidConfigFromFrontmatter(headMeta),
    [headMeta],
  )
  const computedFrontmatterMermaidCode = React.useMemo(() => {
    const meta = headMeta as Record<string, unknown>
    const raw = String(meta.mermaid || '').trim()
    return raw
  }, [headMeta])

  const frontmatterMermaidCode = frontmatterMermaidCodeProp ?? computedFrontmatterMermaidCode
  const hasFrontmatterMermaid = !!frontmatterMermaidCode

  const {
    setActiveSlideIndex,
    slideOrder,
    setSlideOrder,
    orderedSlideIndices,
    activeSlideId,
    activeFragmentConfig,
    activeFragmentStep,
    goPrev,
    goNext,
    handleRegisterFullscreenHandler,
  } = useMarkdownPresentation({
    slides,
    headMeta: headMeta as Record<string, unknown>,
    markdownPresentationMode,
    highlightedLineRange,
    presentationApiRef,
    onPresentationSlideStateChange,
    onSlidesReordered,
  })

  const tokens = useMarkdownPreviewTokens(markdownText || '', providedTokens, activeDocumentPath)

  const graphData = useGraphStore(s => s.graphData)
  const markdownAlwaysOnHighlightComplexityBudget = useGraphStore(
    s => s.markdownAlwaysOnHighlightComplexityBudget ?? null,
  )
  const schema = useGraphStore(s => s.schema as GraphSchema | null)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)

  const [selectionToolbar, setSelectionToolbar] = React.useState<MarkdownSelectionToolbarState | null>(null)

  const closeSelectionToolbar = React.useCallback(() => {
    setSelectionToolbar(null)
  }, [])

  React.useEffect(() => {
    if (!selectionToolbar) return
    const handler = () => {
      closeSelectionToolbar()
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [selectionToolbar, closeSelectionToolbar])

  const buildAlwaysOnTokenHighlights = React.useCallback(
    (sourceTokens: TokenWithLines[] | null): TokenHighlightSpec[] | null =>
      computeAlwaysOnTokenHighlights({
        tokens: sourceTokens,
        alwaysOnHighlightMode,
        activeDocumentPath,
        graphData: graphData as GraphData | null,
        schema,
        markdownAlwaysOnHighlightComplexityBudget,
      }),
    [
      activeDocumentPath,
      alwaysOnHighlightMode,
      graphData,
      markdownAlwaysOnHighlightComplexityBudget,
      schema,
    ],
  )

  const alwaysOnTokenHighlights = React.useMemo(
    () => buildAlwaysOnTokenHighlights(tokens),
    [buildAlwaysOnTokenHighlights, tokens],
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
    [activeDocumentPath, graphData, selectEdge, selectNode, setSelectionSource],
  )

  const { handleClick, handleContextMenu, handleDoubleClick, handleMouseUp } = useMarkdownPreviewEvents({
    rootElRef,
    onShowInEditor,
    onPreviewClick,
    handleShowOnCanvas,
    setSelectionToolbar,
  })

  const handleSlideContextMenu = React.useCallback((slideIdx: number, e: React.MouseEvent) => {
    const slide = slides[slideIdx]
    if (!slide) return
    e.preventDefault()
    e.stopPropagation()
    setSelectionToolbar({
      x: e.clientX,
      y: e.clientY,
      startLine: slide.startLine,
      endLine: slide.endLine,
      text: ''
    })
  }, [slides])

  const flashActive = !!flashSelectionId && !!selectionId && flashSelectionId === selectionId
  const flashBg = flashActive ? `rgba(249,115,22,${flashAlpha})` : null
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
  }, [goNext, goPrev, markdownPresentationMode, slides.length, setActiveSlideIndex])

  const scrollClass = previewScrollable ? 'overflow-auto' : 'overflow-hidden'

  const selectionToolbarNode = (
    <MarkdownSelectionToolbar
      toolbar={selectionToolbar}
      onClose={closeSelectionToolbar}
      onShowOnCanvas={handleShowOnCanvas}
      onShowInViewer={onShowInViewer || (() => {})}
      onShowInEditor={onShowInEditor || (() => {})}
      onShowInPresentation={onShowInPresentation || (() => {})}
      onShowInSlidesGallery={onShowInSlidesGallery || (() => {})}
      onShowInGraphDataTable={onShowInGraphDataTable || (() => {})}
      currentView={markdownPresentationMode ? 'presentation' : 'viewer'}
    />
  )

  if (markdownPresentationMode) {
    return (
      <>
        <MarkdownPreviewPresentation
          rootRef={setRootRef}
          onClick={handleClick}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          onRegisterFullscreenHandler={handleRegisterFullscreenHandler}
          headMeta={headMeta as Record<string, unknown>}
          slides={slides as never}
          activeSlideId={activeSlideId}
          orderedSlideIndices={orderedSlideIndices}
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
          onPreviewClick={onPreviewClick}
          onShowInEditor={onShowInEditor}
          selectionToolbar={selectionToolbarNode}
          onSlideContextMenu={handleSlideContextMenu}
        />
      </>
    )
  }

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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleMouseUp}
      selectionToolbar={selectionToolbarNode}
      showSidebar={showSidebar}
      onToggleSidebar={onToggleSidebar}
      collapsedIds={collapsedIds}
      onToggleCollapse={onToggleCollapse}
      onExpandAll={onExpandAll}
      onCollapseAll={onCollapseAll}
      onTocSelect={onTocSelect}
      onTocDoubleClick={onTocDoubleClick}
      onTocReorder={onTocReorder}
      frontmatterMermaidCode={frontmatterMermaidCode}
      codeAnnotations={codeAnnotations}
      annotateDisplayMode={annotateDisplayMode}
      flashLine={flashLine}
    />
  )
})

export default MarkdownPreview
