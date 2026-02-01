import React from 'react'
import { MonacoTextEditor, type MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import MarkdownPreview, { type MarkdownPreviewPresentationApi } from '@/features/markdown/ui/MarkdownPreview'
import type { HighlightedLineRange } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from 'gympgrph'
import { extractFencedCodeBlocks } from '@/lib/markdown/extractFencedCodeBlocks'
import { hashText } from '@/features/parsers/hash'
import { MarkdownWorkspaceToolbar } from '../MarkdownWorkspaceToolbar'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  statusLabel: string
  onApply: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPreviewPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
  onImportLocalFiles: (files: FileList | null) => void
  onImportLocalFolder: (files: FileList | null) => void
  onImportUrl: (url: string) => void

  activeText: string
  setActiveText: (next: string) => void
  outlineText: string
  activeDocumentKey: string
  highlightedLineRange: HighlightedLineRange
  revealLineInEditor: (line: number) => void
  showInViewer: (line: number) => void
  showInPresentation: (line: number) => void
  showInSlidesGallery: (line: number) => void

  editorUri: string
  editorLanguage: string
  editorRef: React.MutableRefObject<MonacoTextEditorHandle | null>
  setHighlightLine: (next: number | null) => void
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
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
    activeText,
    setActiveText,
    outlineText,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    editorUri,
    editorLanguage,
    editorRef,
    setHighlightLine,
  } = props

  const lastPreviewDocKeyRef = React.useRef<string>('')
  const [forceSplitPreviewFlush, setForceSplitPreviewFlush] = React.useState(false)
  React.useEffect(() => {
    if (activeDocumentKey === lastPreviewDocKeyRef.current) return
    lastPreviewDocKeyRef.current = activeDocumentKey
    if (!activeDocumentKey) {
      setForceSplitPreviewFlush(false)
      return
    }
    setForceSplitPreviewFlush(true)
    const id = window.setTimeout(() => setForceSplitPreviewFlush(false), 250)
    return () => window.clearTimeout(id)
  }, [activeDocumentKey])

  const previewText = React.useMemo(() => {
    if (layoutMode === 'split') {
      if (forceSplitPreviewFlush) return activeText
      if (outlineText) return outlineText
      return activeText
    }
    return activeText
  }, [activeText, forceSplitPreviewFlush, layoutMode, outlineText])

  const previewKey = React.useMemo(
    () => `${layoutMode}:${activeDocumentKey || 'empty'}`,
    [activeDocumentKey, layoutMode],
  )

  const geoDatasetIntegration = React.useMemo(
    () =>
      createMarkdownGeoDatasetIntegration({
        requestOpenGeoPanel: () => {
          try {
            setGeospatialModeEnabled(true)
          } catch {
            void 0
          }
          emitSidePanelOpen({ tab: 'geo', open: true })
        },
      }),
    [],
  )

  const lastGeoAutoRegisterSigRef = React.useRef<string>('')
  React.useEffect(() => {
    const docKey = String(activeDocumentKey || '').trim()
    if (!docKey) return
    const text = String(activeText || '')
    if (!text.trim()) return
    if (!text.includes('```')) return
    if (!text.includes('FeatureCollection') && !text.includes('featureCollection')) return

    const sig = `${docKey}:${hashText(text)}`
    if (lastGeoAutoRegisterSigRef.current === sig) return
    lastGeoAutoRegisterSigRef.current = sig

    const schedule = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (fn: () => void, opts?: { timeout?: number }) => number }
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(cb, { timeout: 800 })
        return
      }
      setTimeout(cb, 0)
    }

    schedule(() => {
      const blocks = extractFencedCodeBlocks(text)
      if (!blocks.length) return
      const candidates = blocks
        .filter(b => b.lang === 'geojson' || b.lang === 'json')
        .slice(0, 20)
      if (!candidates.length) return

      void Promise.all(
        candidates.map(b =>
          geoDatasetIntegration.registerGeoJsonFeatureCollection?.({
            sourceDocumentPath: docKey,
            codeBlock: {
              lang: b.lang === 'geojson' ? 'geojson' : 'json',
              text: b.content,
              startLine: b.startLine,
              endLine: b.endLine,
            },
          }),
        ),
      )
    })
  }, [activeDocumentKey, activeText, geoDatasetIntegration])

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
        applyStatusLabel={statusLabel}
        onToggleFullscreen={onToggleFullscreen}
        presentationApiRef={presentationApiRef}
        isEditing={isEditing}
        isMarkdown={isMarkdown}
        onFormatAction={onFormatAction}
        onImportLocalFiles={onImportLocalFiles}
        onImportLocalFolder={onImportLocalFolder}
        onImportUrl={onImportUrl}
      />
      <section className="flex-1 min-h-0 overflow-hidden" aria-label="Markdown workspace content">
        {layoutMode === 'editor' ? (
          <MonacoTextEditor
            value={activeText}
            onChange={setActiveText}
            language={editorLanguage}
            uri={editorUri}
            themeMode={themeMode}
            wordWrap={markdownWordWrap}
            className="h-full"
            editorRef={editorRef}
          />
        ) : layoutMode === 'viewer' || layoutMode === 'presentation' || layoutMode === 'slides-gallery' ? (
          <MarkdownPreview
            key={previewKey}
            markdownText={previewText}
            activeDocumentPath={activeDocumentKey || ''}
            highlightedLineRange={highlightedLineRange}
            markdownWordWrap={markdownWordWrap}
            markdownPresentationMode={layoutMode === 'presentation'}
            markdownTextHighlight={markdownTextHighlight}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            presentationApiRef={presentationApiRef}
            geoDatasetIntegration={geoDatasetIntegration}
            viewMode={layoutMode === 'slides-gallery' ? 'gallery' : layoutMode === 'presentation' ? 'presentation' : 'viewer'}
            showSidebar={false}
            onShowInEditor={line => revealLineInEditor(line)}
            onShowInViewer={showInViewer}
            onShowInPresentation={showInPresentation}
            onShowInSlidesGallery={showInSlidesGallery}
          />
        ) : (
          <section className="h-full min-h-0 flex" aria-label="Split view">
            <section className="flex-1 min-w-0 min-h-0 overflow-hidden" aria-label="Editor">
              <MonacoTextEditor
                value={activeText}
                onChange={setActiveText}
                language={editorLanguage}
                uri={editorUri}
                themeMode={themeMode}
                wordWrap={markdownWordWrap}
                className="h-full"
                editorRef={editorRef}
              />
            </section>
            <section className="w-px bg-zinc-200/70" aria-hidden="true" />
            <section className="flex-1 min-w-0 min-h-0 overflow-hidden" aria-label="Viewer">
              <MarkdownPreview
                key={previewKey}
                markdownText={previewText}
                activeDocumentPath={activeDocumentKey || ''}
                highlightedLineRange={highlightedLineRange}
                markdownWordWrap={markdownWordWrap}
                markdownPresentationMode={false}
                markdownTextHighlight={markdownTextHighlight}
                uiPanelTextFontClass={uiPanelTextFontClass}
                uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
                presentationApiRef={presentationApiRef}
                geoDatasetIntegration={geoDatasetIntegration}
                viewMode="viewer"
                showSidebar={false}
                onShowInEditor={line => revealLineInEditor(line)}
                onShowInViewer={line =>
                  setHighlightLine(Number.isFinite(line) && line > 0 ? Math.floor(line) : null)
                }
              />
            </section>
          </section>
        )}
      </section>
    </main>
  )
})
