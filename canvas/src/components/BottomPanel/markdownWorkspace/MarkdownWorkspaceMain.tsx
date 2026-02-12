import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography, type PanelTypography } from '@/lib/ui/panelTypography'
import { MarkdownWorkspaceToolbar } from '../MarkdownWorkspaceToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi, MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'
import { lexMarkdown, type TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { MarkdownPreviewViewer } from '@/features/markdown/ui/MarkdownPreviewViewer'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { splitMarkdownLines } from '@/lib/markdown'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  statusLabel: MarkdownWorkspaceStatus
  onApply: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  activeText: string
  setActiveText: (next: string) => void
  viewerTextOverride?: string | null
  disableViewerMutations?: boolean
  activeDocumentKey: string
  highlightedLineRange: HighlightedLineRange
  revealLineInEditor: (line: number, endLine?: number) => void
  showInViewer: (line: number) => void
  showInPresentation: (line: number) => void
  showInSlidesGallery: (line: number) => void

  editorUri: string
  editorLanguage: string
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onEditorCaretLine?: (line: number) => void
}

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

import { useSyncScroll } from './useSyncScroll'

function MarkdownEditor(props: {
  value: string
  onChange: (next: string) => void
  wordWrap: boolean
  editorRef: React.MutableRefObject<HTMLTextAreaElement | null>
  onCaretLine?: (line: number) => void
  panelTypography: PanelTypography
}) {
  const emitCaretLine = React.useCallback(() => {
    const onCaretLine = props.onCaretLine
    if (!onCaretLine) return
    const el = props.editorRef.current
    if (!el) return
    const offsetRaw = typeof el.selectionStart === 'number' ? el.selectionStart : 0
    const offset = Math.max(0, Math.floor(offsetRaw))
    const text = String(el.value || '')
    let line = 1
    for (let i = 0; i < offset && i < text.length; i += 1) {
      if (text.charCodeAt(i) === 10) line += 1
    }
    onCaretLine(line)
  }, [props.editorRef, props.onCaretLine])

  return (
    <section className="flex-1 min-h-0 overflow-hidden flex flex-col" aria-label="Markdown Editor">
      <textarea
        ref={el => {
          props.editorRef.current = el
        }}
        className={`flex-1 min-h-0 w-full resize-none box-border px-4 py-3 ${props.panelTypography.panelTextClass} leading-5 ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.border} border outline-none ${props.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} overflow-auto`}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        spellCheck={false}
        wrap={props.wordWrap ? 'soft' : 'off'}
        aria-label="Markdown Editor Text"
        onKeyUp={() => emitCaretLine()}
        onClick={() => emitCaretLine()}
        onSelect={() => emitCaretLine()}
      />
    </section>
  )
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    geoDatasetIntegration,
    layoutMode,
    setLayoutMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    statusLabel,
    onApply,
    onToggleFullscreen,
    presentationApiRef,
    isEditing,
    isMarkdown,
    onFormatAction,
    onImportLocalFiles,
    onImportLocalFolder,
    onImportUrl,
    contentMode,
    setContentMode,
    nodeQuickEditorAvailable,
    nodeQuickEditorFormat,
    setNodeQuickEditorFormat,
    onCopyNodeQuickEditor,
    activeText,
    setActiveText,
    viewerTextOverride,
    disableViewerMutations,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    editorRef,
    onEditorCaretLine,
  } = props
  const viewerRef = React.useRef<HTMLElement | null>(null)

  useSyncScroll(editorRef, viewerRef, layoutMode === 'split')

  React.useEffect(() => {
    if (layoutMode !== 'presentation') {
      presentationApiRef.current = null
    }
  }, [layoutMode, presentationApiRef])

  const viewerVisible = layoutMode === 'viewer' || layoutMode === 'split'
  const viewerTextRaw = typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText
  const viewerText = React.useMemo(() => sanitizeInvalidDataUrls(viewerTextRaw), [viewerTextRaw])

  const lexed = React.useMemo(() => {
    if (!viewerVisible) return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    try {
      return lexMarkdown(viewerText)
    } catch {
      return { tokens: [] as TokenWithLines[], startLineOffset: 0, meta: {} as never }
    }
  }, [viewerText, viewerVisible])

  const tokens = lexed.tokens
  void lexed.startLineOffset
  void lexed.meta

  const handleInsertLineAfter = React.useCallback(
    (afterLine: number) => {
      if (disableViewerMutations) return
      const line = Math.max(1, Math.floor(afterLine))
      const lines = splitMarkdownLines(activeText)
      const idx = Math.min(lines.length, line)
      const next = [...lines.slice(0, idx), '', ...lines.slice(idx)].join('\n')
      setActiveText(next)
      try {
        revealLineInEditor(line + 1)
      } catch {
        void 0
      }
    },
    [activeText, disableViewerMutations, revealLineInEditor, setActiveText],
  )

  const handleReorderLineBlock = React.useCallback(
    (
      source: { startLine: number; endLine: number },
      target: { startLine: number; endLine: number },
      position: 'before' | 'after',
    ) => {
      if (disableViewerMutations) return
      const srcStart = Math.max(1, Math.floor(source.startLine))
      const srcEnd = Math.max(srcStart, Math.floor(source.endLine))
      const tgtStart = Math.max(1, Math.floor(target.startLine))
      const tgtEnd = Math.max(tgtStart, Math.floor(target.endLine))
      if (srcStart === tgtStart && srcEnd === tgtEnd) return

      const lines = splitMarkdownLines(activeText)
      if (srcStart > lines.length) return

      const safeSrcEnd = Math.min(lines.length, srcEnd)
      const srcChunk = lines.slice(srcStart - 1, safeSrcEnd)
      const rest = [...lines.slice(0, srcStart - 1), ...lines.slice(safeSrcEnd)]

      const insertionLine = position === 'before' ? tgtStart : tgtEnd + 1
      const insertionIndex = Math.max(0, Math.min(rest.length, insertionLine - 1))

      const next = [...rest.slice(0, insertionIndex), ...srcChunk, ...rest.slice(insertionIndex)].join('\n')
      setActiveText(next)
    },
    [activeText, disableViewerMutations, setActiveText],
  )

  const viewer = (
    <MarkdownPreviewViewer
      rootRef={el => {
        viewerRef.current = el
      }}
      tokens={tokens}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      geoDatasetIntegration={geoDatasetIntegration}
      mermaidFrontmatterConfig={null}
      rootThemeMode={themeMode}
      previewOverlayScope="container"
      previewOverlayPortalTarget={null}
      effectiveHighlightBackgroundColor={null}
      effectiveHighlightUnderlineColor={null}
      scrollClass="overflow-auto"
      showSidebar={false}
      onContextMenu={() => void 0}
      onClick={() => void 0}
      onInsertLineAfter={handleInsertLineAfter}
      onReorderLineBlock={handleReorderLineBlock}
    />
  )

  const presentation = (
    <section className="flex-1 min-h-0 flex" aria-label="Presentation Surface">
      <MarkdownPreview
        markdownText={viewerText}
        activeDocumentPath={activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={true}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        geoDatasetIntegration={geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        presentationApiRef={presentationApiRef as unknown as React.MutableRefObject<MarkdownPresentationApi | null>}
        viewMode="presentation"
        showSidebar={false}
        onShowInViewer={showInViewer}
        onShowInEditor={(line: number) => revealLineInEditor(line)}
        onShowInPresentation={showInPresentation}
        onShowInSlidesGallery={showInSlidesGallery}
      />
    </section>
  )

  const slidesGallery = (
    <section className="flex-1 min-h-0 flex" aria-label="Slides Gallery">
      <MarkdownPreview
        markdownText={viewerText}
        activeDocumentPath={activeDocumentKey}
        highlightedLineRange={highlightedLineRange}
        markdownWordWrap={markdownWordWrap}
        markdownPresentationMode={false}
        markdownTextHighlight={markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        geoDatasetIntegration={geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        presentationApiRef={presentationApiRef as unknown as React.MutableRefObject<MarkdownPresentationApi | null>}
        viewMode="gallery"
        showSidebar={false}
        onShowInViewer={showInViewer}
        onShowInEditor={(line: number) => revealLineInEditor(line)}
        onShowInPresentation={showInPresentation}
        onShowInSlidesGallery={showInSlidesGallery}
      />
    </section>
  )

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Markdown Editor and Viewer">
      <MarkdownWorkspaceToolbar
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        onApply={onApply}
        applyStatus={statusLabel}
        applyDisabled={!isEditing}
        onToggleFullscreen={onToggleFullscreen}
        presentationApiRef={presentationApiRef}
        contentMode={contentMode}
        setContentMode={setContentMode}
        nodeQuickEditorAvailable={nodeQuickEditorAvailable}
        nodeQuickEditorFormat={nodeQuickEditorFormat}
        setNodeQuickEditorFormat={setNodeQuickEditorFormat}
        onCopyNodeQuickEditor={onCopyNodeQuickEditor}
        isEditing={isEditing}
        isMarkdown={isMarkdown}
        onFormatAction={onFormatAction}
        onImportLocalFiles={onImportLocalFiles}
        onImportLocalFolder={onImportLocalFolder}
        onImportUrl={onImportUrl}
      />

      {layoutMode === 'editor' ? (
        <MarkdownEditor
          value={activeText}
          onChange={setActiveText}
          wordWrap={markdownWordWrap}
          editorRef={editorRef}
          onCaretLine={onEditorCaretLine}
          panelTypography={panelTypography}
        />
      ) : layoutMode === 'viewer' ? (
        viewer
      ) : layoutMode === 'presentation' ? (
        presentation
      ) : layoutMode === 'slides-gallery' ? (
        slidesGallery
      ) : (
        <section className="flex-1 min-h-0 flex" aria-label="Split view">
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Editor">
            <MarkdownEditor
              value={activeText}
              onChange={setActiveText}
              wordWrap={markdownWordWrap}
              editorRef={editorRef}
              onCaretLine={onEditorCaretLine}
              panelTypography={panelTypography}
            />
          </section>
          <hr className="w-px self-stretch bg-[color:var(--kg-border)] border-0" aria-hidden="true" />
          <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label="Viewer">
            {viewer}
          </section>
        </section>
      )}
    </main>
  )
})
