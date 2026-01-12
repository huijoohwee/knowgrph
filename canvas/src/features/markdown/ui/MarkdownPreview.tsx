import React from 'react'
import { lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import {
  parseMermaidConfigFromFrontmatter,
  useRootThemeMode,
} from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { UI_COPY } from '@/lib/config'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import { useMarkdownPresentation } from './useMarkdownPresentation'
import type { GraphSchema } from '@/lib/graph/schema'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import { MarkdownPreviewPresentation } from '@/features/markdown/ui/MarkdownPreviewPresentation'
import { MarkdownPreviewContextMenu } from '@/features/markdown/ui/MarkdownPreviewContextMenu'
import {
  computeMarkdownPreviewMenuPosition,
  findLineRangeFromTarget,
} from '@/features/markdown/ui/markdownPreviewContextMenuUtils'
import {
  ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET,
  buildAlwaysOnTokenHighlights as computeAlwaysOnTokenHighlights,
  type TokenHighlightSpec,
} from '@/features/markdown/ui/markdownPreviewAlwaysOnHighlights'
import { findSelectionTarget } from '@/features/markdown/ui/markdownPreviewSelection'

export { ALWAYS_ON_HIGHLIGHT_COMPLEXITY_BUDGET }

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
  onSlidesReordered?: (nextOrder: number[]) => void
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
  }, [goNext, goPrev, markdownPresentationMode, slides.length, setActiveSlideIndex])

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
          label={UI_COPY.markdownPreviewShowOnCanvasLabel}
          onClickShowOnCanvas={handleShowOnCanvas}
          onClose={closeContextMenu}
        />
      </>
    )
  }

  const contextMenuNode = (
    <MarkdownPreviewContextMenu
      contextMenu={contextMenu}
      label={UI_COPY.markdownPreviewShowOnCanvasLabel}
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
