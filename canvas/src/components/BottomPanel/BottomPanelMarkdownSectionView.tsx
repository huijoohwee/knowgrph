import React from 'react'
import {
  type MarkdownPreviewPresentationApi,
  type MarkdownPreviewPresentationSlideState,
} from '@/features/markdown/ui/MarkdownPreview'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import type { MarkdownLayoutMode } from './BottomPanelMarkdownSection'
import type { MarkdownSelectionInfo } from './BottomPanelMarkdownSectionModel'
import { HeaderStatusRow, ViewerHeaderRow } from './BottomPanelMarkdownHeaders'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { scrollToLineInViewer } from './markdownScrollUtils'
import { MarkdownPanelLayout } from '@/features/markdown/ui/MarkdownPanelLayout'
import { type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { MarkdownEditorPane } from './MarkdownEditorPane'
import { MarkdownViewerPane } from './MarkdownViewerPane'
import { useMarkdownSectionLogic } from './hooks/useMarkdownSectionLogic'

type JsonMarkdownMode = JsonToMarkdownMode

type BottomPanelMarkdownSectionViewProps = {
  autoOpenHighlight: boolean
  uiPanelKeyValueTextSizeClass: string
  uiPanelMicroLabelTextSizeClass: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  isJsonBacked: boolean
  jsonModeEnabled: boolean
  jsonMarkdownMode: JsonMarkdownMode
  setJsonMarkdownMode: (mode: JsonMarkdownMode) => void
  jsonMarkdownSuggestedMode: JsonMarkdownMode
  status: { ok: boolean | null; msg: string; details?: string }
  applyStatus: { ok: boolean | null; msg: string } | null
  isMarkdownLargeSummary: boolean
  markdownPresentationMode: boolean
  markdownLayoutMode: MarkdownLayoutMode
  setMarkdownLayoutMode: (mode: MarkdownLayoutMode) => void
  markdownViewerWidthMode: 'standard' | 'wide'
  setMarkdownViewerWidthMode: (mode: 'standard' | 'wide') => void
  annotateDisplayMode: 'inline' | 'beside'
  setAnnotateDisplayMode: (mode: 'inline' | 'beside') => void
  iconSizeClass: string
  uiIconStrokeWidth: number
  markdownWordWrap: boolean
  setMarkdownWordWrap: (wrap: boolean) => void
  editorGutterWidthCh: number
  editorContentHeightPx: number
  editorTextAreaRef: React.RefObject<MonacoTextEditorHandle | null>
  selectionHighlightEnabled: boolean
  highlightedLineRange: { start: number; end: number } | null
  editorRowStartByLine: Record<number, number>
  visibleLineRange: { startLine: number; endLine: number }
  flashSelectionId: string | null
  selectionInfo: MarkdownSelectionInfo | null
  editorPaddingTopPx: number
  lineHeightPx: number
  markdownText: string
  setMarkdownText: (next: string) => void
  setMarkdownDocument: (name: string | null, text: string) => void
  markdownDocumentName: string | null
  markdownPreviewText: string
  previewBasePath: string
  viewerRef: React.RefObject<HTMLDivElement>
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  presentationApiRef: React.RefObject<MarkdownPreviewPresentationApi | null>
  presentationSlideState: MarkdownPreviewPresentationSlideState | null
  setPresentationSlideState: (next: MarkdownPreviewPresentationSlideState | null) => void
  handleViewerScroll: (event: React.UIEvent<HTMLDivElement>) => void
  syncViewerFromEditor?: () => void
  setMarkdownPresentationMode: (next: boolean) => void
  isMarkdownPreviewTruncated: boolean
  handleApplyMarkdown: () => void | Promise<void>
  onFullscreenToggleRequested: () => void
  onShowInGraphDataTable?: (line: number) => void
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  setSelectionSource: (source: 'editor' | 'canvas' | 'table') => void
  themeMode: 'light' | 'dark'
}

export function BottomPanelMarkdownSectionView(
  props: BottomPanelMarkdownSectionViewProps,
) {
  const {
    autoOpenHighlight,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    isJsonBacked,
    jsonModeEnabled,
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    status,
    applyStatus,
    isMarkdownLargeSummary,
    markdownPresentationMode,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    markdownViewerWidthMode,
    setMarkdownViewerWidthMode,
    annotateDisplayMode,
    setAnnotateDisplayMode,
    iconSizeClass,
    uiIconStrokeWidth,
    markdownWordWrap,
    setMarkdownWordWrap,
    editorTextAreaRef,
    highlightedLineRange,
    visibleLineRange,
    flashSelectionId,
    selectionInfo,
    editorPaddingTopPx,
    markdownText,
    setMarkdownText,
    setMarkdownDocument,
    markdownDocumentName,
    markdownPreviewText,
    previewBasePath,
    viewerRef,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    presentationApiRef,
    presentationSlideState,
    setPresentationSlideState,
    handleViewerScroll,
    syncViewerFromEditor,
    setMarkdownPresentationMode,
    isMarkdownPreviewTruncated,
    handleApplyMarkdown,
    onShowInGraphDataTable,
    selectNode,
    selectEdge,
    setSelectionSource,
    themeMode,
  } = props

  const {
    handleShowOnCanvas,
    triggerJump,
    jumpFlash,
    tokens,
    showSidebar,
    handleToggleSidebar,
    collapsedIds,
    handleToggleCollapse,
    handleExpandAll,
    handleCollapseAll,
    allCollapsed,
    handleTocSelect,
    handleTocReorder,
    handleClickFrontmatterMermaidHint,
    hasFrontmatterMermaid,
  } = useMarkdownSectionLogic({
    markdownText,
    markdownDocumentName,
    markdownPreviewText,
    previewBasePath,
    markdownLayoutMode,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    editorTextAreaRef,
    viewerRef,
    selectNode,
    selectEdge,
    setSelectionSource,
    setMarkdownText,
    setMarkdownDocument,
  })

  const isEditing = !markdownPresentationMode && markdownLayoutMode === 'editor'

  return (
    <section className="h-full min-h-0 flex flex-col">
      <article
        className={[
          `flex-1 min-h-0 flex flex-col border rounded overflow-hidden transition-colors duration-300 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`,
          autoOpenHighlight ? 'border-blue-400 ring-1 ring-blue-200' : '',
        ].join(' ')}
      >
        <header
          className={[
            `px-2 py-1 border-b flex items-center justify-between gap-2 ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.secondary}`,
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <HeaderStatusRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            jsonBackedBadgeTooltip={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeTooltip}
            jsonBackedBadgeLabel={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeLabel}
            isJsonBacked={isJsonBacked}
            jsonModeEnabled={jsonModeEnabled}
            jsonMarkdownMode={jsonMarkdownMode}
            setJsonMarkdownMode={setJsonMarkdownMode}
            jsonMarkdownSuggestedMode={jsonMarkdownSuggestedMode}
            status={status}
            applyStatus={applyStatus}
            isMarkdownLargeSummary={isMarkdownLargeSummary}
            jsonModeLabel={UI_COPY.bottomPanelJsonMarkdownModeLabel}
            jsonModeAutoLabel={UI_COPY.bottomPanelJsonMarkdownModeAutoLabel}
            jsonModeTableLabel={UI_COPY.bottomPanelJsonMarkdownModeTableLabel}
            jsonModeKeyValueLabel={UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel}
            jsonModeHierarchicalLabel={UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
            jsonModeSuggestedPrefix={UI_COPY.bottomPanelJsonMarkdownModeSuggestedPrefix}
            statusLabel={UI_LABELS.markdown}
            largeSummaryHelperText={UI_COPY.markdownLargeSummaryHelperText}
            hasFrontmatterMermaid={hasFrontmatterMermaid}
            onClickFrontmatterHint={handleClickFrontmatterMermaidHint}
          />
          <ViewerHeaderRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelTextFontClass={uiPanelTextFontClass}
            viewerTitle={UI_COPY.bottomPanelMarkdownViewerTitle}
            editorTitle={UI_COPY.bottomPanelMarkdownEditorTitle}
            markdownPresentationMode={markdownPresentationMode}
            iconSizeClass={iconSizeClass}
            uiIconStrokeWidth={uiIconStrokeWidth}
            markdownTextHighlight={markdownTextHighlight}
            setMarkdownTextHighlight={setMarkdownTextHighlight}
            markdownViewerWidthMode={markdownViewerWidthMode}
            setMarkdownViewerWidthMode={setMarkdownViewerWidthMode}
            markdownWordWrap={markdownWordWrap}
            setMarkdownWordWrap={setMarkdownWordWrap}
            wordWrapToggleTitle={UI_COPY.bottomPanelMarkdownWordWrapToggleTitle}
            wordWrapOnTooltip={UI_COPY.bottomPanelMarkdownWordWrapOnTooltip}
            wordWrapOffTooltip={UI_COPY.bottomPanelMarkdownWordWrapOffTooltip}
            annotateDisplayMode={annotateDisplayMode}
            setAnnotateDisplayMode={setAnnotateDisplayMode}
            setMarkdownPresentationMode={setMarkdownPresentationMode}
            presentationApiRef={presentationApiRef}
            presentationSlideState={presentationSlideState}
            markdownPreviewPrevButtonLabel={UI_COPY.markdownPreviewPrevButtonLabel}
            markdownPreviewNextButtonLabel={UI_COPY.markdownPreviewNextButtonLabel}
            textHighlightToggleTitle={UI_COPY.bottomPanelMarkdownTextHighlightToggleTitle}
            textHighlightOnTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOnTooltip}
            textHighlightOffTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOffTooltip}
            applyButtonLabel={UI_COPY.bottomPanelMarkdownApplyButtonLabel}
            applyButtonTitle={UI_COPY.bottomPanelMarkdownApplyButtonTitle}
            onApplyMarkdown={() => {
              void handleApplyMarkdown()
            }}
            presentationModeToggleTitle={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
            presentationModeOnTooltip={UI_COPY.bottomPanelMarkdownFullscreenOnTooltip}
            presentationModeOffTooltip={UI_COPY.bottomPanelMarkdownFullscreenOffTooltip}
            editToggleTitle={UI_COPY.bottomPanelMarkdownEditToggleTitle}
            editOnTooltip={UI_COPY.bottomPanelMarkdownEditOnTooltip}
            editOffTooltip={UI_COPY.bottomPanelMarkdownEditOffTooltip}
            isEditing={isEditing}
            onFullscreenToggleRequested={props.onFullscreenToggleRequested}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            allCollapsed={allCollapsed}
            showSidebar={showSidebar}
            onToggleSidebar={() => handleToggleSidebar(!showSidebar)}
            onToggleEdit={() => {
              const nextIsEditing = !isEditing
              setMarkdownLayoutMode(nextIsEditing ? 'editor' : 'viewer')
              if (nextIsEditing) {
                // When toggling to editor, try to sync scroll to current viewer position
                // We can use the start line of the visible range
                const targetLine =
                  markdownPresentationMode && presentationSlideState?.activeSlideLine
                    ? presentationSlideState.activeSlideLine
                    : visibleLineRange.startLine

                if (targetLine > 0) {
                  triggerJump(targetLine)
                } else {
                  handleViewerScroll({
                    currentTarget: viewerRef.current as unknown as HTMLDivElement,
                  } as React.UIEvent<HTMLDivElement>)
                }
              } else {
                // Trigger sync from editor to viewer
                if (syncViewerFromEditor) {
                    syncViewerFromEditor()
                }
              }
            }}
          />
        </header>

        <MarkdownPanelLayout
          tokens={tokens}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
          showSidebar={showSidebar}
          setShowSidebar={handleToggleSidebar}
          onTocSelect={handleTocSelect}
          className={`flex-1 ${isEditing ? '' : 'hidden'}`}
          collapsedIds={collapsedIds}
          onToggleCollapse={handleToggleCollapse}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onTocReorder={handleTocReorder}
        >
          <MarkdownEditorPane
            editorTextAreaRef={editorTextAreaRef}
            markdownText={markdownText}
            markdownDocumentName={markdownDocumentName}
            markdownWordWrap={markdownWordWrap}
            editorPaddingTopPx={editorPaddingTopPx}
            setMarkdownText={setMarkdownText}
            setMarkdownDocument={setMarkdownDocument}
            onShowOnCanvas={handleShowOnCanvas}
            onShowInViewer={(line) => {
              setMarkdownLayoutMode('viewer')
              setMarkdownPresentationMode(false)
              triggerJump(line)
              if (viewerRef.current) {
                  setTimeout(() => {
                      if (!viewerRef.current) return
                      scrollToLineInViewer(viewerRef.current, line)
                  }, 50)
              }
            }}
            onShowInPresentation={(line) => {
              props.onFullscreenToggleRequested()
              triggerJump(line)
            }}
            onShowInSlidesGallery={(line) => {
              props.onFullscreenToggleRequested()
              triggerJump(line)
            }}
            onShowInGraphDataTable={(line) => onShowInGraphDataTable?.(line)}
            triggerJump={triggerJump}
            flashLine={jumpFlash?.line}
            themeMode={themeMode}
          />
        </MarkdownPanelLayout>
        <section
          className={[
            'flex-1 min-h-0 flex flex-col',
            !isEditing ? '' : 'hidden',
          ].join(' ')}
          aria-label="Markdown Preview"
        >
          <div className="flex-1 min-h-0 flex flex-col w-full max-w-none">
            <MarkdownViewerPane
              viewerRef={viewerRef}
              handleViewerScroll={handleViewerScroll}
              markdownPreviewText={markdownPreviewText}
              previewBasePath={previewBasePath}
              highlightedLineRange={highlightedLineRange}
              markdownWordWrap={markdownWordWrap}
              markdownPresentationMode={markdownPresentationMode}
              markdownTextHighlight={markdownTextHighlight}
              selectionInfo={selectionInfo}
              flashSelectionId={flashSelectionId}
              presentationApiRef={presentationApiRef}
              setPresentationSlideState={setPresentationSlideState}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              annotateDisplayMode={annotateDisplayMode}
              onShowInGraphDataTable={onShowInGraphDataTable}
              onShowInSlidesGallery={(line) => {
                props.onFullscreenToggleRequested()
                triggerJump(line)
              }}
              onShowInEditor={(line) => {
                setMarkdownLayoutMode('editor')
                setMarkdownPresentationMode(false)
                triggerJump(line)
              }}
              isMarkdownPreviewTruncated={isMarkdownPreviewTruncated}
              uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              flashLine={jumpFlash?.line}
              tokens={tokens}
              markdownViewerWidthMode={markdownViewerWidthMode}
              showSidebar={showSidebar}
              onToggleSidebar={handleToggleSidebar}
              collapsedIds={collapsedIds}
              onToggleCollapse={handleToggleCollapse}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
              onTocSelect={handleTocSelect}
              onTocReorder={handleTocReorder}
            />
          </div>
        </section>
      </article>
    </section>
  )
}
