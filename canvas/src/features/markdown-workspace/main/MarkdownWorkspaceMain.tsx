import React from 'react'
import type { MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { HighlightedLineRange, MarkdownPresentationApi } from '../markdownWorkspaceTypes'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import { extractYamlFrontmatterBlock, type WebpageFrontmatterMeta, type WebpageViewMode, type WebsiteImportFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { summarizeCategorizedSignalsFromMarkdown } from '@/lib/websites/signalTokens'
import { buildWebpageLayoutWireframeAsciiFromMarkdown } from '@/lib/websites/webpageLayoutWireframe'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { WebpageViewerPane } from './webpage/WebpageViewerPane'
import { deriveWebpageFrontmatterMetaFromBlock, deriveWebsiteImportFrontmatterMetaFromBlock, shouldRenderWebpageIframe } from './webpage/webpageMeta'
import { useWebpageIframeView } from './webpage/useWebpageIframeView'
import { usePendingGltfJson } from './usePendingGltfJson'
import { MarkdownEditorPane } from './editor/MarkdownEditorPane'
import {
  DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY,
  resolveMarkdownWorkspacePaneAvailability,
  resolveMarkdownWorkspacePaneVisibility,
  type MarkdownWorkspaceMainProps,
} from './types'
import { MarkdownWorkspaceLayout } from './layout/MarkdownWorkspaceLayout'
import { useWorkspaceScrollSync } from './scroll/useWorkspaceScrollSync'
import { useInitialWorkspacePaneVisibility } from './useInitialWorkspacePaneVisibility'
import { MarkdownWorkspaceDerivedViewer, type MarkdownWorkspaceDerivedViewerKind, type MarkdownWorkspaceDerivedViewerMode } from './viewer/MarkdownWorkspaceDerivedViewer'
import { buildFlowchartMarkdownFromJsonText } from '@/features/markdown/flowchartJsonToMarkdown'
import { jsonToMarkdownPreferTable } from '@/features/markdown/jsonToMarkdown'
import { buildJsonMarkdownConfigFromPreferences } from '@/features/markdown/jsonMarkdownPreferences'
import { useWorkspaceExportBridge } from './useWorkspaceExportBridge'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import { tryBuildWidgetBundleMarkdownFromJsonText } from '@/lib/graph/io/widgetBundle'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { buildJsonMarkdownSourceSemanticKey, serializeJsonMarkdownDraftToSourceText } from './jsonMarkdownEditing'
import {
  clearLocalEditorWorkspaceSurfaceSnapshot,
  publishLocalEditorWorkspaceSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
const MarkdownWorkspacePresentationSurfaceLazy = React.lazy(
  async (): Promise<{ default: typeof import('./presentation/MarkdownWorkspacePresentationSurface')['MarkdownWorkspacePresentationSurface'] }> =>
    import('./presentation/MarkdownWorkspacePresentationSurface').then(mod => ({ default: mod.MarkdownWorkspacePresentationSurface })),
)

const MarkdownWorkspaceSlidesGallerySurfaceLazy = React.lazy(
  async (): Promise<{ default: typeof import('./presentation/MarkdownWorkspaceSlidesGallerySurface')['MarkdownWorkspaceSlidesGallerySurface'] }> =>
    import('./presentation/MarkdownWorkspaceSlidesGallerySurface').then(mod => ({ default: mod.MarkdownWorkspaceSlidesGallerySurface })),
)

function sanitizeInvalidDataUrls(raw: string): string {
  const s = String(raw || '')
  if (!s.includes('data:image/') || !s.includes('<omitted>')) return s
  return s.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,<omitted>/g, 'data:,')
}

function decodeBase64DataUrlToText(dataUrl: string): string {
  const comma = String(dataUrl || '').indexOf(',')
  if (comma < 0) return ''
  const encoded = String(dataUrl || '').slice(comma + 1).replace(/\s+/g, '')
  if (!encoded) return ''
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function prettyJsonOrRaw(text: string): string {
  const raw = String(text || '')
  if (!raw.trim()) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export const MarkdownWorkspaceMain = React.memo(function MarkdownWorkspaceMain(props: MarkdownWorkspaceMainProps) {
  const panelTypography = usePanelTypography()
  const [markdownEditorHandle, setMarkdownEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [jsonEditorHandle, setJsonEditorHandle] = React.useState<MonacoTextEditorHandle | null>(null)
  const [splitPaneVisibility, setSplitPaneVisibility] = React.useState(DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY)
  const [viewerEl, setViewerEl] = React.useState<HTMLElement | null>(null)
  const [webpageViewerEl, setWebpageViewerEl] = React.useState<HTMLElement | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const setWorkspaceCanvasPaneOpen = useGraphStore(s => s.setWorkspaceCanvasPaneOpen)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
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
    isMarkdown,
    webpageWorkspaceMeta, onWebpageChangeView, onWebpageUpdateMeta, contentFormat, onContentFormatChange,
    activeText,
    setActiveText,
    editorTextOverride,
    webpageHtmlOverride,
    disableEditorMutations,
    viewerTextOverride,
    disableViewerMutations,
    widgetModeActive = false,
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
  const viewerRef = React.useRef<HTMLElement | null>(null), webpageViewerRef = React.useRef<HTMLElement | null>(null)
  const viewerInlineEditActiveRef = React.useRef(false)

  const frontmatterBlock = React.useMemo(() => extractYamlFrontmatterBlock(activeText), [activeText])
  const modelAsset = React.useMemo(() => parseGlbAssetDocument(activeText), [activeText])
  const modelAssetFormat = modelAsset?.format || null
  const paneAvailability = React.useMemo(
    () => resolveMarkdownWorkspacePaneAvailability({ modelAssetFormat }),
    [modelAssetFormat],
  )
  const webpageMeta = React.useMemo((): WebpageFrontmatterMeta | null => {
    return deriveWebpageFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])
  const websiteImportMeta = React.useMemo((): WebsiteImportFrontmatterMeta | null => {
    return deriveWebsiteImportFrontmatterMetaFromBlock(frontmatterBlock)
  }, [frontmatterBlock])

  const showWebpageHtml = shouldRenderWebpageIframe(webpageMeta)
  const forceMarkdownEditorInEditorMode = !modelAssetFormat && (!webpageMeta || webpageMeta.view === 'markdown' || typeof editorTextOverride === 'string')

  const [viewerKind, setViewerKind] = React.useState<MarkdownWorkspaceDerivedViewerKind>('markdown')
  const [viewerMode, setViewerMode] = React.useState<MarkdownWorkspaceDerivedViewerMode>('read')
  const jsonMarkdownRoundTripRef = React.useRef<{ sourceKey: string; markdownText: string } | null>(null)
  const [viewerInlineMarkdownDraftText, setViewerInlineMarkdownDraftText] = React.useState<string | null>(null)
  const [viewerInlineViewerText, setViewerInlineViewerText] = React.useState<string | null>(null)
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
  useInitialWorkspacePaneVisibility({
    activeDocumentKey,
    modelAssetFormat,
    webpageUrl: webpageMeta?.url || null,
    webpageView: webpageMeta?.view || null,
    workspaceEditorOverlayOpen,
    workspaceEditorSurfaceActive: workspaceEditorOverlayOpen || layoutMode === 'editor' || layoutMode === 'split',
    setSplitPaneVisibility,
  })

  React.useEffect(() => {
    if (!modelAssetFormat) return
    if (layoutMode === 'editor' || layoutMode === 'split') return
    setLayoutMode('editor')
  }, [layoutMode, modelAssetFormat, setLayoutMode])

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

  const paneVisibility = React.useMemo(
    () => resolveMarkdownWorkspacePaneVisibility({
      layoutMode,
      splitPaneVisibility,
      paneAvailability,
      forceMarkdownEditorInEditorMode,
    }),
    [forceMarkdownEditorInEditorMode, layoutMode, paneAvailability, splitPaneVisibility],
  )
  const jsonPaneVisible = paneVisibility.json
  const markdownPaneVisible = paneVisibility.markdown
  const viewerPaneVisible = paneVisibility.viewer
  const htmlPaneVisible = paneVisibility.html && showWebpageHtml
  const binaryPaneVisible = paneAvailability.bin && (layoutMode === 'editor' || layoutMode === 'split')
  const { pendingGltfJsonKey, pendingGltfJson } = usePendingGltfJson({ activeDocumentKey, jsonPaneVisible, modelAsset })
  const activeJsonSourceKey = React.useMemo(
    () => buildJsonMarkdownSourceSemanticKey({ activeDocumentKey, text: activeText }),
    [activeDocumentKey, activeText],
  )

  React.useEffect(() => {
    if (viewerKind === 'markdown' || viewerKind === 'json') return
    setViewerKind('markdown')
  }, [viewerKind])

  const jsonDerivedMarkdownBase = React.useMemo(() => {
    if (isMarkdown) return null
    if (!markdownPaneVisible && !viewerPaneVisible) return null
    const cachedRoundTrip = jsonMarkdownRoundTripRef.current
    if (cachedRoundTrip && cachedRoundTrip.sourceKey === activeJsonSourceKey) {
      return cachedRoundTrip.markdownText
    }
    const text = String(activeText || '').trim()
    if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null
    if (widgetModeActive) {
      const widgetBundleMarkdown = tryBuildWidgetBundleMarkdownFromJsonText(text)
      if (widgetBundleMarkdown) return widgetBundleMarkdown
    }
    const flowchart = buildFlowchartMarkdownFromJsonText(text)
    if (flowchart) return flowchart
    try {
      const parsed = JSON.parse(text) as unknown
      const renderConfig = buildJsonMarkdownConfigFromPreferences()
      return jsonToMarkdownPreferTable(parsed, { ...renderConfig, defaultMode: 'table' }, 'table')
    } catch {
      return null
    }
  }, [activeJsonSourceKey, activeText, isMarkdown, markdownPaneVisible, viewerPaneVisible, widgetModeActive])

  const isJsonMarkdownEditing = !isMarkdown && viewerKind === 'markdown' && !!jsonDerivedMarkdownBase
  const [jsonDerivedMarkdownDraft, setJsonDerivedMarkdownDraft] = React.useState<string | null>(null)
  const jsonDerivedMarkdownSeedRef = React.useRef<string>('')
  const editableMarkdownText = viewerInlineMarkdownDraftText ?? (isJsonMarkdownEditing ? (jsonDerivedMarkdownDraft ?? jsonDerivedMarkdownBase ?? '') : activeText)
  React.useEffect(() => {
    setViewerInlineMarkdownDraftText(null)
    setViewerInlineViewerText(null)
  }, [activeDocumentKey])
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
  const persistedEditableMarkdownText = isJsonMarkdownEditing
    ? (jsonDerivedMarkdownDraft ?? jsonDerivedMarkdownBase ?? '')
    : activeText
  const markdownEditText = isJsonMarkdownEditing ? editableMarkdownText : null

  React.useEffect(() => {
    publishLocalEditorWorkspaceSurfaceSnapshot({
      activeDocumentKey: String(activeDocumentKey || ''),
      workspaceViewMode: String(workspaceViewMode || ''),
      workspaceCanvasPaneOpen: workspaceCanvasPaneOpen === true,
      workspaceEditorOverlayOpen,
      layoutMode: String(layoutMode || ''),
      viewerKind: String(viewerKind || ''),
      viewerMode: String(viewerMode || ''),
      isMarkdown,
      isJsonMarkdownEditing,
      paneVisibility: {
        markdown: markdownPaneVisible,
        json: jsonPaneVisible,
        viewer: viewerPaneVisible,
        html: htmlPaneVisible,
        binary: binaryPaneVisible,
      },
      splitPaneVisibility: {
        markdown: splitPaneVisibility.markdown === true,
        json: splitPaneVisibility.json === true,
        viewer: splitPaneVisibility.viewer === true,
        html: splitPaneVisibility.html === true,
        bin: binaryPaneVisible,
      },
      liveMarkdownText: String(editableMarkdownText || ''),
      persistedMarkdownText: String(persistedEditableMarkdownText || ''),
      hasUncommittedDraft:
        viewerInlineMarkdownDraftText != null
        || String(editableMarkdownText || '') !== String(persistedEditableMarkdownText || ''),
      liveDraftSource:
        viewerInlineMarkdownDraftText != null
          ? 'viewer-inline'
          : isJsonMarkdownEditing && String(editableMarkdownText || '') !== String(persistedEditableMarkdownText || '')
            ? 'json-derived'
            : 'persisted',
    })
    return () => {
      clearLocalEditorWorkspaceSurfaceSnapshot()
    }
  }, [
    activeDocumentKey,
    binaryPaneVisible,
    editableMarkdownText,
    htmlPaneVisible,
    isJsonMarkdownEditing,
    isMarkdown,
    jsonPaneVisible,
    layoutMode,
    markdownPaneVisible,
    persistedEditableMarkdownText,
    splitPaneVisibility.html,
    splitPaneVisibility.json,
    splitPaneVisibility.markdown,
    splitPaneVisibility.viewer,
    viewerInlineMarkdownDraftText,
    viewerKind,
    viewerMode,
    viewerPaneVisible,
    workspaceCanvasPaneOpen,
    workspaceEditorOverlayOpen,
    workspaceViewMode,
  ])

  const commitMarkdownEditText = React.useCallback(
    (nextText: string) => {
      if (!isJsonMarkdownEditing) {
        setViewerInlineMarkdownDraftText(null)
        setViewerInlineViewerText(null)
        setActiveText(nextText)
        return
      }
      setViewerInlineMarkdownDraftText(null)
      setViewerInlineViewerText(null)
      const nextMarkdownText = String(nextText || '')
      setJsonDerivedMarkdownDraft(prev => (prev === nextMarkdownText ? prev : nextMarkdownText))
      const nextJsonText = serializeJsonMarkdownDraftToSourceText({
        activeDocumentKey,
        editorUri,
        markdownText: nextMarkdownText,
      })
      jsonMarkdownRoundTripRef.current = {
        sourceKey: buildJsonMarkdownSourceSemanticKey({ activeDocumentKey, text: nextJsonText }),
        markdownText: nextMarkdownText,
      }
      if (nextJsonText !== activeText) {
        setActiveText(nextJsonText)
      }
    },
    [activeDocumentKey, activeText, editorUri, isJsonMarkdownEditing, setActiveText],
  )
  const sourceEditorTextRaw = typeof editorTextOverride === 'string' ? editorTextOverride : activeText
  const frontmatterWarningSourceText = !isJsonMarkdownEditing && isMarkdown ? String(editableMarkdownText || '') : String(sourceEditorTextRaw || '')
  const frontmatterWarnings = React.useMemo(() => {
    if (props.suppressFrontmatterWarnings) return [] as string[]
    const text = String(frontmatterWarningSourceText || '')
    if (!text.startsWith('---')) return [] as string[]
    return parseMarkdownFrontmatter(splitMarkdownLines(text)).warnings || []
  }, [frontmatterWarningSourceText, props.suppressFrontmatterWarnings])
  const frontmatterWarningSummary = frontmatterWarnings[0] || ''
  const frontmatterWarningCount = frontmatterWarnings.length
  const frontmatterNotice = frontmatterWarningSummary ? (
    <div
      className={`rounded border px-3 py-2 text-xs leading-5 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.status.warning}`}
      role="status"
      aria-label="Frontmatter warning"
    >
      <div className="font-medium">Frontmatter warning</div>
      <div className="whitespace-pre-wrap break-words">{frontmatterWarningSummary}</div>
      {frontmatterWarningCount > 1 ? (
        <div className={`mt-1 ${UI_THEME_TOKENS.text.secondary}`}>
          {`${frontmatterWarningCount - 1} more warning${frontmatterWarningCount - 1 === 1 ? '' : 's'}`}
        </div>
      ) : null}
    </div>
  ) : null
  const documentNotice = frontmatterNotice
  const deferredSourceEditorTextRaw = React.useDeferredValue(sourceEditorTextRaw)
  const deferredEditableMarkdownText = React.useDeferredValue(editableMarkdownText)
  const jsonEditorText = React.useMemo(() => {
    if (!jsonPaneVisible) return ''
    if (modelAsset?.format === 'gltf') {
      if (modelAsset.dataUrl) return prettyJsonOrRaw(decodeBase64DataUrlToText(modelAsset.dataUrl))
      if (pendingGltfJson.key === pendingGltfJsonKey && pendingGltfJson.status === 'ready' && pendingGltfJson.text) {
        return prettyJsonOrRaw(pendingGltfJson.text)
      }
      return JSON.stringify({
        kgAssetType: 'model',
        kgAssetFormat: 'gltf',
        kgAssetName: modelAsset.name,
        kgAssetPendingLocalImport: modelAsset.pendingLocalImport === true,
        kgAssetPendingLocalPath: modelAsset.pendingLocalImportPath || undefined,
        kgAssetBytes: modelAsset.byteLength,
        kgAssetJsonStatus: pendingGltfJson.key === pendingGltfJsonKey ? pendingGltfJson.status : 'pending',
      }, null, 2)
    }
    if (modelAsset?.format === 'glb') return ''
    if (isMarkdown || isJsonMarkdownEditing) {
      const sourceText = String(deferredEditableMarkdownText || '')
      if (!sourceText.trim()) return ''
      try {
        return serializeJsonMarkdownDraftToSourceText({
          activeDocumentKey,
          editorUri,
          markdownText: sourceText,
        })
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
  }, [activeDocumentKey, deferredEditableMarkdownText, deferredSourceEditorTextRaw, editorUri, isJsonMarkdownEditing, isMarkdown, jsonPaneVisible, modelAsset, pendingGltfJson, pendingGltfJsonKey])

  const needsMarkdownViewerText = !showWebpageHtml || markdownPaneVisible || viewerPaneVisible
  const sourceViewerTextRaw = typeof viewerTextOverride === 'string' ? viewerTextOverride : activeText
  const viewerTextRaw = needsMarkdownViewerText ? (viewerInlineViewerText ?? markdownEditText ?? sourceViewerTextRaw) : ''
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

  const handleMarkdownViewerRootRef = React.useCallback((el: HTMLElement | null) => {
    viewerRef.current = el
    setViewerEl(prev => (prev === el ? prev : el))
  }, [])
  const handleWebpageViewerRootRef = React.useCallback((el: HTMLElement | null) => {
    webpageViewerRef.current = el
    setWebpageViewerEl(prev => (prev === el ? prev : el))
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
      const lines = splitMarkdownLines(editableMarkdownText)
      const idx = Math.min(lines.length, line)
      const next = [...lines.slice(0, idx), '', ...lines.slice(idx)].join('\n')
      commitMarkdownEditText(next)
      if (layoutMode === 'viewer') return
      try {
        revealLineInEditor(line + 1)
      } catch {
        void 0
      }
    },
    [commitMarkdownEditText, disableViewerMutations, editableMarkdownText, layoutMode, revealLineInEditor],
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

      const lines = splitMarkdownLines(editableMarkdownText)
      if (srcStart > lines.length) return

      const safeSrcEnd = Math.min(lines.length, srcEnd)
      const srcChunk = lines.slice(srcStart - 1, safeSrcEnd)
      const rest = [...lines.slice(0, srcStart - 1), ...lines.slice(safeSrcEnd)]

      const insertionLine = position === 'before' ? tgtStart : tgtEnd + 1
      const insertionIndex = Math.max(0, Math.min(rest.length, insertionLine - 1))

      const next = [...rest.slice(0, insertionIndex), ...srcChunk, ...rest.slice(insertionIndex)].join('\n')
      commitMarkdownEditText(next)
    },
    [commitMarkdownEditText, disableViewerMutations, editableMarkdownText],
  )

  const handleReplaceLineRange = React.useCallback(
    (args: { startLine: number; endLine: number; replacementLines: string[] }) => {
      if (disableViewerMutations) return
      const startLine = Math.max(1, Math.floor(args.startLine || 1))
      const endLine = Math.max(startLine, Math.floor(args.endLine || startLine))
      const replacementLines = Array.isArray(args.replacementLines) ? args.replacementLines : []
      const next = replaceMarkdownLineRange({
        markdownText: persistedEditableMarkdownText,
        startLine,
        endLine,
        replacementLines,
      })
      if (next === persistedEditableMarkdownText) return
      commitMarkdownEditText(next)
      if (layoutMode === 'viewer') return
      if (viewerInlineEditActiveRef.current) return
      try {
        revealLineInEditor(startLine)
      } catch {
        void 0
      }
    },
    [commitMarkdownEditText, disableViewerMutations, layoutMode, persistedEditableMarkdownText, revealLineInEditor],
  )
  const onInsertLineAfter = disableViewerMutations ? undefined : handleInsertLineAfter
  const onReorderLineBlock = disableViewerMutations ? undefined : handleReorderLineBlock
  const onReplaceLineRange = disableViewerMutations ? undefined : handleReplaceLineRange
  const handleInlineEditStateChange = React.useCallback((active: boolean) => {
    if (!active) {
      setViewerInlineMarkdownDraftText(null)
      setViewerInlineViewerText(null)
    }
    if (viewerInlineEditActiveRef.current === active) return
    viewerInlineEditActiveRef.current = active
    onViewerInlineEditStateChange?.(active)
  }, [onViewerInlineEditStateChange])
  const handleInlineDraftTextChange = React.useCallback((nextText: string, options?: { reflectInViewer?: boolean }) => {
    setViewerInlineMarkdownDraftText(prev => (prev === nextText ? prev : nextText))
    if (options?.reflectInViewer === false) return
    setViewerInlineViewerText(prev => (prev === nextText ? prev : nextText))
  }, [])
  const renderMarkdownEditorPane = React.useCallback(
    () => markdownPaneVisible ? (
      <MarkdownEditorPane
        value={typeof editorTextOverride === 'string' ? editorTextOverride : editableMarkdownText}
        onChange={
          disableEditorMutations
            ? () => void 0
            : (next: string) => commitMarkdownEditText(next)
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
      commitMarkdownEditText,
      disableEditorMutations,
      editableMarkdownText,
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
        readOnly={disableEditorMutations || isMarkdown || !!modelAsset}
        themeMode={themeMode}
        language="json"
        uri={editorVariantUri('json')}
        onEditorHandle={setJsonEditorHandle}
        ariaLabel="JSON Editor Text" paneAriaLabel="JSON Editor Surface"
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
      modelAsset,
    ],
  )

  const binaryPane = modelAsset?.format === 'glb' ? (
    <section className={`flex-1 min-h-0 min-w-0 overflow-auto p-3 ${panelTypography.panelTextClass}`} aria-label="Binary GLB Model">
      <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
        <h2 className={panelTypography.keyLabelClass}>Binary GLB</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className={UI_THEME_TOKENS.text.secondary}>Name</dt>
          <dd className="min-w-0 break-all">{modelAsset.name}</dd>
          <dt className={UI_THEME_TOKENS.text.secondary}>Format</dt>
          <dd>GLB</dd>
          {typeof modelAsset.byteLength === 'number' ? (
            <>
              <dt className={UI_THEME_TOKENS.text.secondary}>Bytes</dt>
              <dd>{modelAsset.byteLength}</dd>
            </>
          ) : null}
          {modelAsset.pendingLocalImport ? (
            <>
              <dt className={UI_THEME_TOKENS.text.secondary}>State</dt>
              <dd>pending local file handle</dd>
            </>
          ) : null}
        </dl>
      </div>
    </section>
  ) : null

  const htmlViewer = showWebpageHtml ? (
    <WebpageViewerPane
      url={webpageMeta?.url || ''}
      iframeSrc={iframeSrc}
      iframeSrcDoc={iframeSrcDoc}
      onIframeRef={handleIframeRef}
      onViewerRef={handleWebpageViewerRootRef}
    />
  ) : null

  const markdownViewer = !viewerPaneVisible ? null : (viewerMode === 'read' || viewerMode === 'table') && viewerKind === 'markdown' ? (
    <MarkdownPreview
      ref={handleMarkdownViewerRootRef}
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
      onInlineDraftTextChange={handleInlineDraftTextChange}
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
      onViewerRootRef={handleMarkdownViewerRootRef}
      onChangeViewerMode={handleSetViewerMode}
    />
  )
  const viewer = layoutMode === 'viewer' && showWebpageHtml ? htmlViewer : markdownViewer, exportViewerEl = showWebpageHtml ? webpageViewerEl : viewerEl
  const getExportViewerRefCurrent = React.useCallback(() => (showWebpageHtml ? webpageViewerRef.current : viewerRef.current), [showWebpageHtml])

  const {
    handleExportWorkspaceFile,
    handleExportMarkdown,
    handleExportHtmlViewer,
    handleExportHtmlCanvas,
    handleExportSvg,
    handleExportJson,
  } = useWorkspaceExportBridge({
    activeDocumentKey,
    activeText,
    markdownEditText,
    viewerTextOverride,
    showWebpageHtml,
    iframeSrcDoc,
    viewerEl: exportViewerEl,
    pushUiToast,
    onSaveAs,
    getViewerRefCurrent: getExportViewerRefCurrent,
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
        onSurfaceRef={handleMarkdownViewerRootRef}
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
        onSurfaceRef={handleMarkdownViewerRootRef}
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
        paneAvailability,
        onSaveAs,
        onExportWorkspaceFile: handleExportWorkspaceFile,
        onExportMarkdown: handleExportMarkdown,
        onExportHtmlViewer: handleExportHtmlViewer,
        onExportHtmlCanvas: handleExportHtmlCanvas,
        onExportJson: handleExportJson,
        onExportSvg: handleExportSvg,
        onToggleFullscreen,
        presentationApiRef,
        webpageSignalSummary,
        webpageWorkspaceMeta, onWebpageChangeView, onWebpageUpdateMeta, contentFormat, onContentFormatChange,
      }}
      layoutMode={layoutMode}
      documentNotice={documentNotice}
      renderMarkdownEditor={renderMarkdownEditorPane}
      renderJsonEditor={renderJsonEditorPane}
      binaryPane={binaryPane}
      binaryPaneVisible={binaryPaneVisible}
      splitPaneVisibility={splitPaneVisibility}
      paneAvailability={paneAvailability}
      forceMarkdownEditorInEditorMode={forceMarkdownEditorInEditorMode}
      viewer={viewer}
      htmlViewer={htmlPaneVisible ? htmlViewer : null}
      presentation={presentation}
      slidesGallery={slidesGallery}
    />
  )
})
