import React from 'react'
import MarkdownTokenRenderer from '@/features/markdown/ui/MarkdownTokenRenderer'
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
    <div
      ref={rootRef}
      onScroll={onScroll}
      onContextMenu={onContextMenu}
      onClick={onClick}
      className={[
        'relative flex-1 min-h-0 px-2 py-2',
        scrollClass,
        uiPanelTextFontClass,
      ].join(' ')}
      data-testid="markdown-preview-root"
    >
      {hasFrontmatterMermaid && (
        <div className="mb-1 px-1 py-1 text-[11px] text-gray-600">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-dashed border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
            onClick={onClickFrontmatterHint}
          >
            <span>Frontmatter Mermaid diagram is rendered in Preview.</span>
            <span className="underline">Click to jump</span>
          </button>
        </div>
      )}
      <div>{body}</div>
      {contextMenu}
    </div>
  )
}
