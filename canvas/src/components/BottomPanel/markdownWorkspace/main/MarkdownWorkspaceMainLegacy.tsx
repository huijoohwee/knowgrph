import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi } from '../markdownWorkspaceTypes'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { splitMarkdownLines } from '@/lib/markdown'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import { extractYamlFrontmatterBlock, type WebpageFrontmatterMeta, type WebpageViewMode, type WebsiteImportFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { summarizeCategorizedSignalsFromMarkdown } from '@/lib/websites/signalTokens'
import { buildWebpageLayoutWireframeAsciiFromMarkdown } from '@/lib/websites/webpageLayoutWireframe'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { WebpageViewerPane } from './webpage/WebpageViewerPane'
import { deriveWebpageFrontmatterMetaFromBlock, deriveWebsiteImportFrontmatterMetaFromBlock, shouldRenderWebpageIframe } from './webpage/webpageMeta'
import { useWebpageIframeView } from './webpage/useWebpageIframeView'
import { MarkdownEditorPane } from './editor/MarkdownEditorPane'
import { MarkdownWorkspaceLayout } from './layout/MarkdownWorkspaceLayout'
import { MarkdownWorkspacePresentationSurface } from './presentation/MarkdownWorkspacePresentationSurface'
import { MarkdownWorkspaceSlidesGallerySurface } from './presentation/MarkdownWorkspaceSlidesGallerySurface'
import { useWorkspaceScrollSync } from './scroll/useWorkspaceScrollSync'
import { MarkdownWorkspaceDerivedViewer, type MarkdownWorkspaceDerivedViewerKind, type MarkdownWorkspaceDerivedViewerMode } from './viewer/MarkdownWorkspaceDerivedViewer'
import { exportWorkspaceFileJsonLd } from './exports/exportWorkspaceFile'
import { exportMarkdownFile } from './exports/exportMarkdown'
import { exportHtmlViewerSnapshot } from './exports/exportHtmlViewer'
import { exportHtmlCanvasFromWorkspace } from './exports/exportHtmlCanvas'
import { exportCanvasSvg } from './exports/exportSvg'
import { exportGraphJson } from './exports/exportJson'
import { exportViewerPdf } from './exports/exportPdf'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'

export type MarkdownWorkspaceMainProps = {
  themeMode: 'light' | 'dark'
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration

  explorerOpen: boolean
  setExplorerOpen: (next: boolean) => void

  layoutMode: MarkdownWorkspaceLayoutMode
  setLayoutMode: (mode: MarkdownWorkspaceLayoutMode) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void

  onStatusProgress?: (label: string, current?: number | null, total?: number | null, bytesCurrent?: number | null, bytesTotal?: number | null) => void
  onStatusWithAutoClear?: (label: string, ttlMs?: number) => void
  onSaveAs?: () => void
  onToggleFullscreen: () => void
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>

  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void

  webpageWorkspaceMeta?: WebpageFrontmatterMeta | null
  onWebpageChangeView?: (view: WebpageViewMode) => void
  onWebpageUpdateMeta?: (patch: { fidelityLevel?: 1 | 2 | 3 | 4 }) => void

  contentMode?: 'document' | 'nodeQuickEditor'
  setContentMode?: (mode: 'document' | 'nodeQuickEditor') => void
  nodeQuickEditorAvailable?: boolean
  nodeQuickEditorFormat?: 'json' | 'markdown'
  setNodeQuickEditorFormat?: (format: 'json' | 'markdown') => void
  onCopyNodeQuickEditor?: () => void

  activeText: string
  setActiveText: (next: string) => void
  editorTextOverride?: string | null
  webpageHtmlOverride?: string | null
  disableEditorMutations?: boolean
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
  editorRef: React.MutableRefObject<MonacoTextEditorHandle | null>
  onEditorCaretLine?: (line: number) => void
}

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const [editorHandle, setEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [viewerEl, setViewerEl] = React.useState<HTMLElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const setWorkspaceCanvasPaneOpen = useGraphStore(s => s.setWorkspaceCanvasPaneOpen)
  const graphData = useGraphStore(s => s.graphData)
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const {
    themeMode,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    geoDatasetIntegration,
    explorerOpen,
    setExplorerOpen,
    layoutMode,
    setLayoutMode,
    markdownWordWrap,
    setMarkdownWordWrap,
    markdownTextHighlight,
    setMarkdownTextHighlight,
    onStatusProgress,
    onStatusWithAutoClear,
    onSaveAs,
    onToggleFullscreen,
    presentationApiRef,
    isEditing,
    isMarkdown,
    onFormatAction,
    webpageWorkspaceMeta,
    onWebpageChangeView,
    onWebpageUpdateMeta,
    contentMode,
    setContentMode,
    nodeQuickEditorAvailable,
    nodeQuickEditorFormat,
    setNodeQuickEditorFormat,
    onCopyNodeQuickEditor,
    activeText,
    setActiveText,
    editorTextOverride,
    webpageHtmlOverride,
    disableEditorMutations,
    viewerTextOverride,
    disableViewerMutations,
    activeDocumentKey,
    highlightedLineRange,
    revealLineInEditor,
    showInViewer,
    showInPresentation,
    showInSlidesGallery,
    editorUri,
    editorLanguage,
    editorRef,
    onEditorCaretLine,
  } = props
  const viewerRef = React.useRef<HTMLElement | null>(null)

  const frontmatterBlock = React.useMemo(() => extractYamlFrontmatterBlock(activeText), [activeText])
  const webpageMeta = React.useMemo((): WebpageFrontmatterMeta | null => {
    return deriveWebpageFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])
  const websiteImportMeta = React.useMemo((): WebsiteImportFrontmatterMeta | null => {
    return deriveWebsiteImportFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])

  const showWebpageHtml = shouldRenderWebpageIframe(webpageMeta)

  const [viewerKind, setViewerKind] = React.useState<MarkdownWorkspaceDerivedViewerKind>(() => {
    return lsJson(LS_KEYS.markdownDerivedViewerKind, 'markdown' as MarkdownWorkspaceDerivedViewerKind, (raw) => {
      const v = String(raw || '').trim().toLowerCase()
      if (v === 'html') return 'html'
      if (v === 'markdown') return 'markdown'
      if (v === 'json') return 'json'
      return null
    })
  })
  const [viewerMode, setViewerMode] = React.useState<MarkdownWorkspaceDerivedViewerMode>(() => {
    return lsJson(LS_KEYS.markdownDerivedViewerMode, 'read' as MarkdownWorkspaceDerivedViewerMode, (raw) => {
      const v = String(raw || '').trim().toLowerCase()
      if (v === 'kanban') return 'kanban'
      if (v === 'table') return 'table'
      if (v === 'read') return 'read'
      return null
    })
  })
  React.useEffect(() => {
    lsSetJson(LS_KEYS.markdownDerivedViewerKind, viewerKind)
  }, [viewerKind])

  React.useEffect(() => {
    lsSetJson(LS_KEYS.markdownDerivedViewerMode, viewerMode)
  }, [viewerMode])

  const needsMarkdownViewerText = !showWebpageHtml
  const viewerTextRaw = needsMarkdownViewerText ? (typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText) : ''
  const viewerText = React.useMemo(
    () => {
      if (!needsMarkdownViewerText) return ''
      if (viewerKind === 'json') return viewerTextRaw
      return sanitizeInvalidDataUrls(viewerTextRaw)
    },
    [needsMarkdownViewerText, viewerKind, viewerTextRaw],
  )

  const webpageLayoutWireframeAscii = React.useMemo(() => {
    if (!webpageMeta?.url) return null
    const ascii = buildWebpageLayoutWireframeAsciiFromMarkdown(viewerText)
    return ascii && ascii.trim() ? ascii : null
  }, [viewerText, webpageMeta?.url])

  const debouncedSignalText = useDebouncedValue(activeText, 450, webpageMeta?.url)
  const webpageSignalSummary = React.useMemo(() => {
    if (!webpageMeta?.url) return null
    const signals = summarizeCategorizedSignalsFromMarkdown(debouncedSignalText, { maxLines: 8000, maxPerKind: 24 })
    return {
      nav: signals.nav.length,
      cta: signals.cta.length,
      price: signals.price.length,
      time: signals.time.length,
    }
  }, [debouncedSignalText, webpageMeta?.url])

  const handleViewerRootRef = React.useCallback((el: HTMLDivElement | null) => {
    viewerRef.current = el
    setViewerEl(prev => (prev === el ? prev : el))
  }, [])

  const handleIframeRef = React.useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
  }, [])

  const { iframeSrcDoc, iframeSrc } = useWebpageIframeView({
    enabled: showWebpageHtml,
    webpageMeta,
    websiteImportMeta,
    webpageHtmlOverride,
    onStatusProgress,
    onStatusWithAutoClear,
  })

  useWorkspaceScrollSync({
    activeDocumentKey,
    layoutMode,
    showWebpageHtml,
    editorHandle,
    viewerEl,
    setViewerEl,
    iframeRef,
  })

  React.useEffect(() => {
    if (layoutMode !== 'presentation') {
      presentationApiRef.current = null
    }
  }, [layoutMode, presentationApiRef])

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

  const handleReplaceLineRange = React.useCallback(
    (args: { startLine: number; endLine: number; replacementLines: string[] }) => {
      if (disableViewerMutations) return
      const startLine = Math.max(1, Math.floor(args.startLine || 1))
      const endLine = Math.max(startLine, Math.floor(args.endLine || startLine))
      const replacementLines = Array.isArray(args.replacementLines) ? args.replacementLines : []
      const next = replaceMarkdownLineRange({
        markdownText: activeText,
        startLine,
        endLine,
        replacementLines,
      })
      if (next === activeText) return
      setActiveText(next)
      try {
        revealLineInEditor(startLine)
      } catch {
        void 0
      }
    },
    [activeText, disableViewerMutations, revealLineInEditor, setActiveText],
  )

  const viewer = showWebpageHtml ? (
    <WebpageViewerPane
      url={webpageMeta?.url || ''}
      iframeSrc={iframeSrc}
      iframeSrcDoc={iframeSrcDoc}
      onIframeRef={handleIframeRef}
      onViewerRef={el => {
        viewerRef.current = el
      }}
    />
  ) : viewerMode === 'read' && viewerKind === 'markdown' ? (
    <MarkdownPreview
      ref={handleViewerRootRef}
      markdownText={viewerText}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownPresentationMode={false}
      markdownTextHighlight={markdownTextHighlight}
      selectionKind={null}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
      geoDatasetIntegration={geoDatasetIntegration}
      previewOverlayScope="container"
      previewOverlayPortalTarget={null}
      previewScrollable={true}
      showSidebar={false}
      viewMode="viewer"
      onInsertLineAfter={handleInsertLineAfter}
      onReorderLineBlock={handleReorderLineBlock}
      onReplaceLineRange={handleReplaceLineRange}
    />
  ) : (
    <MarkdownWorkspaceDerivedViewer
      viewerKind={viewerKind}
      viewerMode={viewerMode}
      markdownText={viewerText}
      title={String(activeDocumentKey || '').split('/').filter(Boolean).pop() || 'Workspace'}
      activeDocumentPath={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      webpageLayoutWireframeAscii={webpageLayoutWireframeAscii}
      geoDatasetIntegration={geoDatasetIntegration}
      disableViewerMutations={!!disableViewerMutations}
      onInsertLineAfter={handleInsertLineAfter}
      onReorderLineBlock={handleReorderLineBlock}
      onReplaceLineRange={handleReplaceLineRange}
      onRevealLineInEditor={line => revealLineInEditor(line)}
      onViewerRootRef={handleViewerRootRef}
    />
  )


  const exportBaseName = React.useMemo(() => {
    const raw = String(activeDocumentKey || '').trim() || 'document'
    const base = raw.split('/').filter(Boolean).pop() || raw
    return base.replace(/\.[a-z0-9]+$/i, '') || 'document'
  }, [activeDocumentKey])

  const flushGraphWritebackForExport = React.useCallback(() => {
    try {
      useGraphStore.getState().flushComposedPositionWritesNow()
    } catch {
      void 0
    }
  }, [])

  const handleExportWorkspaceFile = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const text = String(typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText)
    await exportWorkspaceFileJsonLd({ activeDocumentKey, exportBaseName, text })
  }, [activeDocumentKey, activeText, exportBaseName, flushGraphWritebackForExport, viewerTextOverride])

  const handleExportMarkdown = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const text = String(typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText)
    await exportMarkdownFile({ exportBaseName, text })
  }, [activeText, exportBaseName, flushGraphWritebackForExport, viewerTextOverride])

  const handleExportHtmlViewer = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportHtmlViewerSnapshot({
      exportBaseName,
      showWebpageHtml,
      iframeSrcDoc,
      viewerEl,
      viewerRefCurrent: viewerRef.current,
      pushUiToast,
    })
  }, [exportBaseName, flushGraphWritebackForExport, iframeSrcDoc, pushUiToast, showWebpageHtml, viewerEl])

  const handleExportHtmlCanvas = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportHtmlCanvasFromWorkspace({ exportBaseName, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportSvg = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportCanvasSvg({
      exportBaseName,
      pushUiToast,
      getStore: () => useGraphStore.getState(),
    })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportJson = React.useCallback(async () => {
    flushGraphWritebackForExport()
    const gd = useGraphStore.getState().graphData
    await exportGraphJson({ graphData: gd, exportBaseName, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast])

  const handleExportPdf = React.useCallback(async () => {
    flushGraphWritebackForExport()
    await exportViewerPdf({ exportBaseName, viewerEl, viewerRefCurrent: viewerRef.current, pushUiToast })
  }, [exportBaseName, flushGraphWritebackForExport, pushUiToast, viewerEl])

  const exportBridge = React.useMemo(
    () => ({
      export: {
        duplicateInWorkspace: onSaveAs,
        workspaceFileJsonLd: () => void handleExportWorkspaceFile(),
        markdown: () => void handleExportMarkdown(),
        htmlViewer: () => void handleExportHtmlViewer(),
        htmlCanvas: () => void handleExportHtmlCanvas(),
        json: () => void handleExportJson(),
        svg: () => void handleExportSvg(),
        pdf: () => void handleExportPdf(),
      },
    }),
    [
      handleExportHtmlCanvas,
      handleExportHtmlViewer,
      handleExportJson,
      handleExportMarkdown,
      handleExportPdf,
      handleExportSvg,
      handleExportWorkspaceFile,
      onSaveAs,
    ],
  )

  React.useEffect(() => {
    return registerMarkdownWorkspaceActionBridge('markdown-workspace-export', exportBridge)
  }, [exportBridge])

  const presentation = (
    <MarkdownWorkspacePresentationSurface
      showWebpageHtml={showWebpageHtml}
      webpageUrl={webpageMeta?.url || ''}
      iframeSrc={iframeSrc}
      iframeSrcDoc={iframeSrcDoc}
      viewerText={viewerText}
      activeDocumentKey={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      webpageLayoutWireframeAscii={webpageLayoutWireframeAscii || ''}
      geoDatasetIntegration={geoDatasetIntegration}
      presentationApiRef={presentationApiRef}
      showInViewer={showInViewer}
      revealLineInEditor={(line: number) => revealLineInEditor(line)}
      showInPresentation={showInPresentation}
      showInSlidesGallery={showInSlidesGallery}
    />
  )

  const slidesGallery = (
    <MarkdownWorkspaceSlidesGallerySurface
      showWebpageHtml={showWebpageHtml}
      webpageUrl={webpageMeta?.url || ''}
      iframeSrc={iframeSrc}
      iframeSrcDoc={iframeSrcDoc}
      viewerText={viewerText}
      activeDocumentKey={activeDocumentKey}
      highlightedLineRange={highlightedLineRange}
      markdownWordWrap={markdownWordWrap}
      markdownTextHighlight={markdownTextHighlight}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      webpageLayoutWireframeAscii={webpageLayoutWireframeAscii || ''}
      geoDatasetIntegration={geoDatasetIntegration}
      presentationApiRef={presentationApiRef}
      showInViewer={showInViewer}
      revealLineInEditor={(line: number) => revealLineInEditor(line)}
      showInPresentation={showInPresentation}
      showInSlidesGallery={showInSlidesGallery}
    />
  )

  const renderEditor = React.useCallback(
    () => (
      <MarkdownEditorPane
        value={typeof editorTextOverride === 'string' ? editorTextOverride : activeText}
        onChange={disableEditorMutations ? () => void 0 : setActiveText}
        wordWrap={markdownWordWrap}
        editorRef={editorRef}
        onCaretLine={onEditorCaretLine}
        panelTypography={panelTypography}
        readOnly={disableEditorMutations}
        themeMode={themeMode}
        language={editorLanguage}
        uri={editorUri}
        onEditorHandle={setEditorHandle}
      />
    ),
    [
      activeText,
      disableEditorMutations,
      editorLanguage,
      editorRef,
      editorTextOverride,
      editorUri,
      markdownWordWrap,
      onEditorCaretLine,
      panelTypography,
      setActiveText,
      themeMode,
    ],
  )

  return (
    <MarkdownWorkspaceLayout
      toolbarProps={{
        explorerOpen,
        setExplorerOpen,
        canvasOpen: workspaceCanvasPaneOpen,
        setCanvasOpen: setWorkspaceCanvasPaneOpen,
        layoutMode,
        setLayoutMode,
        markdownWordWrap,
        setMarkdownWordWrap,
        markdownTextHighlight,
        setMarkdownTextHighlight,
        viewerKind,
        setViewerKind,
        viewerMode,
        setViewerMode,
        onSaveAs,
        onExportWorkspaceFile: handleExportWorkspaceFile,
        onExportMarkdown: handleExportMarkdown,
        onExportHtmlViewer: handleExportHtmlViewer,
        onExportHtmlCanvas: handleExportHtmlCanvas,
        onExportJson: handleExportJson,
        onExportSvg: handleExportSvg,
        onExportPdf: handleExportPdf,
        onToggleFullscreen,
        presentationApiRef,
        contentMode,
        setContentMode,
        nodeQuickEditorAvailable,
        nodeQuickEditorFormat,
        setNodeQuickEditorFormat,
        onCopyNodeQuickEditor,
        isEditing,
        isMarkdown,
        onFormatAction,
        webpageSignalSummary,
        webpageWorkspaceMeta,
        onWebpageChangeView,
        onWebpageUpdateMeta,
      }}
      layoutMode={layoutMode}
      renderEditor={renderEditor}
      viewer={viewer}
      presentation={presentation}
      slidesGallery={slidesGallery}
    />
  )
})
