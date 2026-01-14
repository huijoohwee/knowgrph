import React from 'react'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { TokenWithLines } from './markdownPreviewLex'
import { MarkdownPanelLayout } from './MarkdownPanelLayout'
import { slugify } from '@/features/parsers/markdownJsonLd'
import { MermaidDiagram } from '@/features/panels/views/preview-panel/ui/MermaidDiagram'

export type MarkdownPreviewViewerProps = {
  rootRef: (el: HTMLDivElement | null) => void
  tokens: TokenWithLines[]
  activeDocumentPath: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  selectionKind: 'node' | 'edge' | null
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  mermaidFrontmatterConfig: Record<string, unknown> | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget: HTMLElement | null
  alwaysOnHighlightMode: boolean
  alwaysOnTokenHighlights: Array<{
    textColor: string | null
    underlineColor: string | null
    backgroundColor: string | null
  }> | null
  effectiveHighlightBackgroundColor: string | null
  effectiveHighlightUnderlineColor: string | null
  scrollClass: string
  hasFrontmatterMermaid: boolean
  frontmatterMermaidCode?: string
  codeAnnotations?: Record<string, string> | null
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement>) => void
  selectionToolbar?: React.ReactNode
  showSidebar?: boolean
  onToggleSidebar?: (show: boolean) => void
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  annotateDisplayMode?: 'inline' | 'beside'
  flashLine?: number | null
}

export function MarkdownPreviewViewer(props: MarkdownPreviewViewerProps) {
  const {
    rootRef,
    tokens,
    activeDocumentPath,
    highlightedLineRange,
    markdownWordWrap,
    markdownTextHighlight,
    selectionKind,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    alwaysOnHighlightMode,
    alwaysOnTokenHighlights,
    effectiveHighlightBackgroundColor,
    effectiveHighlightUnderlineColor,
    scrollClass,
    hasFrontmatterMermaid,
    onScroll,
    onContextMenu,
    onClick,
    onMouseUp,
    selectionToolbar,
    showSidebar,
    onToggleSidebar,
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
    frontmatterMermaidCode,
    onDoubleClick,
    codeAnnotations,
    annotateDisplayMode,
    flashLine,
  } = props

  const [localShowSidebar, setLocalShowSidebar] = React.useState(true)
  const effectiveShowSidebar = showSidebar ?? localShowSidebar

  React.useEffect(() => {
    if (showSidebar === undefined) {
      try {
        const stored = localStorage.getItem('markdownPreviewSidebarOpen')
        if (stored !== null) {
          setLocalShowSidebar(stored === 'true')
        }
      } catch {
        void 0
      }
    }
  }, [showSidebar])

  const handleToggleSidebar = React.useCallback(
    (show: boolean) => {
      if (onToggleSidebar) {
        onToggleSidebar(show)
      } else {
        setLocalShowSidebar(show)
        try {
          localStorage.setItem('markdownPreviewSidebarOpen', String(show))
        } catch {
          void 0
        }
      }
    },
    [onToggleSidebar],
  )

  const handleTocSelect = React.useCallback((id: string) => {
    if (onTocSelect) {
      onTocSelect(id)
      return
    }
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [onTocSelect])

  const visibleTokens = React.useMemo(() => {
    if (!collapsedIds || collapsedIds.size === 0) return tokens

    const result: TokenWithLines[] = []
    let skipUntilDepth: number | null = null

    for (const t of tokens) {
      if (t.type === 'heading') {
        const depth = t.depth || 1
        const id = t.id || slugify(t.text || '')

        if (skipUntilDepth !== null && depth <= skipUntilDepth) {
          skipUntilDepth = null
        }

        if (skipUntilDepth === null) {
          result.push(t)
          if (collapsedIds.has(id)) {
            skipUntilDepth = depth
          }
        }
      } else {
        if (skipUntilDepth === null) {
          result.push(t)
        }
      }
    }
    return result
  }, [tokens, collapsedIds])

  const body = React.useMemo(
    () => (
      <MarkdownTokenRenderer
        tokens={visibleTokens}
        activeDocumentPath={activeDocumentPath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={false}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        mermaidFrontmatterConfig={mermaidFrontmatterConfig}
        rootThemeMode={rootThemeMode}
        previewOverlayScope={previewOverlayScope}
        previewOverlayPortalTarget={previewOverlayPortalTarget}
        alwaysOnHighlightMode={alwaysOnHighlightMode}
        alwaysOnTokenHighlights={alwaysOnTokenHighlights}
        markdownTextHighlight={markdownTextHighlight}
        codeAnnotations={codeAnnotations}
        annotateDisplayMode={annotateDisplayMode}
        selectionKind={selectionKind}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
        collapsedIds={collapsedIds}
        onToggleCollapse={onToggleCollapse}
        flashLine={flashLine}
      />
    ),
    [
      activeDocumentPath,
      alwaysOnHighlightMode,
      alwaysOnTokenHighlights,
      effectiveHighlightBackgroundColor,
      effectiveHighlightUnderlineColor,
      highlightedLineRange,
      markdownTextHighlight,
      markdownWordWrap,
      annotateDisplayMode,
      mermaidFrontmatterConfig,
      previewOverlayPortalTarget,
      previewOverlayScope,
      rootThemeMode,
      codeAnnotations,
      selectionKind,
      visibleTokens,
      uiPanelMonospaceTextClass,
      uiPanelTextFontClass,
      collapsedIds,
      onToggleCollapse,
      flashLine,
    ],
  )

  return (
    <MarkdownPanelLayout
      tokens={tokens}
      uiPanelTextFontClass={uiPanelTextFontClass}
      showSidebar={effectiveShowSidebar}
      setShowSidebar={handleToggleSidebar}
      onTocSelect={handleTocSelect}
      onTocDoubleClick={onTocDoubleClick}
      onTocReorder={onTocReorder}
      collapsedIds={collapsedIds}
      onToggleCollapse={onToggleCollapse}
      onExpandAll={onExpandAll}
      onCollapseAll={onCollapseAll}
    >
      <section
        ref={rootRef}
        onScroll={onScroll}
        onContextMenu={onContextMenu}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseUp={onMouseUp}
        className={[
          'relative flex-1 min-h-0 px-8 py-6', // Increased padding for document feel
          scrollClass,
          uiPanelTextFontClass,
        ].join(' ')}
        data-testid="markdown-preview-root"
        aria-label="Markdown Preview Content"
      >
        {hasFrontmatterMermaid && frontmatterMermaidCode && (
          <figure className="mb-8 p-4 border rounded bg-white dark:bg-gray-900 overflow-auto">
            <MermaidDiagram
              code={frontmatterMermaidCode}
              highlightClass=""
              frontmatterConfig={mermaidFrontmatterConfig}
              rootThemeMode={rootThemeMode}
              overlayScope={previewOverlayScope}
              overlayPortalTarget={previewOverlayPortalTarget}
            />
          </figure>
        )}
        <article className="max-w-4xl mx-auto">
           {body}
        </article>
        {selectionToolbar}
      </section> </MarkdownPanelLayout>
  )
}
