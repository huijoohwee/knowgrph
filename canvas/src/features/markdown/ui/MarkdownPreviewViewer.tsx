import React from 'react'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
import { MarkdownTableOfContents } from '@/features/markdown/ui/MarkdownTableOfContents'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { HighlightedLineRange } from './MarkdownRendererTypes'
import type { TokenWithLines } from './markdownPreviewLex'

type MarkdownPreviewViewerProps = {
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
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
  onClickFrontmatterHint: () => void
  contextMenu: React.ReactNode
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
    onClickFrontmatterHint,
    contextMenu,
  } = props

  const [showSidebar, setShowSidebar] = React.useState(true)

  const handleTocSelect = React.useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const body = React.useMemo(
    () => (
      <MarkdownTokenRenderer
        tokens={tokens}
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
        selectionKind={selectionKind}
        highlightBackgroundColor={effectiveHighlightBackgroundColor}
        highlightUnderlineColor={effectiveHighlightUnderlineColor}
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
      mermaidFrontmatterConfig,
      previewOverlayPortalTarget,
      previewOverlayScope,
      rootThemeMode,
      selectionKind,
      tokens,
      uiPanelMonospaceTextClass,
      uiPanelTextFontClass,
    ],
  )

  return (
    <div className="flex flex-1 min-h-0 relative h-full">
      {/* Sidebar (GitBook-like) */}
      <div
        className={`flex-shrink-0 border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 transition-all duration-300 ${
          showSidebar ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Contents
            </span>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Close Sidebar"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
          <MarkdownTableOfContents
            tokens={tokens}
            onSelect={handleTocSelect}
            uiPanelTextFontClass={uiPanelTextFontClass}
            className="flex-1"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {!showSidebar && (
          <div className="absolute top-2 left-2 z-10">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Open Sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}
        <div
          ref={rootRef}
          onScroll={onScroll}
          onContextMenu={onContextMenu}
          onClick={onClick}
          className={[
            'relative flex-1 min-h-0 px-8 py-6', // Increased padding for document feel
            scrollClass,
            uiPanelTextFontClass,
          ].join(' ')}
          data-testid="markdown-preview-root"
        >
          {hasFrontmatterMermaid && (
            <div className="mb-4 px-3 py-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md">
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:underline"
                onClick={onClickFrontmatterHint}
              >
                <span>Info: Frontmatter Mermaid diagram is available. Click to jump.</span>
              </button>
            </div>
          )}
          <div className="max-w-4xl mx-auto">
             {body}
          </div>
          {contextMenu}
        </div>
      </div>
    </div>
  )
}
