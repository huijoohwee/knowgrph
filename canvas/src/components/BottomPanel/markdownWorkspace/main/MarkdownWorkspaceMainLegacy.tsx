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
import { WebpageViewerPane } from './webpage/WebpageViewerPane'
import { deriveWebpageFrontmatterMetaFromBlock, deriveWebsiteImportFrontmatterMetaFromBlock, shouldRenderWebpageIframe } from './webpage/webpageMeta'
import { useWebpageIframeView } from './webpage/useWebpageIframeView'
import { MarkdownEditorPane } from './editor/MarkdownEditorPane'
import { DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY } from './types'
import { MarkdownWorkspaceLayout } from './layout/MarkdownWorkspaceLayout'
import { useWorkspaceScrollSync } from './scroll/useWorkspaceScrollSync'
import { MarkdownWorkspaceDerivedViewer, type MarkdownWorkspaceDerivedViewerKind, type MarkdownWorkspaceDerivedViewerMode } from './viewer/MarkdownWorkspaceDerivedViewer'
import { buildBipartiteMarkdownFromJsonText } from '@/features/markdown/bipartiteJsonToMarkdown'
import { jsonToMarkdownPreferTable } from '@/features/markdown/jsonToMarkdown'
import { buildJsonMarkdownConfigFromPreferences } from '@/features/markdown/jsonMarkdownPreferences'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { useWorkspaceExportBridge } from './useWorkspaceExportBridge'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import { tryBuildWidgetBundleMarkdownFromJsonText } from '@/lib/graph/io/widgetBundle'

const MarkdownWorkspacePresentationSurfaceLazy = React.lazy(
  async (): Promise<{ default: typeof import('./presentation/MarkdownWorkspacePresentationSurface')['MarkdownWorkspacePresentationSurface'] }> =>
    import('./presentation/MarkdownWorkspacePresentationSurface').then(mod => ({ default: mod.MarkdownWorkspacePresentationSurface })),
)

const MarkdownWorkspaceSlidesGallerySurfaceLazy = React.lazy(
  async (): Promise<{ default: typeof import('./presentation/MarkdownWorkspaceSlidesGallerySurface')['MarkdownWorkspaceSlidesGallerySurface'] }> =>
    import('./presentation/MarkdownWorkspaceSlidesGallerySurface').then(mod => ({ default: mod.MarkdownWorkspaceSlidesGallerySurface })),
)

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
  onViewerInlineEditStateChange?: (active: boolean) => void
}

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const [markdownEditorHandle, setMarkdownEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [jsonEditorHandle, setJsonEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [splitPaneVisibility, setSplitPaneVisibility] = React.useState(DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY)
  const [viewerEl, setViewerEl] = React.useState<HTMLElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const setWorkspaceCanvasPaneOpen = useGraphStore(s => s.setWorkspaceCanvasPaneOpen)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
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
    onViewerInlineEditStateChange,
  } = props
  const viewerRef = React.useRef<HTMLElement | null>(null)
  const viewerInlineEditActiveRef = React.useRef(false)

  const frontmatterBlock = React.useMemo(() => extractYamlFrontmatterBlock(activeText), [activeText])
  const webpageMeta = React.useMemo((): WebpageFrontmatterMeta | null => {
    return deriveWebpageFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])
  const websiteImportMeta = React.useMemo((): WebsiteImportFrontmatterMeta | null => {
    return deriveWebsiteImportFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])

  const showWebpageHtml = shouldRenderWebpageIframe(webpageMeta)

  const [viewerKind, setViewerKind] = React.useState<MarkdownWorkspaceDerivedViewerKind>('markdown')
  const [viewerMode, setViewerMode] = React.useState<MarkdownWorkspaceDerivedViewerMode>('read')
  React.useEffect(() => {
    if (layoutMode !== 'editor') return
    if (viewerKind === 'markdown' || viewerKind === 'json') return
    setViewerKind('markdown')
  }, [layoutMode, viewerKind])
  React.useEffect(() => {
    if (layoutMode !== 'viewer') return
    if (viewerKind !== 'markdown') {
      setViewerKind('markdown')
      return
    }
    if (viewerMode !== 'read') {
      setViewerMode('read')
    }
  }, [layoutMode, viewerKind, viewerMode])
  const wasWorkspaceEditorModeOpenRef = React.useRef<boolean>(workspaceViewMode === 'editor')
  React.useEffect(() => {
    const open = workspaceViewMode === 'editor'
    const wasOpen = wasWorkspaceEditorModeOpenRef.current
    wasWorkspaceEditorModeOpenRef.current = open
    if (!open || wasOpen) return
    setSplitPaneVisibility(prev => (
      prev.markdown && !prev.json && !prev.viewer ? prev : { json: false, markdown: true, viewer: false }
    ))
  }, [workspaceViewMode])

  const workspaceEditorMode = React.useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    () => workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode,
    () => workspaceTablePreferencesStore.getServerSnapshot().workspaceEditorMode,
  )

  React.useEffect(() => {
    setViewerMode(prev => {
      if (prev === 'read') return prev
      if (prev === 'geospatial') return prev
      return prev === workspaceEditorMode ? prev : workspaceEditorMode
    })
  }, [workspaceEditorMode])

  const handleSetViewerMode = React.useCallback(
    (next: MarkdownWorkspaceDerivedViewerMode) => {
      setViewerMode(prev => (prev === next ? prev : next))
      if (next === 'read') return
      if (next === 'geospatial') {
        if (workspaceEditorMode !== 'multiDimTable') {
          workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')
        }
        return
      }
      if (next !== workspaceEditorMode) {
        workspaceTablePreferencesStore.setWorkspaceEditorMode(next)
      }
    },
    [workspaceEditorMode],
  )

  const editorVariantUri = React.useCallback(
    (variant: 'markdown' | 'json') => {
      const base = String(editorUri || '').trim()
      if (!base) return `inmemory://workspace/${variant}`
      return `${base}#${variant}`
    },
    [editorUri],
  )

  const jsonPaneVisible = (layoutMode === 'editor' || layoutMode === 'split') && splitPaneVisibility.json
  const markdownPaneVisible = layoutMode === 'editor' ? true : layoutMode === 'split' && splitPaneVisibility.markdown
  const viewerPaneVisible = layoutMode === 'viewer' || (layoutMode === 'split' && splitPaneVisibility.viewer) || (layoutMode === 'editor' && splitPaneVisibility.viewer)

  React.useEffect(() => {
    if (viewerKind === 'markdown' || viewerKind === 'json') return
    setViewerKind('markdown')
  }, [viewerKind])

  const jsonDerivedMarkdownBase = React.useMemo(() => {
    if (isMarkdown) return null
    if (!markdownPaneVisible && !viewerPaneVisible) return null
    const text = String(activeText || '').trim()
    if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null
    const widgetBundleMarkdown = tryBuildWidgetBundleMarkdownFromJsonText(text)
    if (widgetBundleMarkdown) return widgetBundleMarkdown
    const bipartite = buildBipartiteMarkdownFromJsonText(text)
    if (bipartite) return bipartite
    try {
      const parsed = JSON.parse(text) as unknown
      const renderConfig = buildJsonMarkdownConfigFromPreferences()
      return jsonToMarkdownPreferTable(parsed, { ...renderConfig, defaultMode: 'table' }, 'table')
    } catch {
      return null
    }
  }, [activeText, isMarkdown, markdownPaneVisible, viewerPaneVisible])

  const isJsonMarkdownEditing = !isMarkdown && viewerKind === 'markdown' && !!jsonDerivedMarkdownBase
  const [jsonDerivedMarkdownDraft, setJsonDerivedMarkdownDraft] = React.useState<string | null>(null)
  const jsonDerivedMarkdownSeedRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!isJsonMarkdownEditing || !jsonDerivedMarkdownBase) {
      jsonDerivedMarkdownSeedRef.current = ''
      setJsonDerivedMarkdownDraft(null)
      return
    }
    const seed = `${activeDocumentKey}::${jsonDerivedMarkdownBase}`
    if (jsonDerivedMarkdownSeedRef.current === seed) return
    jsonDerivedMarkdownSeedRef.current = seed
    setJsonDerivedMarkdownDraft(jsonDerivedMarkdownBase)
  }, [activeDocumentKey, isJsonMarkdownEditing, jsonDerivedMarkdownBase])
  const markdownEditText = isJsonMarkdownEditing ? (jsonDerivedMarkdownDraft ?? jsonDerivedMarkdownBase ?? '') : null
  const sourceEditorTextRaw = typeof editorTextOverride === 'string' ? editorTextOverride : activeText
  const deferredSourceEditorTextRaw = React.useDeferredValue(sourceEditorTextRaw)
  const jsonEditorText = React.useMemo(() => {
    if (!jsonPaneVisible) return ''
    if (isMarkdown) {
      const sourceText = String(deferredSourceEditorTextRaw || '')
      if (!sourceText.trim()) return ''
      const docName = String(activeDocumentKey || editorUri || 'workspace.md')
      try {
        return JSON.stringify(buildMarkdownJsonLd(docName, sourceText), null, 2)
      } catch {
        return '{}'
      }
    }
    const text = String(deferredSourceEditorTextRaw || '')
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }, [activeDocumentKey, deferredSourceEditorTextRaw, editorUri, isMarkdown, jsonPaneVisible])

  const needsMarkdownViewerText = !showWebpageHtml
  const sourceViewerTextRaw = typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText
  const viewerTextRaw = needsMarkdownViewerText ? (markdownEditText ?? sourceViewerTextRaw) : ''
  const viewerText = React.useMemo(
    () => {
      if (!needsMarkdownViewerText) return ''
      if (viewerKind === 'json') return sourceViewerTextRaw
      return sanitizeInvalidDataUrls(viewerTextRaw)
    },
    [needsMarkdownViewerText, sourceViewerTextRaw, viewerKind, viewerTextRaw],
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
    markdownEditorHandle,
    jsonEditorHandle,
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
      if (layoutMode === 'viewer') return
      try {
        revealLineInEditor(line + 1)
      } catch {
        void 0
      }
    },
    [activeText, disableViewerMutations, layoutMode, revealLineInEditor, setActiveText],
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
      if (layoutMode === 'viewer') return
      if (viewerInlineEditActiveRef.current) return
      try {
        revealLineInEditor(startLine)
      } catch {
        void 0
      }
    },
    [activeText, disableViewerMutations, layoutMode, revealLineInEditor, setActiveText],
  )
  const onInsertLineAfter = disableViewerMutations ? undefined : handleInsertLineAfter
  const onReorderLineBlock = disableViewerMutations ? undefined : handleReorderLineBlock
  const onReplaceLineRange = disableViewerMutations ? undefined : handleReplaceLineRange
  const handleInlineEditStateChange = React.useCallback((active: boolean) => {
    if (viewerInlineEditActiveRef.current === active) return
    viewerInlineEditActiveRef.current = active
    onViewerInlineEditStateChange?.(active)
  }, [onViewerInlineEditStateChange])
  const renderMarkdownEditorPane = React.useCallback(
    () => markdownPaneVisible ? (
      <MarkdownEditorPane
        value={markdownEditText ?? (typeof editorTextOverride === 'string' ? editorTextOverride : activeText)}
        onChange={
          disableEditorMutations
            ? () => void 0
            : (next: string) => {
                if (isJsonMarkdownEditing) {
                  setJsonDerivedMarkdownDraft(next)
                  return
                }
                setActiveText(next)
              }
        }
        wordWrap={markdownWordWrap}
        editorRef={editorRef}
        onCaretLine={onEditorCaretLine}
        panelTypography={panelTypography}
        readOnly={disableEditorMutations || !isMarkdown}
        themeMode={themeMode}
        language="markdown"
        uri={editorVariantUri('markdown')}
        onEditorHandle={setMarkdownEditorHandle}
        ariaLabel="Markdown Editor Text"
      />
    ) : null,
    [
      activeText,
      disableEditorMutations,
      editorRef,
      editorTextOverride,
      editorVariantUri,
      isJsonMarkdownEditing,
      isMarkdown,
      markdownEditText,
      markdownPaneVisible,
      markdownWordWrap,
      onEditorCaretLine,
      panelTypography,
      setActiveText,
      setJsonDerivedMarkdownDraft,
      themeMode,
    ],
  )
  const renderJsonEditorPane = React.useCallback(
    () => jsonPaneVisible ? (
      <MarkdownEditorPane
        value={jsonEditorText}
        onChange={
          disableEditorMutations || isMarkdown
            ? () => void 0
            : (next: string) => {
                setActiveText(next)
              }
        }
        wordWrap={markdownWordWrap}
        editorRef={editorRef}
        onCaretLine={onEditorCaretLine}
        panelTypography={panelTypography}
        readOnly={disableEditorMutations || isMarkdown}
        themeMode={themeMode}
        language="json"
        uri={editorVariantUri('json')}
        onEditorHandle={setJsonEditorHandle}
        ariaLabel="JSON Editor Text"
      />
    ) : null,
    [
      disableEditorMutations,
      editorRef,
      editorVariantUri,
      isMarkdown,
      jsonEditorText,
      jsonPaneVisible,
      markdownWordWrap,
      onEditorCaretLine,
      panelTypography,
      setActiveText,
      themeMode,
    ],
  )

  const viewer = !viewerPaneVisible ? null : showWebpageHtml ? (
    <WebpageViewerPane
      url={webpageMeta?.url || ''}
      iframeSrc={iframeSrc}
      iframeSrcDoc={iframeSrcDoc}
      onIframeRef={handleIframeRef}
      onViewerRef={el => {
        viewerRef.current = el
      }}
    />
  ) : (viewerMode === 'read' || viewerMode === 'table') && viewerKind === 'markdown' ? (
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
      forbidCopy={false}
      onInsertLineAfter={disableViewerMutations ? undefined : onInsertLineAfter}
      onReorderLineBlock={disableViewerMutations ? undefined : onReorderLineBlock}
      onReplaceLineRange={onReplaceLineRange}
      onShowInEditor={line => revealLineInEditor(line)}
      onInlineEditStateChange={handleInlineEditStateChange}
      markdownForcePlainTables={viewerMode === 'table'}
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
      onChangeViewerMode={handleSetViewerMode}
    />
  )

  const {
    handleExportWorkspaceFile,
    handleExportMarkdown,
    handleExportHtmlViewer,
    handleExportHtmlCanvas,
    handleExportSvg,
    handleExportJson,
    handleExportPdf,
  } = useWorkspaceExportBridge({
    activeDocumentKey,
    activeText,
    markdownEditText,
    viewerTextOverride,
    showWebpageHtml,
    iframeSrcDoc,
    viewerEl,
    pushUiToast,
    onSaveAs,
    getViewerRefCurrent: () => viewerRef.current,
  })

  const presentation = (
    <React.Suspense fallback={null}>
      <MarkdownWorkspacePresentationSurfaceLazy
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
    </React.Suspense>
  )

  const slidesGallery = (
    <React.Suspense fallback={null}>
      <MarkdownWorkspaceSlidesGallerySurfaceLazy
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
    </React.Suspense>
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
        viewerMode,
        setViewerMode: handleSetViewerMode,
        splitPaneVisibility,
        setSplitPaneVisibility,
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
        isEditing,
        isMarkdown,
        onFormatAction,
        webpageSignalSummary,
        webpageWorkspaceMeta,
        onWebpageChangeView,
        onWebpageUpdateMeta,
      }}
      layoutMode={layoutMode}
      renderMarkdownEditor={renderMarkdownEditorPane}
      renderJsonEditor={renderJsonEditorPane}
      splitPaneVisibility={splitPaneVisibility}
      viewer={viewer}
      presentation={presentation}
      slidesGallery={slidesGallery}
    />
  )
})
