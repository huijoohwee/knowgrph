import React from 'react'
import { buildMarkdownTokensKey, lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
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
  },
  ref,
) {

  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const selectionFlashOpacity = useGraphStore(s => s.selectionFlashOpacity || 0.18)
  const flashAlpha = Math.max(0, Math.min(1, selectionFlashOpacity * 1.7))
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

  const storedTokens = useGraphStore(s => s.markdownTokens)
  const storedTokensPath = useGraphStore(s => s.markdownTokensPath)
  const storedTokensKey = useGraphStore(s => s.markdownTokensKey)
  const setMarkdownTokens = useGraphStore(s => s.setMarkdownTokens)

  const currentTokensKey = React.useMemo(() => {
    return buildMarkdownTokensKey(markdownText || '')
  }, [markdownText])

  const tokens = React.useMemo(() => {
    if (providedTokens) return providedTokens
    
    if (storedTokens && storedTokensKey === currentTokensKey) {
      return storedTokens
    }

    const { tokens: parsedTokens } = lexMarkdown(markdownText || '')
    return parsedTokens
  }, [markdownText, providedTokens, storedTokens, storedTokensKey, currentTokensKey])

  React.useEffect(() => {
    if (!providedTokens && tokens && (tokens !== storedTokens || storedTokensKey !== currentTokensKey || storedTokensPath !== activeDocumentPath)) {
      setMarkdownTokens(tokens, activeDocumentPath, currentTokensKey)
    }
  }, [tokens, storedTokens, storedTokensKey, currentTokensKey, storedTokensPath, activeDocumentPath, providedTokens, setMarkdownTokens])

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

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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
    []
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
  }, [handleShowOnCanvas, onPreviewClick, onShowInEditor],
  )

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

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
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
  }

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
        />
        {/* <MarkdownPreviewContextMenu
          contextMenu={contextMenu}
          label={UI_COPY.markdownPreviewShowOnCanvasLabel}
          onClickShowOnCanvas={handleShowOnCanvas}
          onClose={closeContextMenu}
        /> */}
      </>
    )
  }

  // const contextMenuNode = (
  //   <MarkdownPreviewContextMenu
  //     contextMenu={contextMenu}
  //     label={UI_COPY.markdownPreviewShowOnCanvasLabel}
  //     onClickShowOnCanvas={handleShowOnCanvas}
  //     onClose={closeContextMenu}
  //   />
  // )

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
        />
        {/* <MarkdownPreviewContextMenu
          contextMenu={contextMenu}
          label={UI_COPY.markdownPreviewShowOnCanvasLabel}
          onClickShowOnCanvas={handleShowOnCanvas}
          onClose={closeContextMenu}
        /> */}
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
    />
  )
})

export default MarkdownPreview
