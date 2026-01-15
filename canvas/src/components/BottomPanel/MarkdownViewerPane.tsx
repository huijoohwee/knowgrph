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
  } = props

  return (
    <article className="flex-1 min-h-0 flex flex-col w-full max-w-none">
      {isMarkdownPreviewTruncated && (
        <div
          className={[
            uiPanelKeyValueTextSizeClass,
            `px-2 py-1 border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.headerBg} text-[10px] ${UI_THEME_TOKENS.text.tertiary}`,
          ].join(' ')}
        >
          {UI_COPY.markdownPreviewTruncatedHelperText}
        </div>
      )}
      <MarkdownPreview
        ref={viewerRef}
        markdownText={markdownPreviewText}
        activeDocumentPath={previewBasePath}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={markdownPresentationMode}
        markdownTextHighlight={markdownTextHighlight}
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
      />
    </article>
  )
}
