import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi, MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { extractFencedCodeBlocks } from '@/lib/markdown/extractFencedCodeBlocks'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from 'gympgrph'
import { MarkdownWorkspaceExplorer } from './MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from './MarkdownWorkspaceMain'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX, isMarkdownPath, languageForPath } from './markdownWorkspaceUtils'
import { loadWorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import { useWorkspaceFileActions } from './useWorkspaceFileActions'
import { useCanvasMarkdownSync } from './useCanvasMarkdownSync'
import { subscribeWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { shouldAutosaveWorkspaceFile } from './workspaceAutosave'
import { getDocumentLocationFromMetadata } from '@/lib/graph/markdownMetadata'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH } from '@/features/panels/utils/orchestratorWorkspaceFiles'
import { PARSER_SCRIPT_WORKSPACE_PATH } from '@/features/panels/utils/parserWorkspaceFiles'
import { SCHEMA_CONFIG_WORKSPACE_PATH } from '@/features/panels/utils/schemaWorkspaceFiles'
import { useParserUIState } from '@/features/parsers/uiState'
import { parseSchemaText } from '@/features/schema/io'
import { fetchPdfWorkspaceDoc } from '@/lib/pdf/pdfWorkspaceClient'
import { fetchWebpageMarkdown, fetchYouTubeTranscriptMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { normalizeWebpageFrontmatterView, parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta, type WebpageViewMode } from '@/lib/markdown/frontmatter'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import type { PdfConversionMode } from '@/lib/pdf/pdfWorkspaceAnchors'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  isPendingLocalImportStubText,
  peekPendingWorkspaceLocalImport,
} from './workspaceImport'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { readPdfWorkspaceOutputDirRel } from '@/lib/pdf/pdfWorkspacePreferences'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { coerceGeoJsonToFeatureCollection, parseGeoJsonFromText, recordsToPointFeatureCollection } from 'gympgrph'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
  resolveNodeQuickEditorRegistryEntry,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonText } from '@/lib/graph/io/nodeQuickEditorBundle'
import { WorkspaceModeSelect } from './WorkspaceModeSelect'

const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out = raw.map(v => String(v || '').trim()).filter(Boolean)
  return out
}

function parsePdfWorkspaceFrontmatter(text: string): { docId: string; mode: PdfConversionMode; outputDirRel: string } | null {
  const raw = String(text || '')
  if (!raw.startsWith('---')) return null
  const end = raw.indexOf('\n---')
  if (end < 0) return null
  const fm = raw.slice(0, end + 4)
  const readVal = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'))
    const v = m ? String(m[1] || '').trim() : ''
    if (!v) return ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
    return v
  }
  const docId = readVal('kgPdfWorkspaceDocId')
  const modeRaw = readVal('kgPdfWorkspaceMode')
  const outputDirRel = readVal('kgPdfWorkspaceOutputDirRel')
  const mode: PdfConversionMode = modeRaw === 'image-heavy' ? 'image-heavy' : modeRaw === 'scan-ocr' ? 'scan-ocr' : 'text-only'
  if (!docId) return null
  return { docId, mode, outputDirRel: outputDirRel || readPdfWorkspaceOutputDirRel() }
}

function parseYoutubeWorkspaceFrontmatter(text: string): { videoId: string; format: 'markdown' | 'json' } | null {
  const raw = String(text || '')
  if (!raw.startsWith('---')) return null
  const end = raw.indexOf('\n---')
  if (end < 0) return null
  const fm = raw.slice(0, end + 4)
  const readVal = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'))
    const v = m ? String(m[1] || '').trim() : ''
    if (!v) return ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
    return v
  }
  const videoId = readVal('kgYoutubeVideoId')
  const formatRaw = readVal('kgYoutubeFormat')
  const format: 'markdown' | 'json' = formatRaw === 'json' ? 'json' : 'markdown'
  if (!videoId) return null
  return { videoId, format }
}

function inferYoutubeVideoIdFromPath(path: string): string | null {
  const base = path.split('/').pop() || ''
  const m = base.match(/^(?:transcript|youtube)-([a-zA-Z0-9_-]{11})(?:\.(?:txt|md|markdown|json))?$/i)
  return m ? m[1] : null
}

const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))

export function MarkdownWorkspace() {
  const themeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const bottomPanelCollapsed = useGraphStore(s => s.bottomPanelCollapsed)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const editorWorkspaceSection = useGraphStore(s => s.editorWorkspaceSection)
  const effectiveBottomPanelCollapsed = workspaceViewMode === 'editor' ? false : bottomPanelCollapsed
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const applyMarkdownDocumentToGraph = useGraphStore(s => s.applyMarkdownDocumentToGraph)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const setMarkdownDocumentSourceUrl = useGraphStore(s => s.setMarkdownDocumentSourceUrl)
  const setGraphRagWorkflowJsonText = useGraphStore(s => s.setGraphRagWorkflowJsonText)
  const setGraphData = useGraphStore(s => s.setGraphData)

  const setPdfImportConversionMode = useGraphStore(s => s.setPdfImportConversionMode)
  const setWebpageImportView = useGraphStore(s => s.setWebpageImportView)

  const handleSetPdfImportConversionMode = React.useCallback(
    (mode: 'text-only' | 'image-heavy' | 'scan-ocr') => {
      try {
        setPdfImportConversionMode(mode)
      } catch {
        void 0
      }
    },
    [setPdfImportConversionMode],
  )

  const graphData = useGraphStore(s => s.graphData) as GraphData | null
  const nodeQuickEditorRegistry = useGraphStore(s => s.nodeQuickEditorRegistry || [])
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])

  const activePath = useMarkdownExplorerStore(s => s.activePath)
  const setActivePath = useMarkdownExplorerStore(s => s.setActivePath)
  const requestedRevealLine = useMarkdownExplorerStore(s => s.requestedRevealLine)
  const requestRevealLine = useMarkdownExplorerStore(s => s.requestRevealLine)

  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [sourcesByPath, setSourcesByPath] = React.useState(() => loadWorkspaceSourceIndex())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>('')
  const [search, setSearch] = React.useState('')
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => lsInt(LS_KEYS.markdownSidebarWidthPx, 320))
  const [sourceFilesCollapsed, setSourceFilesCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, false))
  const [tocCollapsed, setTocCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerOutlineCollapsed, false))
  const [backlinksCollapsed, setBacklinksCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerBacklinksCollapsed, false))
  const [markdownWordWrap, setMarkdownWordWrap] = React.useState(() => lsBool(LS_KEYS.markdownWordWrap, true))
  const [markdownTextHighlight, setMarkdownTextHighlight] = React.useState(() => lsBool(LS_KEYS.markdownTextHighlight, false))
  const [layoutMode, setLayoutMode] = React.useState<MarkdownWorkspaceLayoutMode>(() =>
    lsJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, 'viewer', parseMarkdownWorkspaceLayoutMode),
  )
  const [statusLabel, setStatusLabel] = React.useState<MarkdownWorkspaceStatus>(null)
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
    const arr = lsJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [] as string[], parseStringArray)
    return new Set((arr || []).map(p => normalizeWorkspacePath(p)))
  })

  const editorRef = React.useRef<HTMLTextAreaElement | null>(null)
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const workspaceRootRef = React.useRef<HTMLElement | null>(null)
  const presentationApiRef = React.useRef<MarkdownPresentationApi | null>(null)

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
        loadGraphData: (data: GraphData) => {
          try {
            setGraphData(data)
          } catch {
            void 0
          }
        },
      }),
    [setGraphData],
  )
  const workspaceFsRef = React.useRef<Awaited<ReturnType<typeof getWorkspaceFs>> | null>(null)
  const [highlightedLineRange, setHighlightedLineRange] = React.useState<HighlightedLineRange>(null)
  const [activeText, setActiveText] = React.useState('')
  const activeTextRef = React.useRef('')
  activeTextRef.current = activeText

  const setStatusInfo = React.useCallback((label: string) => {
    const msg = String(label || '').trim()
    if (!msg) return
    setStatusLabel({ kind: 'info', label: msg })
  }, [])

  const setStatusError = React.useCallback((label: string) => {
    const msg = String(label || '').trim()
    if (!msg) return
    setStatusLabel({ kind: 'error', label: msg })
  }, [])

  const setStatusProgress = React.useCallback((
    label: string,
    current?: number | null,
    total?: number | null,
    bytesCurrent?: number | null,
    bytesTotal?: number | null,
  ) => {
    const msg = String(label || '').trim()
    if (!msg) return
    setStatusLabel({
      kind: 'progress',
      label: msg,
      current: typeof current === 'number' ? current : null,
      total: typeof total === 'number' ? total : null,
      bytesCurrent: typeof bytesCurrent === 'number' ? bytesCurrent : null,
      bytesTotal: typeof bytesTotal === 'number' ? bytesTotal : null,
    })
  }, [])
  const userEditedActiveTextRef = React.useRef(false)
  const setActiveTextProgrammatic = React.useCallback((next: string) => {
    userEditedActiveTextRef.current = false
    setActiveText(next)
  }, [])
  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const debouncedText = useDebouncedValue(activeText, 450, activePath)
  const outlineText = useDebouncedValue(activeText, 160, activePath)
  const lastLoadedRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const lastIndexedRef = React.useRef<{ path: WorkspacePath; textHash: string } | null>(null)
  const indexJobRef = React.useRef(0)
  const collapsedSnapshotRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const prevCollapsedRef = React.useRef<boolean>(effectiveBottomPanelCollapsed)
  const lastRequestedActivePathRef = React.useRef<{ path: WorkspacePath; atMs: number } | null>(null)
  const lastSetActivePath = useMarkdownExplorerStore(s => s.lastSetActivePath)

  const [contentMode, setContentMode] = React.useState<'document' | 'nodeQuickEditor'>('document')
  const userForcedDocumentRef = React.useRef(false)
  const setContentModeSafe = React.useCallback((mode: 'document' | 'nodeQuickEditor') => {
    userForcedDocumentRef.current = mode === 'document'
    setContentMode(mode)
  }, [])
  const [nodeQuickEditorFormat, setNodeQuickEditorFormat] = React.useState<'json' | 'markdown'>('json')

  const activeQuickEditorNodeId = React.useMemo(() => {
    const gd = graphData as unknown as { nodes?: unknown[] } | null
    const nodes = Array.isArray(gd?.nodes) ? (gd?.nodes as Array<{ id?: unknown; type?: unknown; properties?: unknown }>) : []
    const byId = new Map(nodes.map(n => [String(n.id || ''), n] as const))

    const selectedId = typeof selectedNodeId === 'string' ? selectedNodeId.trim() : ''
    if (selectedId) {
      const node = byId.get(selectedId) || null
      const reg = node ? resolveNodeQuickEditorRegistryEntry({ node: node as never, registry: nodeQuickEditorRegistry }) : null
      const props = node && typeof node === 'object' ? ((node as { properties?: unknown }).properties as Record<string, unknown> | undefined) : undefined
      const hasHint =
        !!(typeof props?.[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY] === 'string' && String(props?.[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY] || '').trim()) ||
        !!(typeof props?.[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string' && String(props?.[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] || '').trim())
      if (reg || hasHint) return selectedId
    }

    for (let i = openQuickEditorNodeIds.length - 1; i >= 0; i -= 1) {
      const id = String(openQuickEditorNodeIds[i] || '').trim()
      if (!id) continue
      if (!byId.has(id)) continue
      return id
    }
    return ''
  }, [graphData, nodeQuickEditorRegistry, openQuickEditorNodeIds, selectedNodeId])

  const nodeQuickEditorAvailable = Boolean(activeQuickEditorNodeId)

  React.useEffect(() => {
    if (contentMode !== 'nodeQuickEditor') return
    if (nodeQuickEditorAvailable) return
    setContentModeSafe('document')
  }, [contentMode, nodeQuickEditorAvailable])

  React.useEffect(() => {
    if (!nodeQuickEditorAvailable) return
    if (contentMode === 'nodeQuickEditor') return
    if (userForcedDocumentRef.current) return
    setContentModeSafe('nodeQuickEditor')
  }, [contentMode, nodeQuickEditorAvailable, setContentModeSafe])

  const quickEditorBundleJsonText = React.useMemo(() => {
    if (!activeQuickEditorNodeId) return ''
    const gd = graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
    const nodes = Array.isArray(gd?.nodes) ? (gd?.nodes as GraphNode[]) : []
    const edges = Array.isArray(gd?.edges) ? (gd?.edges as GraphEdge[]) : []
    const node = nodes.find(n => String(n.id || '') === activeQuickEditorNodeId) || null
    if (!node) return ''

    const nodeType = String(node.type || '').trim()
    const registryForType = (nodeQuickEditorRegistry || []).filter((e: unknown) => {
      if (!e || typeof e !== 'object') return false
      const rec = e as { isEnabled?: unknown; nodeTypeId?: unknown }
      if (rec.isEnabled !== true) return false
      return String(rec.nodeTypeId || '').trim() === nodeType
    })

    const connectedEdges = edges.filter(e => String(e.source || '') === activeQuickEditorNodeId || String(e.target || '') === activeQuickEditorNodeId)
    const graph: GraphData = {
      type: 'application/json',
      nodes: [node],
      edges: connectedEdges,
    }
    return nodeQuickEditorBundleToJsonText(buildNodeQuickEditorBundleV1({ registryEntries: registryForType, graphData: graph }))
  }, [activeQuickEditorNodeId, graphData, nodeQuickEditorRegistry])

  const quickEditorEditorText = React.useMemo(() => {
    if (!nodeQuickEditorAvailable) return ''
    if (!quickEditorBundleJsonText) return ''
    if (nodeQuickEditorFormat === 'markdown') return `\`\`\`json\n${quickEditorBundleJsonText}\n\`\`\``
    return quickEditorBundleJsonText
  }, [nodeQuickEditorAvailable, nodeQuickEditorFormat, quickEditorBundleJsonText])

  const quickEditorViewerText = React.useMemo(() => {
    if (!nodeQuickEditorAvailable) return ''
    if (!quickEditorBundleJsonText) return ''
    return `\`\`\`json\n${quickEditorBundleJsonText}\n\`\`\``
  }, [nodeQuickEditorAvailable, quickEditorBundleJsonText])

  const onCopyNodeQuickEditorRef = React.useRef<(() => void) | null>(null)
  const onCopyNodeQuickEditor = React.useCallback(() => {
    onCopyNodeQuickEditorRef.current?.()
  }, [])

  const activePathRef = React.useRef<WorkspacePath | null>(null)
  activePathRef.current = activePath

  const [selectionPath, setSelectionPath] = React.useState<WorkspacePath | null>(null)
  const selectionPathRef = React.useRef<WorkspacePath | null>(null)
  selectionPathRef.current = selectionPath

  const getFs = React.useCallback(async () => {
    const existing = workspaceFsRef.current
    if (existing) return existing
    const fs = await getWorkspaceFs()
    workspaceFsRef.current = fs
    return fs
  }, [])

  const refresh = React.useCallback(async () => {
    setStatusProgress('Refreshing')
    setLoading(true)
    setLoadError('')
    try {
      const fs = await getFs()
      await fs.ensureSeed()
      const list = await fs.listEntries()
      const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
      const pruned = list.map(e => {
        if (!e || e.kind !== 'file') return e
        if (typeof e.text !== 'string') return e
        if (e.text.length <= maxInline) return e
        return { ...e, text: undefined }
      })
      setEntries(pruned)
      const sources = loadWorkspaceSourceIndex()
      setSourcesByPath(sources)
      try {
        const store = useGraphStore.getState()
        const merged = mergeWorkspaceEntriesIntoSourceFiles({
          existing: store.sourceFiles,
          workspaceEntries: pruned,
          sourcesByPath: sources,
        })
        store.setSourceFiles(merged)
      } catch {
        void 0
      }
      setLoading(false)
      setStatusInfo('Ready')
    } catch (e) {
      setLoading(false)
      setLoadError(String((e as { message?: unknown })?.message ?? e))
      setStatusError('Refresh failed')
    }
  }, [getFs, setStatusError, setStatusInfo, setStatusProgress])

  const statusClearRef = React.useRef<number | null>(null)
  const setStatusWithAutoClear = React.useCallback((label: string, ttlMs: number = 1400) => {
    setStatusInfo(label)
    if (statusClearRef.current != null) window.clearTimeout(statusClearRef.current)
    statusClearRef.current = window.setTimeout(() => setStatusLabel(null), ttlMs)
  }, [setStatusInfo])

  const pdfWorkspaceMeta = React.useMemo(() => {
    if (!activePath) return null
    if (!isMarkdownPath(activePath)) return null
    const t = String(activeText || '')
    if (!t.startsWith('---')) return null
    return parsePdfWorkspaceFrontmatter(t)
  }, [activePath, activeText])

  const youtubeWorkspaceMeta = React.useMemo(() => {
    if (!activePath) return null
    // Allow .md, .markdown, .txt, .json for YouTube transcripts
    const ext = activePath.split('.').pop()?.toLowerCase() || ''
    const allowed = ['md', 'markdown', 'txt', 'json']
    if (!allowed.includes(ext)) return null

    const t = String(activeText || '')
    // Priority 1: Frontmatter
    if (t.startsWith('---')) {
      const parsed = parseYoutubeWorkspaceFrontmatter(t)
      if (parsed) return parsed
    }
    // Priority 2: Filename inference
    const inferredId = inferYoutubeVideoIdFromPath(activePath)
    if (inferredId) {
      return { videoId: inferredId, format: 'markdown' }
    }
    return null
  }, [activePath, activeText])

  const webpageWorkspaceMeta = React.useMemo(() => {
    if (!activePath) return null
    if (!isMarkdownPath(activePath)) return null
    const t = String(activeText || '')
    if (!t.startsWith('---')) return null
    return parseWebpageFrontmatterMeta(t)
  }, [activePath, activeText])

  const [pdfWorkspaceViewerTextOverride, setPdfWorkspaceViewerTextOverride] = React.useState<string | null>(null)
  const [webpageWorkspaceEditorTextOverride, setWebpageWorkspaceEditorTextOverride] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (layoutMode !== 'viewer' && layoutMode !== 'split') {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    if (!pdfWorkspaceMeta) {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchPdfWorkspaceDoc({
          docId: pdfWorkspaceMeta.docId,
          mode: pdfWorkspaceMeta.mode,
          outputDirRel: pdfWorkspaceMeta.outputDirRel,
        })
        if (cancelled) return
        if (res.ok !== true) {
          setPdfWorkspaceViewerTextOverride(null)
          return
        }
        setPdfWorkspaceViewerTextOverride(String(res.markdown || ''))
      } catch {
        if (cancelled) return
        setPdfWorkspaceViewerTextOverride(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [layoutMode, pdfWorkspaceMeta])

  React.useEffect(() => {
    if (!webpageWorkspaceMeta || webpageWorkspaceMeta.view !== 'json' || !webpageWorkspaceMeta.url) {
      setWebpageWorkspaceEditorTextOverride(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
        const res = await fetchWebpageMarkdown(webpageWorkspaceMeta.url, { emit: 'json', includeImages, signal: controller.signal })
        if (cancelled) return
        if (!res) {
          setWebpageWorkspaceEditorTextOverride(JSON.stringify({ ok: false, error: 'Request failed' }, null, 2))
          return
        }
        if (res.ok !== true) {
          setWebpageWorkspaceEditorTextOverride(JSON.stringify({ ok: false, error: String(res.error || 'Conversion failed') }, null, 2))
          return
        }
        const jsonText = res.conversionJsonText || JSON.stringify({ ok: true, name: res.name }, null, 2)
        setWebpageWorkspaceEditorTextOverride(jsonText)
      } catch {
        if (cancelled) return
        setWebpageWorkspaceEditorTextOverride(JSON.stringify({ ok: false, error: 'Request failed' }, null, 2))
      }
    })()
    return () => {
      cancelled = true
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [webpageWorkspaceMeta])

  const switchActivePdfWorkspaceMode = React.useCallback(
    async (mode: PdfConversionMode) => {
      if (!activePath || !pdfWorkspaceMeta) return
      setStatusProgress('Loading PDF')
      try {
        const res = await fetchPdfWorkspaceDoc({ docId: pdfWorkspaceMeta.docId, mode, outputDirRel: pdfWorkspaceMeta.outputDirRel })
        if (res.ok !== true) {
          setStatusError(res.error)
          return
        }

        const markdownRaw = String(res.markdown || '')
        setPdfWorkspaceViewerTextOverride(markdownRaw)

        const sanitized = sanitizeImportedMarkdownText(markdownRaw)
        const notice = sanitized.changed ? `> Embedded base64 image data omitted for editor readability.\n\n` : ''
        const frontmatter = `---\nkgPdfWorkspaceDocId: "${pdfWorkspaceMeta.docId}"\nkgPdfWorkspaceMode: "${mode}"\nkgPdfWorkspaceOutputDirRel: "${pdfWorkspaceMeta.outputDirRel}"\n---\n\n`
        const nextText = `${frontmatter}${notice}${sanitized.text}`

        const fs = await getFs()
        await fs.writeFileText(activePath, nextText)
        lastLoadedRef.current = { path: activePath, text: nextText }
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = nextText.length <= maxInline ? nextText : undefined
        setEntries(prev => prev.map(e => (e.path === activePath ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        setActiveTextProgrammatic(nextText)
        const docKey = workspaceDocumentKey(activePath)
        if (docKey) setMarkdownDocument(docKey, nextText)
        setStatusWithAutoClear('Loaded', 1200)
      } catch (e) {
        setStatusError(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [activePath, getFs, pdfWorkspaceMeta, setActiveTextProgrammatic, setEntries, setMarkdownDocument, setStatusError, setStatusProgress, setStatusWithAutoClear],
  )

  const switchActiveYoutubeWorkspaceFormat = React.useCallback(
    async (format: 'markdown' | 'json') => {
      if (!activePath || !youtubeWorkspaceMeta) return
      setStatusProgress('Loading YouTube transcript')
      try {
        setPdfWorkspaceViewerTextOverride(null)
        const res = await fetchYouTubeTranscriptMarkdown(`https://youtu.be/${youtubeWorkspaceMeta.videoId}`)
        if (!res) {
          setStatusError('Request failed')
          return
        }
        if (res.ok !== true) {
          setStatusError(res.error)
          return
        }

        const frontmatter = `---\nkgYoutubeVideoId: "${youtubeWorkspaceMeta.videoId}"\nkgYoutubeFormat: "${format}"\n---\n\n`
        let nextText = ''

        if (format === 'json' && res.transcriptJsonText) {
          nextText = `${frontmatter}\`\`\`json\n${res.transcriptJsonText}\n\`\`\`\n`
        } else {
          nextText = `${frontmatter}${res.markdown}`
        }

        const fs = await getFs()
        await fs.writeFileText(activePath, nextText)
        lastLoadedRef.current = { path: activePath, text: nextText }
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = nextText.length <= maxInline ? nextText : undefined
        setEntries(prev => prev.map(e => (e.path === activePath ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        setActiveTextProgrammatic(nextText)
        const docKey = workspaceDocumentKey(activePath)
        if (docKey) setMarkdownDocument(docKey, nextText)
        setStatusWithAutoClear('Loaded', 1200)
      } catch (e) {
        setStatusError(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activePath,
      getFs,
      youtubeWorkspaceMeta,
      setActiveTextProgrammatic,
      setEntries,
      setMarkdownDocument,
      setStatusError,
      setStatusProgress,
      setStatusWithAutoClear,
    ],
  )

  const switchActiveWebpageWorkspaceView = React.useCallback(
    async (view: WebpageViewMode) => {
      if (!activePath || !webpageWorkspaceMeta) return
      try {
        setWebpageImportView(view)
        const nextText = upsertWebpageFrontmatterMeta(String(activeText || ''), { url: webpageWorkspaceMeta.url, view })
        const fs = await getFs()
        await fs.writeFileText(activePath, nextText)
        lastLoadedRef.current = { path: activePath, text: nextText }
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = nextText.length <= maxInline ? nextText : undefined
        setEntries(prev => prev.map(e => (e.path === activePath ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        setActiveTextProgrammatic(nextText)
        setStatusWithAutoClear('Updated', 1200)
      } catch (e) {
        setStatusError(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activePath,
      activeText,
      getFs,
      setActiveTextProgrammatic,
      setEntries,
      setStatusError,
      setStatusWithAutoClear,
      setWebpageImportView,
      webpageWorkspaceMeta,
    ],
  )

  const renderSourceFileRight = React.useCallback(
    (args: { entry: WorkspaceEntry; isActive: boolean }) => {
      if (!args.isActive) return null

      if (youtubeWorkspaceMeta) {
        return (
          <WorkspaceModeSelect<'markdown' | 'json'>
            ariaLabel="YouTube transcript format"
            value={youtubeWorkspaceMeta.format as 'markdown' | 'json'}
            isActive={args.isActive}
            options={[
              { value: 'markdown', label: 'Markdown' },
              { value: 'json', label: 'JSON' },
            ]}
            onChange={next => void switchActiveYoutubeWorkspaceFormat(next)}
          />
        )
      }

      if (webpageWorkspaceMeta) {
        return (
          <WorkspaceModeSelect<WebpageViewMode>
            ariaLabel="Webpage view mode"
            value={webpageWorkspaceMeta.view}
            isActive={args.isActive}
            options={[
              { value: 'markdown', label: 'Markdown' },
              { value: 'json', label: 'JSON' },
              { value: 'html', label: 'HTML' },
            ]}
            onChange={next => void switchActiveWebpageWorkspaceView(next)}
          />
        )
      }

      if (!pdfWorkspaceMeta) return null
      return (
        <WorkspaceModeSelect<'text-only' | 'image-heavy' | 'scan-ocr'>
          ariaLabel="PDF conversion mode"
          value={pdfWorkspaceMeta.mode}
          isActive={args.isActive}
          options={[
            { value: 'text-only', label: 'text-only' },
            { value: 'image-heavy', label: 'image-heavy' },
            { value: 'scan-ocr', label: 'scan/OCR' },
          ]}
          onChange={next => {
            handleSetPdfImportConversionMode(next)
            void switchActivePdfWorkspaceMode(next)
          }}
        />
      )
    },
    [
      handleSetPdfImportConversionMode,
      pdfWorkspaceMeta,
      switchActivePdfWorkspaceMode,
      switchActiveWebpageWorkspaceView,
      youtubeWorkspaceMeta,
      switchActiveYoutubeWorkspaceFormat,
      webpageWorkspaceMeta,
    ],
  )

  React.useEffect(() => {
    onCopyNodeQuickEditorRef.current = () => {
      const text = contentMode === 'nodeQuickEditor' ? quickEditorEditorText : ''
      if (!text) return
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        setStatusWithAutoClear('Clipboard not available', 2000)
        return
      }
      void navigator.clipboard
        .writeText(text)
        .then(() => setStatusWithAutoClear('Copied', 1200))
        .catch(() => setStatusWithAutoClear('Copy failed', 2200))
    }
  }, [contentMode, quickEditorEditorText, setStatusWithAutoClear])

  React.useEffect(() => {
    void refresh()
  }, [refresh])


  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      setActivePath(normalized)
    },
    [setActivePath],
  )

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    setSelectionPath(normalizeWorkspacePath(path))
  }, [])


  const pendingExternalRefreshRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      const active = activePathRef.current
      const last = lastLoadedRef.current
      const isDirty = !!(active && last?.path === active && last.text !== activeTextRef.current)
      const changedPath = typeof detail?.path === 'string' && detail.path ? detail.path : null
      if (isDirty && (!changedPath || changedPath === active)) return

      if (pendingExternalRefreshRef.current != null) {
        try {
          window.clearTimeout(pendingExternalRefreshRef.current)
        } catch {
          void 0
        }
      }
      pendingExternalRefreshRef.current = window.setTimeout(() => {
        pendingExternalRefreshRef.current = null
        void refresh()
      }, 180)
    })
    return () => {
      if (pendingExternalRefreshRef.current != null) {
        try {
          window.clearTimeout(pendingExternalRefreshRef.current)
        } catch {
          void 0
        }
        pendingExternalRefreshRef.current = null
      }
      unsubscribe()
    }
  }, [refresh])

  React.useEffect(() => {
    lsSetInt(LS_KEYS.markdownSidebarWidthPx, sidebarWidthPx, { min: SIDEBAR_MIN_PX, max: SIDEBAR_MAX_PX })
  }, [sidebarWidthPx])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, sourceFilesCollapsed)
  }, [sourceFilesCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerOutlineCollapsed, tocCollapsed)
  }, [tocCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownExplorerBacklinksCollapsed, backlinksCollapsed)
  }, [backlinksCollapsed])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownWordWrap, markdownWordWrap)
  }, [markdownWordWrap])

  React.useEffect(() => {
    lsSetBool(LS_KEYS.markdownTextHighlight, markdownTextHighlight)
  }, [markdownTextHighlight])

  React.useEffect(() => {
    lsSetJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, layoutMode)
  }, [layoutMode])

  React.useEffect(() => {
    lsSetJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [...expandedPaths])
  }, [expandedPaths])

  React.useEffect(() => {
    if (!highlightedLineRange) return
    const id = window.setTimeout(() => setHighlightedLineRange(null), 1500)
    return () => window.clearTimeout(id)
  }, [highlightedLineRange])

  const sidebarWidthPxRef = React.useRef(sidebarWidthPx)
  React.useEffect(() => {
    sidebarWidthPxRef.current = sidebarWidthPx
  }, [sidebarWidthPx])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = sidebarWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = mv.clientX - startX
          const next = Math.max(SIDEBAR_MIN_PX, Math.min(SIDEBAR_MAX_PX, Math.round(startWidth + dx)))
          pending = next
          setSidebarWidthPx(next)
        },
        onEnd: () => setSidebarWidthPx(pending),
        onCancel: () => setSidebarWidthPx(pending),
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])

  const filteredEntries = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return entries
    const keepPaths = new Set<string>()
    for (const e of entries) {
      if (e.kind !== 'file') continue
      if (String(e.name || '').toLowerCase().includes(q) || String(e.text || '').toLowerCase().includes(q)) {
        keepPaths.add(e.path)
      }
    }
    const result: WorkspaceEntry[] = []
    for (const e of entries) {
      if (e.kind === 'folder') {
        result.push(e)
        continue
      }
      if (keepPaths.has(e.path)) result.push(e)
    }
    return result
  }, [entries, search])

  React.useEffect(() => {
    if (!selectionPathRef.current && activePath) {
      setSelectionPath(activePath)
    }
  }, [activePath])

  React.useEffect(() => {
    if (!selectionPath) return
    if (loading) return
    if (entries.some(e => e.path === selectionPath)) return
    if (activePath && entries.some(e => e.path === activePath)) {
      setSelectionPath(activePath)
      return
    }
    setSelectionPath(null)
  }, [activePath, entries, loading, selectionPath])

  const activeEntry = React.useMemo(() => {
    if (!activePath) return null
    return entries.find(e => e.path === activePath) || null
  }, [activePath, entries])

  const selectionEntry = React.useMemo(() => {
    const path = selectionPath
    if (!path) return null
    return entries.find(e => e.path === path) || null
  }, [entries, selectionPath])

  const activeEntryKind = activeEntry ? activeEntry.kind : null
  const activeEntryIsFile = activeEntry?.kind === 'file'
  const activeEntryText = activeEntry && activeEntry.kind === 'file' ? activeEntry.text : undefined
  const activeDocumentKey = React.useMemo(() => {
    if (!activePath) return ''
    if (activeEntry && activeEntry.kind !== 'file') return ''
    return workspaceDocumentKey(activePath)
  }, [activeEntry, activePath])

  React.useEffect(() => {
    const path = activePath
    if (!path) return

    const prev = prevCollapsedRef.current
    if (prev !== effectiveBottomPanelCollapsed) {
      prevCollapsedRef.current = effectiveBottomPanelCollapsed
      if (effectiveBottomPanelCollapsed) {
        collapsedSnapshotRef.current = { path, text: activeText }
        return
      }

      const snap = collapsedSnapshotRef.current
      const candidate =
        snap && snap.path === path && String(snap.text || '').trim()
          ? snap.text
          : (() => {
              const last = lastLoadedRef.current
              if (!last || last.path !== path) return ''
              return last.text
            })()

      if (String(activeText || '').trim()) return
      if (!String(candidate || '').trim()) return
      setActiveText(candidate)
      if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(candidate, 'markdown'), { autoEnableFrontmatter: false })
      return
    }

    if (!effectiveBottomPanelCollapsed) return
    if (String(activeText || '').trim()) {
      collapsedSnapshotRef.current = { path, text: activeText }
      return
    }
    const snap = collapsedSnapshotRef.current
    if (!snap || snap.path !== path) return
    if (!String(snap.text || '').trim()) return
    setActiveText(snap.text)
    if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(snap.text, 'markdown'), { autoEnableFrontmatter: false })
  }, [
    activeDocumentKey,
    activePath,
    activeText,
    effectiveBottomPanelCollapsed,
    setMarkdownDocument,
  ])

  React.useEffect(() => {
    if (effectiveBottomPanelCollapsed) return
    const path = activePath
    if (!path) return
    if (String(activeText || '').trim()) return

    const last = lastLoadedRef.current
    if (last && last.path === path && String(last.text || '').trim()) {
      setActiveText(last.text)
      if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(last.text, 'markdown'), { autoEnableFrontmatter: false })
      return
    }

    void (async () => {
      try {
        const fs = await getFs()
        const text = await fs.readFileText(path)
        const next = typeof text === 'string' ? text : ''
        if (!next.trim()) return
        lastLoadedRef.current = { path, text: next }
        setActiveText(next)
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(next, 'markdown'), { autoEnableFrontmatter: false })
      } catch {
        void 0
      }
    })()
  }, [activeDocumentKey, activePath, activeText, effectiveBottomPanelCollapsed, getFs, setMarkdownDocument])

  const createParentPath = React.useMemo<WorkspacePath>(() => {
    if (!selectionEntry) return WORKSPACE_ROOT_PATH
    if (selectionEntry.kind === 'folder') return selectionEntry.path
    if (selectionEntry.parentPath) return selectionEntry.parentPath
    return WORKSPACE_ROOT_PATH
  }, [selectionEntry])

  const isEditing = layoutMode === 'editor' || layoutMode === 'split'
  const isMarkdown = isMarkdownPath(activePath)

  React.useEffect(() => {
    if (!entries.length) return
    if (loading) return

    if (activePath && entries.some(e => e.path === activePath)) return

    const recent = lastRequestedActivePathRef.current
    const storeRecent = lastSetActivePath
    const isRecentlyRequested = (req: { path: WorkspacePath; atMs: number } | null) =>
      !!(activePath && req?.path === activePath && Date.now() - req.atMs < 2000)
    if (isRecentlyRequested(recent) || isRecentlyRequested(storeRecent)) return

    const firstFile = entries.find(e => e.kind === 'file')
    if (!firstFile) return
    if (!activePath) {
      setActivePathSafe(firstFile.path)
      return
    }
    setActivePathSafe(firstFile.path)
  }, [activePath, entries, lastSetActivePath, loading, setActivePathSafe])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (!activeEntry) return
    if (activeEntry.kind !== 'folder') return
    if (activePathRef.current !== path) return
    setActiveTextProgrammatic('')
    setHighlightedLineRange(null)
    setStatusLabel(null)
  }, [activeEntry, activePath, setMarkdownDocument, setMarkdownDocumentSourceUrl])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return

    const scheduledFor = path

    const lastLoaded = lastLoadedRef.current
    const isDirty = !!(
      userEditedActiveTextRef.current &&
      lastLoaded &&
      lastLoaded.path === path &&
      lastLoaded.text !== activeTextRef.current
    )
    if (isDirty) return

    const cachedText = typeof activeEntryText === 'string' ? String(activeEntryText ?? '') : null
    const source = sourcesByPath[path]
    const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    setMarkdownDocumentSourceUrl(sourceUrl ? sourceUrl : null)

    const pendingLocalImport = peekPendingWorkspaceLocalImport(path)
    const indexLabel = pendingLocalImport?.kind === 'pdf' ? 'Indexing PDF' : 'Indexing'
    const bytesTotalHint = pendingLocalImport ? Math.max(0, Number(pendingLocalImport.file?.size || 0)) : null

    const canTrustEmptyCache = !!(cachedText === '' && lastLoaded && lastLoaded.path === path && lastLoaded.text === '')
    const isPendingStub = cachedText != null && isPendingLocalImportStubText(cachedText)
    const canUseCachedText =
      cachedText != null &&
      (cachedText !== '' || canTrustEmptyCache) &&
      !(pendingLocalImport && (cachedText === '' || isPendingStub))

    let cancelled = false
    void (async () => {
      let loadingLabelTimer: number | null = null
      try {
        const label = indexLabel
        const bytesTotal = bytesTotalHint
        loadingLabelTimer = window.setTimeout(() => {
          if (bytesTotal && bytesTotal > 0) {
            setStatusProgress(label, 1, 1, 0, bytesTotal)
            return
          }
          setStatusProgress(label)
        }, 140)
      } catch {
        void 0
      }
      try {
        const text = await (async () => {
          if (canUseCachedText) return cachedText as string
          const fs = await getFs()
          const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path })
          return hydrated ? hydrated.text : await fs.readFileText(path)
        })()
        if (cancelled) return
        if (activePathRef.current !== scheduledFor) return
        if (text == null) {
          setStatusError('Load failed: Missing file contents')
          return
        }
        const rawNext = String(text)
        const sanitized = (() => {
          if (!rawNext) return null
          if (!rawNext.includes('kgWebpageUrl') && !rawNext.includes('data:image/')) return null
          const res = sanitizeImportedMarkdownText(rawNext)
          return res.changed ? res.text : null
        })()
        const next = sanitized ?? rawNext
        if (sanitized) {
          try {
            const fs = await getFs()
            await fs.writeFileText(path, sanitized)
          } catch {
            void 0
          }
        }
        lastLoadedRef.current = { path, text: next }
        setActiveTextProgrammatic(next)
        if (sanitized && canUseCachedText) {
          const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
          const inlineText = next.length <= maxInline ? next : undefined
          setEntries(prev => prev.map(e => (e.path === path && e.kind === 'file' ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        }
        if (!canUseCachedText) {
          const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
          const inlineText = next.length <= maxInline ? next : undefined
          setEntries(prev => {
            const idx = prev.findIndex(e => e.path === path)
            if (idx >= 0) {
              const current = prev[idx]
              if (current.kind !== 'file') return prev
              if (current.text === inlineText) return prev
              const nextEntries = prev.slice()
              nextEntries[idx] = { ...current, text: inlineText }
              return nextEntries
            }
            const normalized = normalizeWorkspacePath(path)
            const parts = normalized.replace(/^\/+/, '').split('/').filter(Boolean)
            const name = parts[parts.length - 1] || ''
            const parent = parts.length <= 1 ? WORKSPACE_ROOT_PATH : normalizeWorkspacePath(parts.slice(0, -1).join('/'))
            const nextEntries = prev.slice()
            nextEntries.push({
              path: normalized,
              parentPath: parent,
              kind: 'file',
              name,
              text: inlineText,
              updatedAtMs: Date.now(),
            } satisfies WorkspaceEntry)
            nextEntries.sort((a, b) => a.path.localeCompare(b.path))
            return nextEntries
          })
        }
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(next, 'markdown'), { autoEnableFrontmatter: false })

        if (activeDocumentKey && next.trim()) {
          const hash = hashStringToHex(next)
          const last = lastIndexedRef.current
          if (!(last && last.path === path && last.textHash === hash)) {
            const jobId = ++indexJobRef.current
            if (bytesTotalHint && bytesTotalHint > 0) {
              setStatusProgress(indexLabel, 1, 1, bytesTotalHint, bytesTotalHint)
            } else {
              setStatusProgress(indexLabel, 1, 1)
            }
            const store = useGraphStore.getState()
            const workspaceSourcePath = `workspace:${path}`
            const fileId = (() => {
              const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
              const existing = current.find(f => String(f?.source?.path || '') === workspaceSourcePath) || null
              if (existing) return existing.id
              const id = `ws:${hashStringToHex(workspaceSourcePath)}`
              const url = sourceUrl ? sourceUrl : undefined
              const source = url ? ({ kind: 'url', url, path: workspaceSourcePath } as const) : ({ kind: 'local', path: workspaceSourcePath } as const)
              const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
              const text = next.length <= maxInline ? next : ''
              store.addSourceFile({
                id,
                name: String(activeEntry?.name || ''),
                text,
                enabled: true,
                status: 'idle',
                source,
              })
              return id
            })()

            try {
              store.updateSourceFile(fileId, {
                name: String(activeEntry?.name || ''),
                text: next.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? next : '',
                enabled: true,
                status: 'loading',
                error: undefined,
              })
            } catch {
              void 0
            }

            const existing = (() => {
              const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
              return current.find(f => f.id === fileId) || null
            })()

            const cachedGraph = existing?.parsedGraphData
            const cachedHash = typeof existing?.parsedTextHash === 'string' ? existing.parsedTextHash : ''

            const isGeoCandidate = (() => {
              const lower = String(path || '').toLowerCase()
              if (lower.endsWith('.geojson')) return true
              if (lower.endsWith('.json')) return true
              return false
            })()

            const geoGraph = (() => {
              if (!isGeoCandidate) return null
              try {
                const fc = parseGeoJsonFromText(next)
                const normalized = coerceGeoJsonToFeatureCollection(fc)
                return buildGraphDataFromFeatureCollection({
                  featureCollection: normalized,
                  sourcePath: path,
                  sourceHash: hash,
                })
              } catch {
                void 0
              }
              try {
                const parsed = JSON.parse(next) as unknown
                const records = Array.isArray(parsed) ? parsed : null
                if (!records) return null
                const fc = recordsToPointFeatureCollection(records)
                const normalized = coerceGeoJsonToFeatureCollection(fc)
                return buildGraphDataFromFeatureCollection({
                  featureCollection: normalized,
                  sourcePath: path,
                  sourceHash: hash,
                })
              } catch {
                return null
              }
            })()

            if (geoGraph) {
              try {
                store.setGraphData(geoGraph)
              } catch {
                void 0
              }
              try {
                store.updateSourceFile(fileId, {
                  status: 'parsed',
                  error: undefined,
                  parsedParserId: 'geojson',
                  parsedTextHash: hash,
                  parsedGraphData: geoGraph,
                })
              } catch {
                void 0
              }
              if (cancelled) return
              if (activePathRef.current !== scheduledFor) return
              if (indexJobRef.current !== jobId) return
              lastIndexedRef.current = { path, textHash: hash }
              return
            }

            if (cachedGraph && cachedHash === hash) {
              try {
                store.setGraphData(cachedGraph)
              } catch {
                void 0
              }
              try {
                store.updateSourceFile(fileId, {
                  status: 'parsed',
                  error: undefined,
                })
              } catch {
                void 0
              }
            } else {
              const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
              const res = await loadGraphDataFromTextViaParser(activeDocumentKey, next, { applyToStore: false })
              const gd = res?.graphData || null
              if (gd) {
                try {
                  store.setGraphData(gd)
                } catch {
                  void 0
                }
                try {
                  store.updateSourceFile(fileId, {
                    status: 'parsed',
                    error: undefined,
                    parsedParserId: typeof res?.parserId === 'string' ? res!.parserId : undefined,
                    parsedTextHash: hash,
                    parsedGraphData: gd,
                  })
                } catch {
                  void 0
                }
              } else {
                try {
                  store.updateSourceFile(fileId, { status: 'error', error: 'Parser returned empty graph' })
                } catch {
                  void 0
                }
              }
            }
            if (cancelled) return
            if (activePathRef.current !== scheduledFor) return
            if (indexJobRef.current !== jobId) return
            lastIndexedRef.current = { path, textHash: hash }
          }
        }

        setStatusWithAutoClear('Indexed')
      } catch (e) {
        if (cancelled) return
        if (activePathRef.current !== scheduledFor) return
        setStatusError(`Load failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      } finally {
        if (loadingLabelTimer != null) window.clearTimeout(loadingLabelTimer)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    activeDocumentKey,
    activeEntry,
    activeEntryKind,
    activeEntryIsFile,
    activeEntryText,
    activePath,
    getFs,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    setStatusWithAutoClear,
    setStatusLabel,
    setActiveText,
    setEntries,
    sourcesByPath,
  ])

  React.useEffect(() => {
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return
    const last = lastLoadedRef.current
    if (!userEditedActiveTextRef.current) return
    if (!shouldAutosaveWorkspaceFile({ path, lastLoaded: last, activeText, debouncedText })) return
    void (async () => {
      try {
        setStatusProgress('Saving')
        const fs = await getFs()
        await fs.writeFileText(path, debouncedText)
        lastLoadedRef.current = { path, text: debouncedText }
        const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
        const inlineText = debouncedText.length <= maxInline ? debouncedText : undefined
        setEntries(prev => prev.map(e => (e.path === path ? { ...e, text: inlineText, updatedAtMs: Date.now() } : e)))
        if (activeDocumentKey) setMarkdownDocument(activeDocumentKey, normalizeWebpageFrontmatterView(debouncedText, 'markdown'), { autoEnableFrontmatter: false })
        try {
          const store = useGraphStore.getState()
          const wsPath = `workspace:${path}`
          const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
          const existing = current.find(f => String(f?.source?.path || '') === wsPath) || null
          if (existing) {
            store.updateSourceFile(existing.id, {
              text: inlineText ?? '',
              status: 'idle',
              error: undefined,
              parsedParserId: undefined,
              parsedTextHash: undefined,
              parsedGraphData: undefined,
            })
          }
        } catch {
          void 0
        }
        if (path === ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH) {
          try {
            setGraphRagWorkflowJsonText(debouncedText)
          } catch {
            void 0
          }
        }
        if (path === PARSER_SCRIPT_WORKSPACE_PATH) {
          try {
            useParserUIState.getState().setScriptText(debouncedText)
          } catch {
            void 0
          }
        }
        if (path === SCHEMA_CONFIG_WORKSPACE_PATH) {
          try {
            const next = parseSchemaText(debouncedText)
            const store = useGraphStore.getState()
            store.setSchema(next)
            store.setSchemaOpStatus(true, 'Applied schema from workspace file')
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err ?? '')
            try {
              useGraphStore.getState().setSchemaOpStatus(false, `Schema parse failed: ${msg}`)
            } catch {
              void 0
            }
          }
        }
        setStatusWithAutoClear('Saved')
      } catch (e) {
        setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    })()
  }, [
    activeDocumentKey,
    activeEntryKind,
    activePath,
    activeText,
    debouncedText,
    getFs,
    setGraphRagWorkflowJsonText,
    setMarkdownDocument,
    setStatusWithAutoClear,
    setStatusError,
    setEntries,
  ])

  React.useEffect(() => {
    if (!requestedRevealLine) return
    const el = editorRef.current
    if (!el) return
    const line = Math.max(1, Math.floor(requestedRevealLine))
    const text = String(activeTextRef.current || '')
    let offset = 0
    let currentLine = 1
    while (currentLine < line && offset < text.length) {
      const nextNewline = text.indexOf('\n', offset)
      if (nextNewline < 0) {
        offset = text.length
        break
      }
      offset = nextNewline + 1
      currentLine += 1
    }
    try {
      el.focus()
      el.setSelectionRange(offset, offset)
      const computed = window.getComputedStyle(el)
      const lineHeightRaw = computed.lineHeight
      const lineHeight = Number.isFinite(Number.parseFloat(lineHeightRaw)) ? Number.parseFloat(lineHeightRaw) : 18
      el.scrollTop = Math.max(0, (line - 1) * Math.max(10, Math.min(40, lineHeight)))
    } catch {
      void 0
    }
    requestRevealLine(null)
  }, [requestRevealLine, requestedRevealLine])

  const revealLineInEditor = React.useCallback(
    (line: number, endLine?: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const start = Math.floor(line)
      const end = Number.isFinite(endLine) && (endLine as number) > 0 ? Math.max(start, Math.floor(endLine as number)) : start
      setHighlightedLineRange({ start, end })
      if (layoutMode !== 'split' && layoutMode !== 'editor') {
        setLayoutMode('split')
      }
      requestRevealLine(start)
    },
    [layoutMode, requestRevealLine, setLayoutMode],
  )

  useCanvasMarkdownSync({
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    layoutMode,
    setLayoutMode,
    revealLineInEditor,
    setStatusLabel,
  })

  const showInViewer = React.useCallback(
    (line: number) => {
      setLayoutMode('viewer')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const showInPresentation = React.useCallback(
    (line: number) => {
      setLayoutMode('presentation')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const showInSlidesGallery = React.useCallback(
    (line: number) => {
      setLayoutMode('slides-gallery')
      if (!Number.isFinite(line) || line <= 0) {
        setHighlightedLineRange(null)
        return
      }
      const v = Math.floor(line)
      setHighlightedLineRange({ start: v, end: v })
    },
    [setLayoutMode],
  )

  const matchesActiveDoc = React.useCallback(
    (documentPath: unknown) => {
      return matchesMarkdownDocumentPath(activeDocumentKey, documentPath)
    },
    [activeDocumentKey],
  )

  const lastCaretLineRef = React.useRef<number | null>(null)
  const onEditorCaretLine = React.useCallback(
    (line: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const v = Math.floor(line)
      if (lastCaretLineRef.current === v) return
      lastCaretLineRef.current = v
      setHighlightedLineRange({ start: v, end: v })
      if (!graphData) return

      const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
      for (const n of nodes) {
        const loc = getDocumentLocationFromMetadata(n?.metadata)
        if (!loc) continue
        if (!matchesActiveDoc(loc.documentPath)) continue
        const start = Math.max(1, Math.floor(loc.lineStart))
        const end = Math.max(start, Math.floor(loc.lineEnd || loc.lineStart))
        if (v < start || v > end) continue
        const id = String(n.id || '')
        if (!id) continue
        if (selectedNodeId === id) return
        setSelectionSource('editor')
        selectNode(id)
        return
      }

      const edges = Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : []
      for (const e of edges) {
        const loc = getDocumentLocationFromMetadata(e?.metadata)
        if (!loc) continue
        if (!matchesActiveDoc(loc.documentPath)) continue
        const start = Math.max(1, Math.floor(loc.lineStart))
        const end = Math.max(start, Math.floor(loc.lineEnd || loc.lineStart))
        if (v < start || v > end) continue
        const id = String(e.id || '')
        if (!id) continue
        if (selectedEdgeId === id) return
        setSelectionSource('editor')
        selectEdge(id)
        return
      }
    },
    [
      graphData,
      matchesActiveDoc,
      selectEdge,
      selectNode,
      selectedEdgeId,
      selectedNodeId,
      setSelectionSource,
    ],
  )

  const tocTokens = React.useMemo(() => {
    try {
      return lexMarkdown(outlineText).tokens
    } catch {
      return []
    }
  }, [outlineText])

  const onTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      try {
        const tokens = lexMarkdown(activeText).tokens
        const next = reorderMarkdownHeadings(activeText, tokens, parentId, fromIndex, toIndex)
        if (next === activeText) return
        setActiveText(next)
      } catch {
        void 0
      }
    },
    [activeText, setActiveText],
  )
  const backlinksJobRef = React.useRef(0)
  React.useEffect(() => {
    if (backlinksCollapsed || !activePath) {
      setBacklinks([])
      return
    }

    const jobId = ++backlinksJobRef.current
    const run = () => {
      if (backlinksJobRef.current !== jobId) return
      try {
        const next = computeBacklinks({ activePath, entries })
        if (backlinksJobRef.current !== jobId) return
        setBacklinks(next)
      } catch {
        if (backlinksJobRef.current !== jobId) return
        setBacklinks([])
      }
    }

    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(run, { timeout: 700 })
      return () => {
        try {
          w.cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }

    const t = window.setTimeout(run, 0)
    return () => window.clearTimeout(t)
  }, [activePath, backlinksCollapsed, entries])

  const toggleExpanded = React.useCallback((path: WorkspacePath) => {
    const normalized = normalizeWorkspacePath(path)
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(normalized)) next.delete(normalized)
      else next.add(normalized)
      return next
    })
  }, [])

  const onSelectFile = React.useCallback(
    (path: WorkspacePath) => {
      setActivePathSafe(path)
      setSelectionPathSafe(path)
    },
    [setActivePathSafe, setSelectionPathSafe],
  )

  const onSelectFolder = React.useCallback(
    (path: WorkspacePath) => {
      setSelectionPathSafe(path)
    },
    [setSelectionPathSafe],
  )

  const handleApply = React.useCallback(async () => {
    const name = String(activeDocumentKey || '').trim()
    if (!name) {
      setStatusError('No file selected')
      return
    }
    setStatusProgress('Applying')
    try {
      const ok = await applyMarkdownDocumentToGraph(name, activeText)
      const blocks = (() => {
        const text = String(activeText || '')
        if (!text.includes('```')) return []
        return extractFencedCodeBlocks(text)
          .filter(b => b.lang === 'geojson' || b.lang === 'json')
          .slice(0, 20)
      })()
      if (blocks.length > 0) {
        await Promise.all(
          blocks.map(b =>
            geoDatasetIntegration.registerGeoJsonFeatureCollection?.({
              sourceDocumentPath: name,
              codeBlock: {
                lang: b.lang === 'geojson' ? 'geojson' : 'json',
                text: b.content,
                startLine: b.startLine,
                endLine: b.endLine,
              },
            }),
          ),
        )
      }
      setStatusInfo(ok ? 'Applied' : 'Skipped')
    } catch (e) {
      setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [activeDocumentKey, activeText, applyMarkdownDocumentToGraph, geoDatasetIntegration, setStatusError, setStatusInfo, setStatusProgress])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const el = editorRef.current
      if (!el) return
      const startOffset = typeof el.selectionStart === 'number' ? el.selectionStart : activeText.length
      const endOffset = typeof el.selectionEnd === 'number' ? el.selectionEnd : activeText.length
      const selection = { startOffset, endOffset }
      const { nextText, nextSelection } = applyMarkdownFormatAction({ text: activeText, selection, action })
      setActiveText(nextText)
      const focusAndSelect = () => {
        const h = editorRef.current
        if (!h) return
        try {
          h.focus()
          h.setSelectionRange(nextSelection.startOffset, nextSelection.endOffset)
        } catch {
          void 0
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(focusAndSelect))
    },
    [activeText],
  )

  const toggleFullscreen = React.useCallback(() => {
    const el = workspaceRootRef.current
    if (!el) return
    try {
      const doc = document as Document & { fullscreenElement?: Element | null; exitFullscreen?: () => Promise<void> }
      if (doc.fullscreenElement) {
        void doc.exitFullscreen?.()
        return
      }
      const req = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
      void req?.call(el)
    } catch {
      void 0
    }
  }, [])

  const fileActions = useWorkspaceFileActions({
    getFs,
    refresh,
    setStatusLabel,
    openedPath: activePath,
    selectionPath,
    selectionEntryKind: selectionEntry?.kind ?? null,
    activeDocumentKey,
    setActiveText: setActiveTextProgrammatic,
    setEntries,
    lastLoadedRef,
    setExpandedPaths,
    setActivePathSafe,
    setSelectionPathSafe,
    setMarkdownDocument,
    setMarkdownDocumentSourceUrl,
    applyMarkdownDocumentToGraph,
  })

  const canRefreshActiveFromSource = React.useMemo(() => {
    if (!selectionPath || selectionEntry?.kind !== 'file') return false
    const src = sourcesByPath ? sourcesByPath[selectionPath] : null
    return !!(src && src.kind === 'url' && String((src as { url?: unknown }).url || '').trim())
  }, [selectionEntry, selectionPath, sourcesByPath])

  const openBacklink = React.useCallback(
    (args: { path: WorkspacePath; line: number }) => {
      setActivePathSafe(args.path)
      setSelectionPathSafe(args.path)
      revealLineInEditor(args.line)
    },
    [revealLineInEditor, setActivePathSafe, setSelectionPathSafe],
  )

  const editorUri = activePath ? `inmemory://workspace/${encodeURIComponent(workspaceDocumentKey(activePath) || 'document')}` : 'inmemory://model/empty'
  const editorLanguage = activePath ? languageForPath(activePath) : 'markdown'

  const showGraphTable = workspaceViewMode === 'editor' && editorWorkspaceSection === 'graphTable'

  const effectiveActiveText = contentMode === 'nodeQuickEditor' ? quickEditorEditorText : activeText
  const effectiveSetActiveText = React.useCallback(
    (next: string) => {
      if (contentMode === 'nodeQuickEditor') return
      userEditedActiveTextRef.current = true
      setActiveText(next)
    },
    [contentMode],
  )
  const effectiveViewerTextOverride = contentMode === 'nodeQuickEditor' && nodeQuickEditorFormat === 'json' ? quickEditorViewerText : null
  const combinedViewerTextOverride = effectiveViewerTextOverride || pdfWorkspaceViewerTextOverride
  const webpageJsonModeActive = contentMode !== 'nodeQuickEditor' && webpageWorkspaceMeta?.view === 'json'
  const effectiveEditorTextOverride = contentMode === 'nodeQuickEditor' ? null : webpageWorkspaceEditorTextOverride
  const effectiveIsEditing = contentMode !== 'nodeQuickEditor' && isEditing && !webpageJsonModeActive
  const effectiveIsMarkdown = contentMode !== 'nodeQuickEditor' && isMarkdown

  return (
    <section
      ref={workspaceRootRef}
      className={`flex-1 w-full h-full min-h-0 flex overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Markdown Workspace"
    >
      <MarkdownWorkspaceExplorer
        uiPanelTextFontClass={uiPanelTextFontClass}
        sidebarWidthPx={sidebarWidthPx}
        sidebarWidthMinPx={SIDEBAR_MIN_PX}
        sidebarWidthMaxPx={SIDEBAR_MAX_PX}
        entries={entries}
        filteredEntries={filteredEntries}
        sourcesByPath={sourcesByPath}
        loading={loading}
        loadError={loadError}
        expandedPaths={expandedPaths}
        toggleExpanded={toggleExpanded}
        activePath={selectionPath || activePath}
        onSelectFile={onSelectFile}
        onSelectFolder={onSelectFolder}
        search={search}
        setSearch={setSearch}
        sourceFilesCollapsed={sourceFilesCollapsed}
        setSourceFilesCollapsed={setSourceFilesCollapsed}
        tocCollapsed={tocCollapsed}
        setTocCollapsed={setTocCollapsed}
        backlinksCollapsed={backlinksCollapsed}
        setBacklinksCollapsed={setBacklinksCollapsed}
        tocTokens={tocTokens}
        backlinks={backlinks}
        onRevealLine={revealLineInEditor}
        onOpenBacklink={openBacklink}
        onTocReorder={onTocReorder}
        onCreateNewFile={() => void fileActions.createNewFile({ parentPath: createParentPath })}
        onCreateNewFolder={() => void fileActions.createNewFolder({ parentPath: createParentPath })}
        onRefresh={() => void refresh()}
        statusLabel={statusLabel}
        activeEntryName={selectionEntry?.name || ''}
        activeEntryKind={selectionEntry?.kind || ''}
        canClearActiveSelection={fileActions.canClearActiveSelection}
        onClearActiveSelection={fileActions.onClearActiveSelection}
        canRefreshActiveFromSource={canRefreshActiveFromSource}
        onRefreshActiveFromSource={() => {
          if (!selectionPath || selectionEntry?.kind !== 'file') return
          void fileActions.refreshFileFromSource(selectionPath)
        }}
        canDeleteActive={fileActions.canDeleteActive}
        onDeleteActive={fileActions.onDeleteActive}
        renderSourceFileRight={renderSourceFileRight}
      />

      <VerticalResizeSeparatorHr ref={resizeHandleRef} ariaLabel="Resize explorer" />

      {showGraphTable ? (
        <React.Suspense fallback={null}>
          <GraphTableWorkspaceLazy />
        </React.Suspense>
      ) : (
        <MarkdownWorkspaceMain
          themeMode={themeMode}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
          geoDatasetIntegration={geoDatasetIntegration}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          markdownWordWrap={markdownWordWrap}
          setMarkdownWordWrap={setMarkdownWordWrap}
          markdownTextHighlight={markdownTextHighlight}
          setMarkdownTextHighlight={setMarkdownTextHighlight}
          statusLabel={statusLabel}
          onApply={() => void handleApply()}
          onToggleFullscreen={toggleFullscreen}
          presentationApiRef={presentationApiRef}
          contentMode={contentMode}
          setContentMode={setContentModeSafe}
          nodeQuickEditorAvailable={nodeQuickEditorAvailable}
          nodeQuickEditorFormat={nodeQuickEditorFormat}
          setNodeQuickEditorFormat={setNodeQuickEditorFormat}
          onCopyNodeQuickEditor={onCopyNodeQuickEditor}
          isEditing={effectiveIsEditing}
          isMarkdown={effectiveIsMarkdown}
          onFormatAction={handleFormatAction}
          onImportLocalFiles={fileActions.handleImportLocalFiles}
          onImportLocalFolder={fileActions.handleImportLocalFolder}
          onImportUrl={fileActions.handleImportUrl}
          activeText={effectiveActiveText}
          setActiveText={effectiveSetActiveText}
          editorTextOverride={effectiveEditorTextOverride}
          disableEditorMutations={!!effectiveEditorTextOverride}
          viewerTextOverride={combinedViewerTextOverride}
          disableViewerMutations={contentMode === 'nodeQuickEditor'}
          activeDocumentKey={activeDocumentKey}
          highlightedLineRange={highlightedLineRange}
          revealLineInEditor={revealLineInEditor}
          showInViewer={showInViewer}
          showInPresentation={showInPresentation}
          showInSlidesGallery={showInSlidesGallery}
          editorUri={editorUri}
          editorLanguage={editorLanguage}
          editorRef={editorRef}
          onEditorCaretLine={onEditorCaretLine}
        />
      )}
    </section>
  )
}
