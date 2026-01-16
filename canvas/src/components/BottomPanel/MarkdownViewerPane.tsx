import React from 'react'
import MarkdownPreview, {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY } from '@/lib/config'
import type { MarkdownSelectionInfo } from './BottomPanelMarkdownSectionModel'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

type MarkdownViewerPaneProps = {
  viewerRef: React.RefObject<HTMLDivElement>
  handleViewerScroll: (event: React.UIEvent<HTMLDivElement>) => void
  markdownPreviewText: string
  previewBasePath: string
  highlightedLineRange: { start: number; end: number } | null
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  markdownTextHighlight: boolean
  stickyHeadingTopPx?: number
  selectionInfo: MarkdownSelectionInfo | null
  flashSelectionId: string | null
  presentationApiRef: React.RefObject<MarkdownPreviewPresentationApi | null>
  setPresentationSlideState: (next: MarkdownPreviewPresentationSlideState | null) => void
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  annotateDisplayMode: 'inline' | 'beside'
  onShowInGraphDataTable?: (line: number) => void
  onShowInSlidesGallery?: (line: number) => void
  onShowInEditor: (line: number) => void
  isMarkdownPreviewTruncated: boolean
  uiPanelKeyValueTextSizeClass: string
  flashLine?: number | null
  tokens?: TokenWithLines[]
  markdownViewerWidthMode?: 'standard' | 'wide'
  viewMode?: 'viewer' | 'presentation' | 'gallery'
  showSidebar?: boolean
  onToggleSidebar?: (show: boolean) => void
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onTocSelect?: (id: string) => void
  onTocDoubleClick?: (id: string) => void
  onTocReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
}

export function MarkdownViewerPane(props: MarkdownViewerPaneProps) {
  const {
    viewerRef,
    handleViewerScroll,
    markdownPreviewText,
    previewBasePath,
    highlightedLineRange,
    markdownWordWrap,
    markdownPresentationMode,
    markdownTextHighlight,
    stickyHeadingTopPx,
    selectionInfo,
    flashSelectionId,
    presentationApiRef,
    setPresentationSlideState,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    annotateDisplayMode,
    onShowInGraphDataTable,
    onShowInSlidesGallery,
    onShowInEditor,
    isMarkdownPreviewTruncated,
    uiPanelKeyValueTextSizeClass,
    flashLine,
    tokens,
    markdownViewerWidthMode,
    viewMode,
    showSidebar,
    onToggleSidebar,
    collapsedIds,
    onToggleCollapse,
    onExpandAll,
    onCollapseAll,
    onTocSelect,
    onTocDoubleClick,
    onTocReorder,
  } = props

  return (
    <article className="flex-1 min-h-0 flex flex-col w-full max-w-none">
      {isMarkdownPreviewTruncated && (
        <aside
          className={[
            uiPanelKeyValueTextSizeClass,
            `px-2 py-1 border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.headerBg} text-[10px] ${UI_THEME_TOKENS.text.tertiary}`,
          ].join(' ')}
          role="note"
        >
          {UI_COPY.markdownPreviewTruncatedHelperText}
        </aside>
      )}
      <MarkdownPreview
        ref={viewerRef}
        markdownText={markdownPreviewText}
        activeDocumentPath={previewBasePath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={markdownPresentationMode}
        markdownTextHighlight={markdownTextHighlight}
        stickyHeadingTopPx={stickyHeadingTopPx}
        selectionKind={selectionInfo?.kind}
        highlightBackgroundColor={selectionInfo?.highlightBackgroundColor}
        highlightUnderlineColor={selectionInfo?.highlightUnderlineColor}
        selectionId={flashSelectionId}
        presentationApiRef={presentationApiRef}
        onPresentationSlideStateChange={setPresentationSlideState}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        annotateDisplayMode={annotateDisplayMode}
        onShowInGraphDataTable={onShowInGraphDataTable}
        onShowInSlidesGallery={onShowInSlidesGallery}
        onShowInEditor={onShowInEditor}
        onScroll={handleViewerScroll}
        flashLine={flashLine}
        tokens={tokens}
        markdownViewerWidthMode={markdownViewerWidthMode}
        viewMode={viewMode}
        showSidebar={showSidebar}
        onToggleSidebar={onToggleSidebar}
        collapsedIds={collapsedIds}
        onToggleCollapse={onToggleCollapse}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        onTocSelect={onTocSelect}
        onTocDoubleClick={onTocDoubleClick}
        onTocReorder={onTocReorder}
      />
    </article>
  )
}
