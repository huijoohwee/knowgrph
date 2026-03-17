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
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MarkdownSourceFilesPanelIntegration } from '@/features/markdown/ui/MarkdownSourceFilesPanel'
import type { MarkdownSourceFilesIngestIntegration } from '@/features/markdown/ui/MarkdownSourceFilesIngestIntegration'

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
  annotateDisplayMode: 'inline' | 'beside' | 'render'
  setAnnotateDisplayMode: (mode: 'inline' | 'beside' | 'render') => void
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
  resolvedMarkdownTextForEditor: string
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
  onSaveRequested?: () => void
  onSaveAsRequested?: () => void
  onShowInGraphDataTable?: (line: number) => void
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  setSelectionSource: (source: 'editor' | 'canvas' | 'table') => void
  themeMode: 'light' | 'dark'
  tokens: TokenWithLines[]
  sourceFiles?: Array<{ id: string; name: string; active?: boolean }>
  onSourceFileSelect?: (id: string) => void
  sourceFilesPanelIntegration?: MarkdownSourceFilesPanelIntegration
  sourceFilesIngestIntegration?: MarkdownSourceFilesIngestIntegration
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
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
    resolvedMarkdownTextForEditor,
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
    tokens: providedTokens,
    onFullscreenToggleRequested,
    onSaveRequested,
    onSaveAsRequested,
    sourceFiles,
    onSourceFileSelect,
    sourceFilesPanelIntegration,
    sourceFilesIngestIntegration,
    geoDatasetIntegration,
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
    handleInsertLineAfter,
    handleReorderLineBlock,
    handleReplaceLineRange,
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
    providedTokens,
  })

  const viewMode =
    markdownLayoutMode === 'presentation'
      ? 'presentation'
      : markdownLayoutMode === 'slides-gallery'
      ? 'gallery'
      : 'viewer'

  const isEditing = markdownLayoutMode === 'editor'

  const rootRef = React.useRef<HTMLElement | null>(null)

  const handleToggleEdit = React.useCallback(() => {
    const nextIsEditing = !isEditing
    if (nextIsEditing) {
      const effectiveText = String(resolvedMarkdownTextForEditor || '')
      if (effectiveText && effectiveText !== markdownText) {
        setMarkdownText(effectiveText)
      }
      setMarkdownPresentationMode(false)
      setMarkdownLayoutMode('editor')
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
      return
    }

    const editorHandle = editorTextAreaRef.current
    const fallbackTextarea =
      !editorHandle && typeof document !== 'undefined'
        ? (document.querySelector('textarea') as HTMLTextAreaElement | null)
        : null
    const editorScrollable = editorHandle
      ? Math.max(0, editorHandle.getScrollHeight() - editorHandle.getClientHeight())
      : fallbackTextarea
        ? Math.max(0, fallbackTextarea.scrollHeight - fallbackTextarea.clientHeight)
        : 0
    const scrollRatio =
      editorHandle && editorScrollable > 0
        ? editorHandle.getScrollTop() / editorScrollable
        : fallbackTextarea && editorScrollable > 0
          ? fallbackTextarea.scrollTop / editorScrollable
          : null

    setMarkdownPresentationMode(false)
    setMarkdownLayoutMode('viewer')
    if (!syncViewerFromEditor) return

    const raf =
      typeof window !== 'undefined' && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number)

    let attempts = 0
    const apply = () => {
      attempts += 1
      const viewerEl =
        viewerRef.current ||
        (typeof document !== 'undefined'
          ? (document.querySelector('[data-testid="markdown-preview-root"]') as HTMLDivElement | null)
          : null)
      if (viewerEl && scrollRatio != null) {
        const viewerScrollable = Math.max(0, viewerEl.scrollHeight - viewerEl.clientHeight)
        const clamped = Math.min(1, Math.max(0, scrollRatio))
        if (viewerScrollable > 0) {
          viewerEl.scrollTop = clamped * viewerScrollable
          syncViewerFromEditor()
          return
        }
      }
      if (attempts < 8) {
        raf(() => apply())
        return
      }
      syncViewerFromEditor()
    }
    raf(() => apply())
  }, [
    editorTextAreaRef,
    handleViewerScroll,
    isEditing,
    markdownPresentationMode,
    markdownText,
    resolvedMarkdownTextForEditor,
    presentationSlideState?.activeSlideLine,
    setMarkdownLayoutMode,
    setMarkdownPresentationMode,
    setMarkdownText,
    syncViewerFromEditor,
    triggerJump,
    viewerRef,
    visibleLineRange.startLine,
  ])

  React.useEffect(() => {
    if (!(markdownLayoutMode === 'editor' || markdownLayoutMode === 'viewer')) return
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return
      if (e.key !== 'Enter') return
      const root = rootRef.current
      const target = e.target as Node | null
      if (root && target && !root.contains(target)) return

      e.preventDefault()
      e.stopPropagation()

      if (isEditing) {
        void (async () => {
          await handleApplyMarkdown()
          handleToggleEdit()
        })()
        return
      }
      handleToggleEdit()
    }
    try {
      window.addEventListener('keydown', handler, true)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener('keydown', handler, true)
      } catch {
        void 0
      }
    }
  }, [handleApplyMarkdown, handleToggleEdit, isEditing, markdownLayoutMode])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const handle = editorTextAreaRef.current
      const selection = handle?.getSelectionOffsets()
      if (!selection) return
      const { nextText, nextSelection } = applyMarkdownFormatAction({
        text: markdownText,
        selection,
        action,
      })
      if (nextText === markdownText) return
      setMarkdownText(nextText)
      const raf =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame
          : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
      raf(() => {
        raf(() => {
          const h = editorTextAreaRef.current
          if (!h) return
          h.focus()
          h.setSelectionOffsets(nextSelection.startOffset, nextSelection.endOffset)
        })
      })
    },
    [editorTextAreaRef, markdownText, setMarkdownText],
  )

  return (
    <section className="h-full min-h-0 flex flex-col">
      <article
        ref={rootRef as unknown as React.RefObject<HTMLElement>}
        className={[
          `flex-1 min-h-0 flex flex-col border rounded overflow-hidden transition-colors duration-300 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`,
          autoOpenHighlight ? 'border-blue-400 ring-1 ring-blue-200' : '',
        ].join(' ')}
      >
        <header
          className={[
            `px-2 py-1 border-b flex flex-col sm:flex-row sm:items-center items-stretch justify-between gap-1 sm:gap-2 ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.secondary}`,
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')}
        >
          <HeaderStatusRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            documentLabel={markdownDocumentName}
            jsonBackedBadgeTooltip={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeTooltip}
            jsonBackedBadgeLabel={UI_COPY.bottomPanelMarkdownJsonBackedPreviewBadgeLabel}
            isJsonBacked={isJsonBacked}
            jsonModeEnabled={jsonModeEnabled}
            jsonMarkdownMode={jsonMarkdownMode}
            setJsonMarkdownMode={setJsonMarkdownMode}
            jsonMarkdownSuggestedMode={jsonMarkdownSuggestedMode}
            jsonModeLabel={UI_COPY.bottomPanelJsonMarkdownModeLabel}
            jsonModeAutoLabel={UI_COPY.bottomPanelJsonMarkdownModeAutoLabel}
            jsonModeTableLabel={UI_COPY.bottomPanelJsonMarkdownModeTableLabel}
            jsonModeKeyValueLabel={UI_COPY.bottomPanelJsonMarkdownModeKeyValueLabel}
            jsonModeHierarchicalLabel={UI_COPY.bottomPanelJsonMarkdownModeHierarchicalLabel}
            jsonModeSuggestedPrefix={UI_COPY.bottomPanelJsonMarkdownModeSuggestedPrefix}
            hasFrontmatterMermaid={hasFrontmatterMermaid}
            onClickFrontmatterHint={handleClickFrontmatterMermaidHint}
          />
          <ViewerHeaderRow
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelTextFontClass={uiPanelTextFontClass}
            viewerTitle={UI_COPY.bottomPanelMarkdownViewerTitle}
            editorTitle={UI_COPY.bottomPanelMarkdownEditorTitle}
            markdownLayoutMode={markdownLayoutMode}
            setMarkdownLayoutMode={setMarkdownLayoutMode}
            setMarkdownPresentationMode={setMarkdownPresentationMode}
            iconSizeClass={iconSizeClass}
            uiIconStrokeWidth={uiIconStrokeWidth}
            markdownTextHighlight={markdownTextHighlight}
            setMarkdownTextHighlight={setMarkdownTextHighlight}
            markdownWordWrap={markdownWordWrap}
            setMarkdownWordWrap={setMarkdownWordWrap}
            wordWrapToggleTitle={UI_COPY.bottomPanelMarkdownWordWrapToggleTitle}
            wordWrapOnTooltip={UI_COPY.bottomPanelMarkdownWordWrapOnTooltip}
            wordWrapOffTooltip={UI_COPY.bottomPanelMarkdownWordWrapOffTooltip}
            annotateDisplayMode={annotateDisplayMode}
            setAnnotateDisplayMode={setAnnotateDisplayMode}
            textHighlightToggleTitle={UI_COPY.bottomPanelMarkdownTextHighlightToggleTitle}
            textHighlightOnTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOnTooltip}
            textHighlightOffTooltip={UI_COPY.bottomPanelMarkdownTextHighlightOffTooltip}
            applyButtonTitle={UI_COPY.bottomPanelMarkdownApplyButtonTitle}
            fullscreenToggleTitle={UI_COPY.bottomPanelMarkdownFullscreenToggleTitle}
            fullscreenToggleTooltip={UI_COPY.bottomPanelMarkdownFullscreenOffTooltip}
            onApplyMarkdown={() => void handleApplyMarkdown()}
            onSaveRequested={onSaveRequested}
            onSaveAsRequested={onSaveAsRequested}
            editToggleTitle={UI_COPY.bottomPanelMarkdownEditToggleTitle}
            isEditing={isEditing}
            onFormatAction={handleFormatAction}
            onFullscreenToggleRequested={onFullscreenToggleRequested}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            allCollapsed={allCollapsed}
            showSidebar={showSidebar}
            onToggleSidebar={() => handleToggleSidebar(!showSidebar)}
            onToggleEdit={handleToggleEdit}
            sourceFilesPanelIntegration={sourceFilesPanelIntegration}
            sourceFilesIngestIntegration={sourceFilesIngestIntegration}
          />
        </header>

        <MarkdownPanelLayout
          tokens={tokens}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
          showSidebar={showSidebar}
          onTocSelect={handleTocSelect}
          sidebarPosition="left"
          className={`flex-1 ${isEditing ? '' : 'hidden'}`}
          collapsedIds={collapsedIds}
          onToggleCollapse={handleToggleCollapse}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onTocReorder={handleTocReorder}
          sourceFiles={sourceFiles}
          onSourceFileSelect={onSourceFileSelect}
          sourceFilesPanelIntegration={sourceFilesPanelIntegration}
        >
          <MarkdownEditorPane
            editorTextAreaRef={editorTextAreaRef}
            markdownText={resolvedMarkdownTextForEditor}
            markdownDocumentName={markdownDocumentName}
            markdownWordWrap={markdownWordWrap}
            editorPaddingTopPx={editorPaddingTopPx}
            setMarkdownText={setMarkdownText}
            onShowOnCanvas={handleShowOnCanvas}
            onShowInViewer={(line) => {
              setMarkdownLayoutMode('viewer')
              setMarkdownPresentationMode(false)
              triggerJump(line)
              const viewer = viewerRef.current
              if (!viewer) return
              const raf =
                typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
                  ? window.requestAnimationFrame
                  : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
              raf(() => {
                raf(() => {
                  scrollToLineInViewer(viewerRef.current, line)
                })
              })
            }}
            onScrollViewerToLine={(line) => {
              const viewer = viewerRef.current
              if (!viewer) return
              scrollToLineInViewer(viewer, line)
            }}
            onShowInPresentation={(line) => {
              setMarkdownLayoutMode('presentation')
              setMarkdownPresentationMode(false)
              triggerJump(line)
            }}
            onShowInSlidesGallery={(line) => {
              setMarkdownLayoutMode('slides-gallery')
              setMarkdownPresentationMode(false)
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
          <MarkdownViewerPane
            viewerRef={viewerRef}
            handleViewerScroll={handleViewerScroll}
            markdownPreviewText={markdownPreviewText}
            previewBasePath={previewBasePath}
            highlightedLineRange={highlightedLineRange}
            markdownWordWrap={markdownWordWrap}
            markdownPresentationMode={markdownPresentationMode}
            markdownTextHighlight={markdownTextHighlight}
            sidebarPosition="left"
            selectionInfo={selectionInfo}
            flashSelectionId={flashSelectionId}
            presentationApiRef={presentationApiRef}
            setPresentationSlideState={setPresentationSlideState}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            annotateDisplayMode={annotateDisplayMode}
            onShowInGraphDataTable={onShowInGraphDataTable}
            onShowInSlidesGallery={(line) => {
              setMarkdownLayoutMode('slides-gallery')
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
            viewMode={viewMode}
            showSidebar={showSidebar}
            onToggleSidebar={handleToggleSidebar}
            collapsedIds={collapsedIds}
            onToggleCollapse={handleToggleCollapse}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onTocSelect={handleTocSelect}
            onTocReorder={handleTocReorder}
            onInsertLineAfter={handleInsertLineAfter}
            onReorderLineBlock={handleReorderLineBlock}
            onReplaceLineRange={handleReplaceLineRange}
            sourceFiles={sourceFiles}
            onSourceFileSelect={onSourceFileSelect}
            sourceFilesPanelIntegration={sourceFilesPanelIntegration}
            geoDatasetIntegration={geoDatasetIntegration}
          />
        </section>
      </article>
    </section>
  )
}
