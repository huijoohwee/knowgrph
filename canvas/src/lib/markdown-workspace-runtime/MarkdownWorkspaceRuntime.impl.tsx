import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { LS_KEYS, WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import type { WorkspaceBacklink, WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import {
  WORKSPACE_ROOT_PATH,
  normalizeWorkspacePath,
  workspaceBasename,
  workspaceDocumentKey,
  workspaceExtLower,
  workspaceStem,
} from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'
import { parseMarkdownWorkspaceLayoutMode, type MarkdownWorkspaceLayoutMode } from '@/features/markdown-explorer/workspaceUi'
import { applyMarkdownFormatAction, type MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { HighlightedLineRange, MarkdownPresentationApi, MarkdownWorkspaceStatus } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceTypes'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { createMarkdownGeoDatasetIntegration } from '@/features/geospatial/markdownGeoDatasetIntegration'
import { extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { setGeospatialModeEnabled } from 'gympgrph'
import { MarkdownWorkspaceExplorer } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceExplorer'
import { MarkdownWorkspaceMain } from '@/components/BottomPanel/markdownWorkspace/MarkdownWorkspaceMain'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX, isMarkdownPath, languageForPath } from '@/components/BottomPanel/markdownWorkspace/markdownWorkspaceUtils'
import { loadWorkspaceSourceIndex, setWorkspaceEntrySource } from '@/features/workspace-fs/sourceIndex'
import { useWorkspaceFileActions, useWorkspaceStatusHelpers } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions'
import { useCanvasMarkdownSync } from '@/components/BottomPanel/markdownWorkspace/useCanvasMarkdownSync'
import { useMarkdownEditorSsotSync } from '@/components/BottomPanel/markdownWorkspace/useMarkdownEditorSsotSync'
import { subscribeWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { shouldAutosaveWorkspaceFile } from '@/components/BottomPanel/markdownWorkspace/workspaceAutosave'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'

const MARKDOWN_LAYOUT_REQUEST_EVENT = 'kg:markdown-workspace-layout-request'
import { reorderMarkdownHeadings } from '@/features/markdown/ui/markdownSectionUtils'
import { runInIdle } from '@/features/panels/utils/idle'
import { matchesMarkdownDocumentPath } from 'grph-shared/markdown/documentPath'
import { buildDocLocationIndex } from '@/features/markdown-explorer/docLocationIndex'
import { ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH } from '@/features/panels/utils/orchestratorWorkspaceFiles'
import { PARSER_SCRIPT_WORKSPACE_PATH } from '@/features/panels/utils/parserWorkspaceFiles'
import { SCHEMA_CONFIG_WORKSPACE_PATH } from '@/features/panels/utils/schemaWorkspaceFiles'
import {
  cancelMarkdownWorkspaceAutosaveSync,
  cancelMarkdownWorkspaceIndexStart,
  cancelMarkdownWorkspaceInlineEditStateSync,
  cancelMarkdownWorkspacePrefsSync,
  cancelMarkdownWorkspaceRefreshSync,
  scheduleMarkdownWorkspaceAutosaveSync,
  scheduleMarkdownWorkspaceIndexStart,
  scheduleMarkdownWorkspaceInlineEditStateSync,
  scheduleMarkdownWorkspacePrefsSync,
  scheduleMarkdownWorkspaceRefreshSync,
} from './markdownWorkspaceRuntime.stateSync'
import { createProgressTicker } from '@/lib/progress/progressTicker'
import { useParserUIState } from '@/features/parsers/uiState'
import { parseSchemaText } from '@/features/schema/io'
import { fetchPdfWorkspaceDoc } from '@/lib/pdf/pdfWorkspaceClient'
import { fetchWebpageMarkdown, fetchYouTubeTranscriptMarkdown } from '@/lib/net/remoteMarkdownConversions'
import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { registerMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import {
  isFrontmatterOnlyDoc,
  normalizeWebpageFrontmatterView,
  parseWebpageFrontmatterMeta,
  parseWebsiteImportFrontmatterMeta,
  upsertWebpageFrontmatterMeta,
  type WebpageViewMode,
} from '@/lib/markdown/frontmatter'
import {
  fetchWebpageConversionJsonViaConvert,
  fetchWebsiteImportArtifact,
} from '@/lib/websites/webpageIframeSrcdoc'
import { websiteImportArtifactKindForWebpageView } from '@/lib/websites/websiteImportArtifactKind'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  isPendingLocalImportStubText,
  peekPendingWorkspaceLocalImport,
} from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
import { hashStringToHex } from '@/lib/hash/stringHash'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import { parsePdfWorkspaceFrontmatter } from '@/lib/pdf/pdfWorkspaceFrontmatter'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { tryBuildGeodataGraphDataFromJsonText } from '@/lib/graph/io/geodataJson'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
  resolveNodeQuickEditorRegistryEntry,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonText } from '@/lib/graph/io/nodeQuickEditorBundle'
import { WorkspaceModeSelect } from '@/components/BottomPanel/markdownWorkspace/WorkspaceModeSelect'

const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out = raw.map(v => String(v || '').trim()).filter(Boolean)
  return out
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

const EMPTY_NODE_QUICK_EDITOR_REGISTRY: NodeQuickEditorRegistryEntry[] = []
const EMPTY_GRAPH_NODES: GraphNode[] = []
const EMPTY_GRAPH_EDGES: GraphEdge[] = []
const EMPTY_TOC_TOKENS: TokenWithLines[] = []
const WORKSPACE_TOC_PARSE_MAX_CHARS = 320_000

export function MarkdownWorkspace(props: { active?: boolean } = {}) {
  const active = props.active !== false
  const activeRef = React.useRef(active)
  React.useEffect(() => {
    activeRef.current = active
  }, [active])
  const themeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const bottomPanelCollapsed = useGraphStore(s => s.bottomPanelCollapsed)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const effectiveBottomPanelCollapsed = workspaceViewMode === 'editor' ? false : bottomPanelCollapsed
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const applyMarkdownDocumentToGraph = useGraphStore(s => s.applyMarkdownDocumentToGraph)
  const setActiveMarkdownDocument = useGraphStore(s => s.setActiveMarkdownDocument)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const setGraphRagWorkflowJsonText = useGraphStore(s => s.setGraphRagWorkflowJsonText)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)

  const graphNodes = useGraphStore(s => ((s.graphData as GraphData | null)?.nodes as GraphNode[] | undefined) || EMPTY_GRAPH_NODES)
  const graphEdges = useGraphStore(s => ((s.graphData as GraphData | null)?.edges as GraphEdge[] | undefined) || EMPTY_GRAPH_EDGES)
  const graphContentRevision = useGraphStore(s => (s.graphContentRevision || 0) as number)
  const docLocationRevision = useGraphStore(s => (s.docLocationRevision || 0) as number)
  const nodeQuickEditorRegistry = useGraphStore(s => s.effectiveNodeQuickEditorRegistry ?? EMPTY_NODE_QUICK_EDITOR_REGISTRY)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])

  const activePath = useMarkdownExplorerStore(s => s.activePath)
  const setActivePath = useMarkdownExplorerStore(s => s.setActivePath)
  const requestedRevealLine = useMarkdownExplorerStore(s => s.requestedRevealLine)
  const requestRevealLine = useMarkdownExplorerStore(s => s.requestRevealLine)
  const lastAutoApplySigRef = React.useRef<string | null>(null)

  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [sourcesByPath, setSourcesByPath] = React.useState(() => loadWorkspaceSourceIndex())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>('')
  const [search, setSearch] = React.useState('')
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(() => lsInt(LS_KEYS.markdownSidebarWidthPx, 320))
  const [explorerOpen, setExplorerOpen] = React.useState(() => lsBool(LS_KEYS.markdownSidebarOpen, true))
  const [sourceFilesCollapsed, setSourceFilesCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, false))
  const [tocCollapsed, setTocCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerOutlineCollapsed, false))
  const [backlinksCollapsed, setBacklinksCollapsed] = React.useState(() => lsBool(LS_KEYS.markdownExplorerBacklinksCollapsed, false))
  const [markdownWordWrap, setMarkdownWordWrap] = React.useState(() => lsBool(LS_KEYS.markdownWordWrap, true))
  const [markdownTextHighlight, setMarkdownTextHighlight] = React.useState(() => lsBool(LS_KEYS.markdownTextHighlight, false))
  type FolderModeContract = 'sitemap' | 'user-journey'
  const parseFolderModeContract = (raw: unknown): FolderModeContract => (raw === 'user-journey' ? 'user-journey' : 'sitemap')
  const [folderModeContract, setFolderModeContract] = React.useState<FolderModeContract>(() =>
    lsJson<FolderModeContract>(LS_KEYS.markdownExplorerFolderModeContract, 'sitemap', parseFolderModeContract),
  )
  const [layoutMode, setLayoutMode] = React.useState<MarkdownWorkspaceLayoutMode>(() =>
    lsJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, 'viewer', parseMarkdownWorkspaceLayoutMode),
  )
  const layoutModeRef = React.useRef<MarkdownWorkspaceLayoutMode>(layoutMode)
  React.useEffect(() => {
    layoutModeRef.current = layoutMode
  }, [layoutMode])
  const status = useWorkspaceStatusHelpers()
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
    const arr = lsJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, [] as string[], parseStringArray)
    return new Set((arr || []).map(p => normalizeWorkspacePath(p)))
  })
  const patchWorkspaceEntryInlineText = React.useCallback(
    (path: WorkspacePath, text: string) => {
      const inlineText = text.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? text : undefined
      const updatedAtMs = Date.now()
      setEntries(prev => {
        let changed = false
        const next = prev.map(entry => {
          if (entry.path !== path || entry.kind !== 'file') return entry
          if (entry.text === inlineText) return entry
          changed = true
          return { ...entry, text: inlineText, updatedAtMs }
        })
        return changed ? next : prev
      })
    },
    [setEntries],
  )
  const markdownLexCacheRef = React.useRef<{ text: string; tokens: TokenWithLines[] } | null>(null)
  const getLexedTokensCached = React.useCallback((text: string): TokenWithLines[] => {
    const cached = markdownLexCacheRef.current
    if (cached && cached.text === text) return cached.tokens
    const tokens = lexMarkdown(text).tokens
    markdownLexCacheRef.current = { text, tokens }
    return tokens
  }, [])

  const editorRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const [resizeHandleEl, setResizeHandleEl] = React.useState<HTMLHRElement | null>(null)
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
  const [viewerInlineEditActive, setViewerInlineEditActive] = React.useState(false)
  const viewerInlineEditActiveRef = React.useRef(false)
  viewerInlineEditActiveRef.current = viewerInlineEditActive

  const setStatusInfo = status.setStatusInfo
  const setStatusError = status.setStatusError
  const setStatusProgress = status.setStatusProgress
  const userEditedActiveTextRef = React.useRef(false)
  const setActiveTextProgrammatic = React.useCallback((next: string) => {
    userEditedActiveTextRef.current = false
    setActiveText(next)
  }, [])
  const [backlinks, setBacklinks] = React.useState<WorkspaceBacklink[]>([])
  const debouncedText = useDebouncedValue(activeText, 450, activePath)
  const outlineText = useDebouncedValue(activeText, 160, activePath)
  const autosaveInFlightRef = React.useRef(false)
  const autosavePendingRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const autosaveStatusTimerRef = React.useRef<number | null>(null)
  const lastLoadedRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const lastIndexedByPathRef = React.useRef<Map<WorkspacePath, string>>(new Map())
  const indexJobRef = React.useRef(0)
  const collapsedSnapshotRef = React.useRef<{ path: WorkspacePath; text: string } | null>(null)
  const prevCollapsedRef = React.useRef<boolean>(effectiveBottomPanelCollapsed)
  const lastRequestedActivePathRef = React.useRef<{ path: WorkspacePath; atMs: number } | null>(null)
  const lastSetActivePath = useMarkdownExplorerStore(s => s.lastSetActivePath)

  const [contentMode, setContentMode] = React.useState<'document' | 'nodeQuickEditor'>('document')
  const userForcedDocumentRef = React.useRef(false)
  const setContentModeFromUser = React.useCallback((mode: 'document' | 'nodeQuickEditor') => {
    userForcedDocumentRef.current = mode === 'document'
    setContentMode(mode)
  }, [])
  const setContentModeAuto = React.useCallback((mode: 'document' | 'nodeQuickEditor') => {
    if (mode === 'document') {
      setContentMode('document')
      return
    }
    userForcedDocumentRef.current = false
    setContentMode('nodeQuickEditor')
  }, [])
  const [nodeQuickEditorFormat, setNodeQuickEditorFormat] = React.useState<'json' | 'markdown'>('json')

  const graphNodesRef = React.useRef<GraphNode[]>(graphNodes)
  React.useEffect(() => {
    graphNodesRef.current = graphNodes
  }, [graphNodes])

  const graphEdgesRef = React.useRef<GraphEdge[]>(graphEdges)
  React.useEffect(() => {
    graphEdgesRef.current = graphEdges
  }, [graphEdges])

  const activeQuickEditorNodeId = React.useMemo(() => {
    const nodes = Array.isArray(graphNodesRef.current)
      ? (graphNodesRef.current as Array<{ id?: unknown; type?: unknown; properties?: unknown }>)
      : []
    const byId = new Map(nodes.map(n => [String(n.id || ''), n] as const))

    const isHeadingSectionNode = (n: { type?: unknown; properties?: unknown } | null): boolean => {
      if (!n) return false
      if (String(n.type || '') !== 'Section') return false
      const props = n.properties && typeof n.properties === 'object' && !Array.isArray(n.properties)
        ? (n.properties as Record<string, unknown>)
        : null
      return typeof props?.level === 'number' && Number.isFinite(props.level)
    }

    const selectedId = typeof selectedNodeId === 'string' ? selectedNodeId.trim() : ''
    if (selectedId) {
      const node = byId.get(selectedId) || null
      if (isHeadingSectionNode(node)) return ''
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
      const node = byId.get(id) || null
      if (!node) continue
      if (isHeadingSectionNode(node)) continue
      return id
    }
    return ''
  }, [graphContentRevision, nodeQuickEditorRegistry, openQuickEditorNodeIds, selectedNodeId])

  const nodeQuickEditorAvailable = Boolean(activeQuickEditorNodeId)

  React.useEffect(() => {
    if (contentMode !== 'nodeQuickEditor') return
    if (activePath && isMarkdownPath(activePath)) {
      setContentModeAuto('document')
      return
    }
    if (nodeQuickEditorAvailable) return
    setContentModeAuto('document')
  }, [activePath, contentMode, nodeQuickEditorAvailable, setContentModeAuto])

  React.useEffect(() => {
    if (!nodeQuickEditorAvailable) return
    if (contentMode === 'nodeQuickEditor') return
    if (userForcedDocumentRef.current) return
    if (activePath && isMarkdownPath(activePath)) return
    setContentModeAuto('nodeQuickEditor')
  }, [activePath, contentMode, nodeQuickEditorAvailable, setContentModeAuto])

  const quickEditorBundleJsonText = React.useMemo(() => {
    if (!activeQuickEditorNodeId) return ''
    const nodes = Array.isArray(graphNodesRef.current) ? graphNodesRef.current : []
    const edges = Array.isArray(graphEdgesRef.current) ? graphEdgesRef.current : []
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
  }, [activeQuickEditorNodeId, graphContentRevision, nodeQuickEditorRegistry])

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

  const refreshInFlightRef = React.useRef(false)
  const refreshQueuedRef = React.useRef(false)

  const refreshOnce = React.useCallback(async () => {
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

  const refresh = React.useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true
      return
    }
    refreshInFlightRef.current = true
    try {
      do {
        refreshQueuedRef.current = false
        await refreshOnce()
      } while (refreshQueuedRef.current)
    } finally {
      refreshInFlightRef.current = false
    }
  }, [refreshOnce])

  const setStatusWithAutoClear = React.useCallback(
    (label: string, ttlMs: number = 1400) => {
      setStatusInfo(label, { ttlMs })
    },
    [setStatusInfo],
  )

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

  const websiteImportMeta = React.useMemo(() => {
    if (!activePath) return null
    if (!isMarkdownPath(activePath)) return null
    const t = String(activeText || '')
    if (!t.startsWith('---')) return null
    return parseWebsiteImportFrontmatterMeta(t)
  }, [activePath, activeText])

  const [pdfWorkspaceViewerTextOverride, setPdfWorkspaceViewerTextOverride] = React.useState<string | null>(null)
  const [webpageWorkspaceEditorTextOverride, setWebpageWorkspaceEditorTextOverride] = React.useState<string | null>(null)
  const [webpageWorkspaceViewerTextOverride, setWebpageWorkspaceViewerTextOverride] = React.useState<string | null>(null)

  const pdfWorkspaceFetchArgs = React.useMemo(() => {
    const docId = pdfWorkspaceMeta ? String(pdfWorkspaceMeta.docId || '').trim() : ''
    const outputDirRel = pdfWorkspaceMeta ? String(pdfWorkspaceMeta.outputDirRel || '').trim() : ''
    if (!docId) return null
    return { docId, outputDirRel }
  }, [pdfWorkspaceMeta?.docId, pdfWorkspaceMeta?.outputDirRel])
  const pdfWorkspaceFetchKey = pdfWorkspaceFetchArgs ? `${pdfWorkspaceFetchArgs.docId}:${pdfWorkspaceFetchArgs.outputDirRel}` : ''

  React.useEffect(() => {
    if (layoutMode !== 'viewer' && layoutMode !== 'split') {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    if (!pdfWorkspaceFetchKey || !pdfWorkspaceFetchArgs) {
      setPdfWorkspaceViewerTextOverride(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 60_000)
    void (async () => {
      try {
        const res = await fetchPdfWorkspaceDoc({
          docId: pdfWorkspaceFetchArgs.docId,
          outputDirRel: pdfWorkspaceFetchArgs.outputDirRel,
          signal: controller.signal,
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
      clearTimeout(t)
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [layoutMode, pdfWorkspaceFetchKey])

  const webpageUrl = webpageWorkspaceMeta?.url ? String(webpageWorkspaceMeta.url || '').trim() : ''
  const webpageView = webpageWorkspaceMeta?.view
  const websiteImportKey = (() => {
    const importId = String(websiteImportMeta?.importId || '').trim()
    const nodeId = String(websiteImportMeta?.nodeId || '').trim()
    const outputDirRel = String(websiteImportMeta?.outputDirRel || '').trim()
    if (!importId || !nodeId) return ''
    return `${importId}:${nodeId}:${outputDirRel}`
  })()

  React.useEffect(() => {
    const url = webpageUrl
    const view = webpageView
    if (!url || !view) {
      setWebpageWorkspaceEditorTextOverride(null)
      setWebpageWorkspaceViewerTextOverride(null)
      return
    }

    if (view === 'markdown') {
      setWebpageWorkspaceEditorTextOverride(null)
      setWebpageWorkspaceViewerTextOverride(null)
      return
    }

    if (view === 'html') {
      setWebpageWorkspaceEditorTextOverride(null)
      setWebpageWorkspaceViewerTextOverride(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const ticker = createProgressTicker({
      onProgress: (p) => setStatusProgress(view === 'json' ? 'Loading JSON' : 'Loading view', p, 100),
      intervalMs: 280,
      maxPercentage: 92,
      maxStepPercentage: 12,
    })
    void (async () => {
      try {
        ticker.start()
        setStatusProgress(view === 'json' ? 'Loading JSON' : 'Loading view')
        if (websiteImportKey) {
          const [importId, nodeId, outputDirRelRaw] = websiteImportKey.split(':')
          const outputDirRel = String(outputDirRelRaw || useGraphStore.getState().websiteImportOutputDirRel || '').trim()
          const kind = websiteImportArtifactKindForWebpageView(view)
          try {
            const effective = await fetchWebsiteImportArtifact({
              importId: String(importId || ''),
              nodeId: String(nodeId || ''),
              outputDirRel,
              kind,
              signal: controller.signal,
            })
            if (cancelled) return
            const clipped = effective.length > 200_000 ? `${effective.slice(0, 200_000)}\n\n(clipped)\n` : effective
            setWebpageWorkspaceEditorTextOverride(clipped)
            setWebpageWorkspaceViewerTextOverride(view === 'json' ? `\`\`\`json\n${clipped}\n\`\`\`\n` : null)
            ticker.stop(100)
            setStatusWithAutoClear('Loaded', 1200)
          } catch (err) {
            if (cancelled) return
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
            const errorText = view === 'json'
              ? JSON.stringify({ ok: false, error: msg || 'Load failed' }, null, 2)
              : `Load failed: ${msg || 'Request failed'}\n`
            setWebpageWorkspaceEditorTextOverride(errorText)
            setWebpageWorkspaceViewerTextOverride(view === 'json' ? `\`\`\`json\n${errorText}\n\`\`\`\n` : null)
            ticker.stop()
            setStatusError(`Load failed: ${msg || 'Request failed'}`)
          }
          return
        }

        if (view === 'json') {
          const includeImages = useGraphStore.getState().webpageImportIncludeImages ?? true
          try {
            const rawJson = await fetchWebpageConversionJsonViaConvert({ url, includeImages, signal: controller.signal })
            if (cancelled) return
            const pretty = (() => {
              const t = String(rawJson || '')
              try {
                return JSON.stringify(JSON.parse(t) as unknown, null, 2)
              } catch {
                return t
              }
            })()
            setWebpageWorkspaceEditorTextOverride(pretty)
            setWebpageWorkspaceViewerTextOverride(`\`\`\`json\n${pretty}\n\`\`\`\n`)
            ticker.stop(100)
            setStatusWithAutoClear('Loaded', 1200)
          } catch (err) {
            if (cancelled) return
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : ''
            const errorText = JSON.stringify({ ok: false, error: msg || 'Request failed' }, null, 2)
            setWebpageWorkspaceEditorTextOverride(errorText)
            setWebpageWorkspaceViewerTextOverride(`\`\`\`json\n${errorText}\n\`\`\`\n`)
            ticker.stop()
            setStatusError(`Load failed: ${msg || 'Request failed'}`)
          }
          return
        }

        setWebpageWorkspaceEditorTextOverride(null)
        setWebpageWorkspaceViewerTextOverride(null)
        ticker.stop(100)
      } catch {
        if (cancelled) return
        ticker.stop()
        setWebpageWorkspaceEditorTextOverride(JSON.stringify({ ok: false, error: 'Request failed' }, null, 2))
        setWebpageWorkspaceViewerTextOverride(null)
        setStatusError('Load failed')
      }
    })()

    return () => {
      cancelled = true
      try {
        ticker.stop()
      } catch {
        void 0
      }
      try {
        controller.abort()
      } catch {
        void 0
      }
    }
  }, [getFs, setStatusError, setStatusProgress, setStatusWithAutoClear, webpageUrl, webpageView, websiteImportKey])

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
        patchWorkspaceEntryInlineText(activePath, nextText)
        setActiveTextProgrammatic(nextText)
        const docKey = workspaceDocumentKey(activePath)
        if (docKey) {
          const source = sourcesByPath[activePath]
          const sourceUrl = source && source.kind === 'url' ? String(source.url || '').trim() : ''
          void setActiveMarkdownDocument({
            name: docKey,
            text: nextText,
            normalizeMermaidMmd: false,
            sourceUrl: sourceUrl ? sourceUrl : null,
          })
        }
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
      setActiveMarkdownDocument,
      patchWorkspaceEntryInlineText,
      setStatusError,
      setStatusProgress,
      setStatusWithAutoClear,
      sourcesByPath,
    ],
  )

  const switchActiveWebpageWorkspaceView = React.useCallback(
    async (view: WebpageViewMode) => {
      if (!activePath || !webpageWorkspaceMeta) return
      if (webpageWorkspaceMeta.view === view) return
      const ticker = createProgressTicker({
        onProgress: (p) => setStatusProgress('Updating view', p, 100),
        intervalMs: 280,
        maxPercentage: 92,
        maxStepPercentage: 12,
      })
      try {
        setStatusProgress('Updating view')
        ticker.start()
        const fs = await getFs()

        if (view === 'markdown') {
          setWebpageWorkspaceEditorTextOverride(prev => (prev == null ? prev : null))
          setWebpageWorkspaceViewerTextOverride(prev => (prev == null ? prev : null))
        }

        const prevText = await (async () => {
          const lastLoaded = lastLoadedRef.current
          const isDirty = !!(
            userEditedActiveTextRef.current &&
            lastLoaded &&
            lastLoaded.path === activePath &&
            lastLoaded.text !== activeTextRef.current
          )
          if (isDirty) return String(activeTextRef.current || '')

          if (lastLoaded && lastLoaded.path === activePath && typeof lastLoaded.text === 'string' && lastLoaded.text.trim()) {
            return lastLoaded.text
          }

          const hydrated = await fs.readFileText(activePath).catch(() => '')
          if (String(hydrated || '').trim()) return String(hydrated || '')
          return String(activeTextRef.current || '')
        })()

        const nextText = await (async () => {
          if (view !== 'markdown') return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })

          if (!isFrontmatterOnlyDoc(prevText)) {
            return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
          }

          const store = useGraphStore.getState()
          const includeImages = webpageWorkspaceMeta.includeImages ?? (store.webpageImportIncludeImages !== false)

          const isHttp = (() => {
            const u = String(webpageWorkspaceMeta.url || '').trim().toLowerCase()
            return u.startsWith('http://') || u.startsWith('https://')
          })()

          if (!isHttp && websiteImportMeta?.importId && websiteImportMeta?.nodeId) {
            const outputDirRel = String(
              websiteImportMeta.outputDirRel || useGraphStore.getState().websiteImportOutputDirRel || '',
            ).trim()
            const outputDirQuery = outputDirRel ? `outputDirRel=${encodeURIComponent(outputDirRel)}&` : ''

            const rawRes = await fetch(
              `/__website_import/artifact?${outputDirQuery}importId=${encodeURIComponent(websiteImportMeta.importId)}&nodeId=${encodeURIComponent(websiteImportMeta.nodeId)}&kind=markdown`,
            )
            if (!rawRes.ok) return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
            const raw = String((await rawRes.text()) || '')
            return upsertWebpageFrontmatterMeta(raw, {
              url: webpageWorkspaceMeta.url,
              view: 'markdown',
              includeImages: webpageWorkspaceMeta.includeImages,
              fidelityLevel: webpageWorkspaceMeta.fidelityLevel,
            })
          }

          const res = await fetchWebpageMarkdown(webpageWorkspaceMeta.url, { includeImages })
          if (!res || res.ok !== true) return upsertWebpageFrontmatterMeta(prevText, { url: webpageWorkspaceMeta.url, view })
          return upsertWebpageFrontmatterMeta(String(res.markdown || ''), {
            url: webpageWorkspaceMeta.url,
            view: 'markdown',
            includeImages: webpageWorkspaceMeta.includeImages,
            fidelityLevel: webpageWorkspaceMeta.fidelityLevel,
          })
        })()
        await fs.writeFileText(activePath, nextText)
        lastLoadedRef.current = { path: activePath, text: nextText }
        patchWorkspaceEntryInlineText(activePath, nextText)
        setActiveTextProgrammatic(nextText)
        ticker.stop(100)
        setStatusWithAutoClear('Updated', 1200)
      } catch (e) {
        try {
          ticker.stop()
        } catch {
          void 0
        }
        setStatusError(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activePath,
      getFs,
      setActiveTextProgrammatic,
      patchWorkspaceEntryInlineText,
      setStatusError,
      setStatusProgress,
      setStatusWithAutoClear,
      websiteImportMeta,
      webpageWorkspaceMeta,
    ],
  )

  const updateActiveWebpageWorkspaceMeta = React.useCallback(
    async (patch: { fidelityLevel?: 1 | 2 | 3 | 4 }) => {
      if (!activePath || !webpageWorkspaceMeta) return
      try {
        setStatusProgress('Updating view')
        const fs = await getFs()

        const prevText = await (async () => {
          const lastLoaded = lastLoadedRef.current
          const isDirty = !!(
            userEditedActiveTextRef.current &&
            lastLoaded &&
            lastLoaded.path === activePath &&
            lastLoaded.text !== activeTextRef.current
          )
          if (isDirty) return String(activeTextRef.current || '')
          if (lastLoaded && lastLoaded.path === activePath && typeof lastLoaded.text === 'string' && lastLoaded.text.trim()) {
            return lastLoaded.text
          }
          const hydrated = await fs.readFileText(activePath).catch(() => '')
          if (String(hydrated || '').trim()) return String(hydrated || '')
          return String(activeTextRef.current || '')
        })()

        const meta = parseWebpageFrontmatterMeta(prevText) || webpageWorkspaceMeta
        const nextText = upsertWebpageFrontmatterMeta(prevText, {
          url: meta.url,
          view: meta.view,
          siteRootRel: meta.siteRootRel,
          fidelityLevel: patch.fidelityLevel,
        })
        await fs.writeFileText(activePath, nextText)
        lastLoadedRef.current = { path: activePath, text: nextText }
        patchWorkspaceEntryInlineText(activePath, nextText)
        setActiveTextProgrammatic(nextText)
        setStatusWithAutoClear('Updated', 1200)
      } catch (e) {
        setStatusError(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
    [
      activePath,
      getFs,
      patchWorkspaceEntryInlineText,
      setActiveTextProgrammatic,
      setStatusError,
      setStatusProgress,
      setStatusWithAutoClear,
      webpageWorkspaceMeta,
    ],
  )

  const resolveFolderContractDocPath = React.useCallback(
    (folderPath: WorkspacePath, mode: FolderModeContract): WorkspacePath => {
      const normalized = normalizeWorkspacePath(folderPath)
      const leaf = mode === 'user-journey' ? 'repo.user-journey.md' : 'repo.sitemap.md'
      return normalizeWorkspacePath(`${normalized.replace(/\/+$/, '')}/${leaf}`)
    },
    [],
  )

  const setActivePathSafe = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      lastRequestedActivePathRef.current = { path: normalized, atMs: Date.now() }
      setActivePath(normalized)
    },
    [setActivePath],
  )

  const pickFolderContractTargetPath = React.useCallback(
    (folderPath: WorkspacePath, preferredMode: FolderModeContract): WorkspacePath | null => {
      const folder = normalizeWorkspacePath(folderPath)
      const preferred = resolveFolderContractDocPath(folder, preferredMode)
      if (entries.some(e => e.kind === 'file' && e.path === preferred)) return preferred

      const alternateMode: FolderModeContract = preferredMode === 'sitemap' ? 'user-journey' : 'sitemap'
      const alternate = resolveFolderContractDocPath(folder, alternateMode)
      if (entries.some(e => e.kind === 'file' && e.path === alternate)) return alternate

      const prefix = folder === '/' ? '/' : `${folder}/`
      const firstDescendantFile = entries.find(e => e.kind === 'file' && e.path.startsWith(prefix)) || null
      return firstDescendantFile ? firstDescendantFile.path : null
    },
    [entries, resolveFolderContractDocPath],
  )

  const renderSourceFileRight = React.useCallback(
    (args: { entry: WorkspaceEntry; isActive: boolean }) => {
      if (!args.isActive) return null

      if (args.entry.kind === 'folder') {
        const sitemapPath = resolveFolderContractDocPath(args.entry.path, 'sitemap')
        const journeyPath = resolveFolderContractDocPath(args.entry.path, 'user-journey')
        const hasSitemap = entries.some(e => e.kind === 'file' && e.path === sitemapPath)
        const hasJourney = entries.some(e => e.kind === 'file' && e.path === journeyPath)
        if (!hasSitemap && !hasJourney) return null
        return (
          <WorkspaceModeSelect<FolderModeContract>
            ariaLabel="Folder mode contract"
            value={folderModeContract}
            isActive={args.isActive}
            options={[
              { value: 'sitemap', label: 'Sitemap' },
              { value: 'user-journey', label: 'User Journey' },
            ]}
            onChange={next => {
              setFolderModeContract(next)
              const target = pickFolderContractTargetPath(args.entry.path, next)
              if (target) setActivePathSafe(target)
            }}
          />
        )
      }

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
        return null
      }

      return null
    },
    [
      entries,
      folderModeContract,
      pickFolderContractTargetPath,
      resolveFolderContractDocPath,
      setActivePathSafe,
      setFolderModeContract,
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
    if (!active) return
    void refresh()
  }, [active, refresh])

  const setSelectionPathSafe = React.useCallback((path: WorkspacePath) => {
    setSelectionPath(normalizeWorkspacePath(path))
  }, [])


  React.useEffect(() => {
    if (!active) return
    const unsubscribe = subscribeWorkspaceFsChanged(detail => {
      if (viewerInlineEditActiveRef.current) return
      const activePath = activePathRef.current
      const last = lastLoadedRef.current
      const isDirty = !!(activePath && last?.path === activePath && last.text !== activeTextRef.current)
      const changedPath = typeof detail?.path === 'string' && detail.path ? detail.path : null
      const operation = typeof detail?.op === 'string' ? detail.op : ''
      if (isDirty && (!changedPath || changedPath === activePath)) return
      if (operation === 'writeFileText' && activePath && changedPath && changedPath !== activePath) return
      scheduleMarkdownWorkspaceRefreshSync(() => {
        void refresh()
      }, {
        activePath,
        changedPath,
        operation,
        isDirty,
      })
    })
    return () => {
      cancelMarkdownWorkspaceRefreshSync()
      unsubscribe()
    }
  }, [active, refresh])

  const persistWorkspacePrefsPendingRef = React.useRef<{
    sidebarWidthPx: number
    explorerOpen: boolean
    sourceFilesCollapsed: boolean
    tocCollapsed: boolean
    backlinksCollapsed: boolean
    markdownWordWrap: boolean
    markdownTextHighlight: boolean
    folderModeContract: FolderModeContract
    layoutMode: MarkdownWorkspaceLayoutMode
    expandedPaths: string[]
  } | null>(null)

  React.useEffect(() => {
    persistWorkspacePrefsPendingRef.current = {
      sidebarWidthPx,
      explorerOpen,
      sourceFilesCollapsed,
      tocCollapsed,
      backlinksCollapsed,
      markdownWordWrap,
      markdownTextHighlight,
      folderModeContract,
      layoutMode,
      expandedPaths: [...expandedPaths],
    }
    scheduleMarkdownWorkspacePrefsSync(() => {
      const pending = persistWorkspacePrefsPendingRef.current
      if (!pending) return
      lsSetInt(LS_KEYS.markdownSidebarWidthPx, pending.sidebarWidthPx, { min: SIDEBAR_MIN_PX, max: SIDEBAR_MAX_PX })
      lsSetBool(LS_KEYS.markdownSidebarOpen, pending.explorerOpen)
      lsSetBool(LS_KEYS.markdownExplorerSourceFilesCollapsed, pending.sourceFilesCollapsed)
      lsSetBool(LS_KEYS.markdownExplorerOutlineCollapsed, pending.tocCollapsed)
      lsSetBool(LS_KEYS.markdownExplorerBacklinksCollapsed, pending.backlinksCollapsed)
      lsSetBool(LS_KEYS.markdownWordWrap, pending.markdownWordWrap)
      lsSetBool(LS_KEYS.markdownTextHighlight, pending.markdownTextHighlight)
      lsSetJson<FolderModeContract>(LS_KEYS.markdownExplorerFolderModeContract, pending.folderModeContract)
      lsSetJson<MarkdownWorkspaceLayoutMode>(LS_KEYS.markdownLayoutMode, pending.layoutMode)
      lsSetJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, pending.expandedPaths)
    }, {
      sidebarWidthPx,
      explorerOpen,
      sourceFilesCollapsed,
      tocCollapsed,
      backlinksCollapsed,
      markdownWordWrap,
      markdownTextHighlight,
      folderModeContract: folderModeContract as unknown as Record<string, unknown>,
      layoutMode: String(layoutMode || ''),
      expandedPaths,
    })
    return () => {
      cancelMarkdownWorkspacePrefsSync()
    }
  }, [
    backlinksCollapsed,
    expandedPaths,
    explorerOpen,
    folderModeContract,
    layoutMode,
    markdownTextHighlight,
    markdownWordWrap,
    sidebarWidthPx,
    sourceFilesCollapsed,
    tocCollapsed,
  ])

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
    const el = resizeHandleEl
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
  }, [resizeHandleEl])

  const filteredEntries = React.useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return entries
    const searchText = q.length >= 3
    const keepPaths = new Set<string>()
    for (const e of entries) {
      if (e.kind !== 'file') continue
      const nameHit = String(e.name || '').toLowerCase().includes(q)
      if (nameHit) {
        keepPaths.add(e.path)
        continue
      }
      if (!searchText) continue
      const rawText = typeof e.text === 'string' ? e.text : ''
      if (!rawText) continue
      if (rawText.length > 250_000) continue
      if (rawText.toLowerCase().includes(q)) {
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
  const activeDocumentSourceUrl = React.useMemo(() => {
    const path = activePath
    if (!path) return null
    const source = sourcesByPath[path]
    const url = source && source.kind === 'url' ? String(source.url || '').trim() : ''
    return url ? url : null
  }, [activePath, sourcesByPath])

  useMarkdownEditorSsotSync({
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
    setActiveMarkdownDocument,
    paused: viewerInlineEditActive,
  })

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
      if (activeDocumentKey) {
        void setActiveMarkdownDocument({
          name: activeDocumentKey,
          text: normalizeWebpageFrontmatterView(candidate, 'markdown'),
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: activeDocumentSourceUrl,
        })
      }
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
    if (activeDocumentKey) {
      void setActiveMarkdownDocument({
        name: activeDocumentKey,
        text: normalizeWebpageFrontmatterView(snap.text, 'markdown'),
        normalizeMermaidMmd: false,
        autoEnableFrontmatter: false,
        sourceUrl: activeDocumentSourceUrl,
      })
    }
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    activePath,
    activeText,
    effectiveBottomPanelCollapsed,
    setActiveMarkdownDocument,
  ])

  const saveActiveFileNow = React.useCallback(async () => {
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return
    try {
      setStatusProgress('Saving', undefined, undefined, undefined, undefined, { ttlMs: 8000 })
      try {
        useGraphStore.getState().flushComposedPositionWritesNow()
      } catch {
        void 0
      }
      const fs = await getFs()
      await fs.writeFileText(path, activeText)
      lastLoadedRef.current = { path, text: activeText }
      patchWorkspaceEntryInlineText(path, activeText)
      if (activeDocumentKey) {
        void setActiveMarkdownDocument({
          name: activeDocumentKey,
          text: normalizeWebpageFrontmatterView(activeText, 'markdown'),
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: activeDocumentSourceUrl,
        })
      }
      try {
        const store = useGraphStore.getState()
        const wsPath = `workspace:${path}`
        const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
        const existing = current.find(f => String(f?.source?.path || '') === wsPath) || null
        if (existing) {
          store.updateSourceFile(existing.id, {
            text: activeText,
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
          setGraphRagWorkflowJsonText(activeText)
        } catch {
          void 0
        }
      }
      if (path === PARSER_SCRIPT_WORKSPACE_PATH) {
        try {
          useParserUIState.getState().setScriptText(activeText)
        } catch {
          void 0
        }
      }
      if (path === SCHEMA_CONFIG_WORKSPACE_PATH) {
        try {
          const next = parseSchemaText(activeText)
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
  }, [
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntryKind,
    activePath,
    activeText,
    getFs,
    setGraphRagWorkflowJsonText,
    setActiveMarkdownDocument,
    setStatusError,
    setStatusProgress,
    setStatusWithAutoClear,
    patchWorkspaceEntryInlineText,
  ])

  const saveAsActiveFileNow = React.useCallback(async () => {
    const currentPath = activePath
    if (!currentPath) return
    if (activeEntryKind === 'folder') return
    const normalized = normalizeWorkspacePath(currentPath)
    const parentPath = (() => {
      const idx = normalized.lastIndexOf('/')
      if (idx <= 0) return WORKSPACE_ROOT_PATH
      return normalizeWorkspacePath(normalized.slice(0, idx) || WORKSPACE_ROOT_PATH)
    })()
    const ext = workspaceExtLower(normalized) || 'md'
    const base = workspaceStem(normalized) || workspaceBasename(normalized) || 'note'
    const suggested = `${base}-copy.${ext}`
    const draft = typeof window !== 'undefined' ? window.prompt('Save As', suggested) : suggested
    const raw = String(draft || '').trim()
    if (!raw) {
      setStatusWithAutoClear('Save cancelled', 1200)
      return
    }
    const safeName = raw
      .replace(/\\/g, '/')
      .replace(/\s+/g, ' ')
      .replace(/\.+\//g, '')
      .replace(/\//g, '-')
      .replace(/\.{2,}/g, '.')
      .trim()
    const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`

    try {
      setStatusProgress('Saving', undefined, undefined, undefined, undefined, { ttlMs: 8000 })
      try {
        useGraphStore.getState().flushComposedPositionWritesNow()
      } catch {
        void 0
      }
      const fs = await getFs()
      const createdPath = await fs.createFile({ parentPath, name: finalName, text: activeText })
      setWorkspaceEntrySource(createdPath, { kind: 'local', originalName: null })
      await refresh()
      lastLoadedRef.current = { path: createdPath, text: activeText }
      setActiveTextProgrammatic(activeText)
      setActivePathSafe(createdPath)
      setSelectionPathSafe(createdPath)
      setStatusWithAutoClear('Saved as')
    } catch (e) {
      setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [
    activeEntryKind,
    activePath,
    activeText,
    getFs,
    refresh,
    setActivePathSafe,
    setActiveTextProgrammatic,
    setSelectionPathSafe,
    setStatusError,
    setStatusProgress,
    setStatusWithAutoClear,
  ])

  React.useEffect(() => {
    if (effectiveBottomPanelCollapsed) return
    const path = activePath
    if (!path) return
    if (String(activeText || '').trim()) return

    const last = lastLoadedRef.current
    if (last && last.path === path && String(last.text || '').trim()) {
      setActiveText(last.text)
      if (activeDocumentKey) {
        void setActiveMarkdownDocument({
          name: activeDocumentKey,
          text: normalizeWebpageFrontmatterView(last.text, 'markdown'),
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          sourceUrl: activeDocumentSourceUrl,
        })
      }
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
        if (activeDocumentKey) {
          void setActiveMarkdownDocument({
            name: activeDocumentKey,
            text: normalizeWebpageFrontmatterView(next, 'markdown'),
            normalizeMermaidMmd: false,
            autoEnableFrontmatter: false,
            sourceUrl: activeDocumentSourceUrl,
          })
        }
      } catch {
        void 0
      }
    })()
  }, [activeDocumentKey, activeDocumentSourceUrl, activePath, activeText, effectiveBottomPanelCollapsed, getFs, setActiveMarkdownDocument])

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
    if (activeEntryKind !== 'folder') return
    if (activePathRef.current !== path) return
    setActiveTextProgrammatic('')
    setHighlightedLineRange(null)
    status.clearStatus()
  }, [activeEntryKind, activePath, setActiveTextProgrammatic, status.clearStatus])

  React.useEffect(() => {
    if (!active) return
    if (viewerInlineEditActive) return
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
    const sourceFileName = workspaceBasename(path) || 'source.md'

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
    scheduleMarkdownWorkspaceIndexStart(() => {
        if (cancelled) return
        if (activePathRef.current !== scheduledFor) return
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
        const nextText = sanitized ?? rawNext
        if (sanitized) {
          try {
            const fs = await getFs()
            await fs.writeFileText(path, sanitized)
          } catch {
            void 0
          }
        }

        lastLoadedRef.current = { path, text: nextText }
        setActiveTextProgrammatic(nextText)
        if (sanitized && canUseCachedText) {
          patchWorkspaceEntryInlineText(path, nextText)
        }
        if (!canUseCachedText) {
          const maxInline = WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS
          const inlineText = nextText.length <= maxInline ? nextText : undefined
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
        if (activeDocumentKey) {
          void setActiveMarkdownDocument({
            name: activeDocumentKey,
            text: normalizeWebpageFrontmatterView(nextText, 'markdown'),
            normalizeMermaidMmd: false,
            autoEnableFrontmatter: false,
            sourceUrl: sourceUrl ? sourceUrl : null,
          })
        }

        const wasIndexedForPath = (candidatePath: WorkspacePath, textHash: string): boolean => {
          const existing = lastIndexedByPathRef.current.get(candidatePath)
          return typeof existing === 'string' && existing === textHash
        }
        const rememberIndexedForPath = (candidatePath: WorkspacePath, textHash: string): void => {
          const map = lastIndexedByPathRef.current
          if (map.has(candidatePath)) map.delete(candidatePath)
          map.set(candidatePath, textHash)
          while (map.size > 24) {
            const oldest = map.keys().next().value as WorkspacePath | undefined
            if (!oldest) break
            map.delete(oldest)
          }
        }
        if (activeDocumentKey && nextText.trim()) {
          const hash = hashStringToHex(nextText)
          if (!wasIndexedForPath(path, hash)) {
            const ext = workspaceExtLower(path)
            const isCanvasHtmlExport = (() => {
              if (ext !== '.html' && ext !== '.htm') return false
              const sample = nextText.slice(0, 4096)
              const lower = sample.toLowerCase()
              if (!lower.includes('<!doctype html')) return false
              if (!sample.includes('id="kg-root"') && !sample.includes("id='kg-root'")) return false
              if (!sample.includes('#kg-stage') || !sample.includes('#kg-svgwrap')) return false
              return true
            })()
            if (isCanvasHtmlExport) {
              rememberIndexedForPath(path, hash)
              setStatusWithAutoClear('Indexed')
              return
            }
            const jobId = ++indexJobRef.current
            const isStaleJob = () => cancelled || activePathRef.current !== scheduledFor || indexJobRef.current !== jobId
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
              const text = nextText.length <= maxInline ? nextText : ''
              store.addSourceFile({
                id,
                name: sourceFileName,
                text,
                enabled: true,
                status: 'idle',
                source,
              })
              return id
            })()

            if (isStaleJob()) return
            try {
              store.updateSourceFile(fileId, {
                name: sourceFileName,
                text: nextText.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextText : '',
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

            const geoGraph = isGeoCandidate
              ? await runInIdle(
                  () => {
                    const lowerPath = String(path || '').toLowerCase()
                    const mightBeGeoJson =
                      lowerPath.endsWith('.geojson') ||
                      (lowerPath.endsWith('.json') && /"type"\s*:\s*"FeatureCollection"/i.test(nextText.slice(0, 4096)))
                    if (mightBeGeoJson && nextText.length < 2_000_000) {
                      const normalized = parseGeoJsonFeatureCollectionFromText(nextText)
                      if (normalized) {
                        return buildGraphDataFromFeatureCollection({
                          featureCollection: normalized,
                          sourcePath: path,
                          sourceHash: hash,
                        })
                      }
                    }
                    const geodata = tryBuildGeodataGraphDataFromJsonText({ name: path, text: nextText, maxRecords: 5000 })
                    return geodata ? geodata.graphData : null
                  },
                  { timeoutMs: 650 },
                )
              : null
            if (isStaleJob()) return

            const shouldUseDirectGraphData = (() => {
              if (store.canvasRenderMode === '2d' && store.canvas2dRenderer === 'flowEditor') {
                const meta = (store.graphData?.metadata || {}) as Record<string, unknown>
                return String(meta.sourceLayerComposition || '') !== 'compose'
              }
              return false
            })()

            const applyComposedFromSourceFiles = async () => {
              if (isStaleJob()) return
              try {
                const mod = (await import('@/features/source-files/applyComposedGraphFromSourceFiles')) as typeof import('@/features/source-files/applyComposedGraphFromSourceFiles')
                if (isStaleJob()) return
                mod.scheduleApplyComposedGraphFromSourceFiles()
              } catch {
                void 0
              }
            }

            if (geoGraph) {
              if (isStaleJob()) return
              await maybeAutoEnableGeospatialModeForGraphData({ graphData: geoGraph, openSidePanel: true })
              if (isStaleJob()) return
              try {
                store.updateSourceFile(fileId, {
                  status: 'parsed',
                  error: undefined,
                  parsedParserId: geoGraph.context === 'geodata' ? 'geodata' : 'geojson',
                  parsedTextHash: hash,
                  parsedGraphRevision: 0,
                  parsedGraphData: geoGraph,
                })
              } catch {
                void 0
              }
              if (shouldUseDirectGraphData) {
                try {
                  store.setGraphData(geoGraph)
                } catch {
                  void 0
                }
              } else {
                await applyComposedFromSourceFiles()
              }
              if (isStaleJob()) return
              rememberIndexedForPath(path, hash)
              return
            }

            if (cachedGraph && cachedHash === hash) {
              if (isStaleJob()) return
              try {
                store.updateSourceFile(fileId, {
                  status: 'parsed',
                  error: undefined,
                  parsedGraphRevision: typeof existing?.parsedGraphRevision === 'number' ? existing!.parsedGraphRevision : 0,
                })
              } catch {
                void 0
              }
              if (shouldUseDirectGraphData) {
                try {
                  store.setGraphData(cachedGraph)
                } catch {
                  void 0
                }
              } else {
                await applyComposedFromSourceFiles()
              }
            } else {
              if (isStaleJob()) return
              const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
              let lastStage = ''
              setStatusProgress('Parsing')
              const res = await runInIdle(
                () =>
                  loadGraphDataFromTextViaParser(activeDocumentKey, nextText, {
                    applyToStore: false,
                    onProgress: (stage) => {
                      const s = String(stage || '').trim()
                      if (!s || s === lastStage) return
                      lastStage = s
                      setStatusProgress(s)
                    },
                  }),
                { timeoutMs: 650 },
              )
              if (isStaleJob()) return
              const gd = res?.graphData || null
              if (gd) {
                try {
                  store.updateSourceFile(fileId, {
                    status: 'parsed',
                    error: undefined,
                    parsedParserId: typeof res?.parserId === 'string' ? res!.parserId : undefined,
                    parsedTextHash: hash,
                    parsedGraphRevision: 0,
                    parsedGraphData: gd,
                  })
                } catch {
                  void 0
                }
                if (shouldUseDirectGraphData) {
                  try {
                    store.setGraphData(gd)
                  } catch {
                    void 0
                  }
                } else {
                  await applyComposedFromSourceFiles()
                }
              } else {
                if (isStaleJob()) return
                try {
                  store.updateSourceFile(fileId, { status: 'error', error: 'Parser returned empty graph' })
                } catch {
                  void 0
                }
              }
            }
            if (isStaleJob()) return
            rememberIndexedForPath(path, hash)
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
      }, {
        path: scheduledFor,
        sourceUrl,
        sourceFileName,
      })
    return () => {
      cancelled = true
      cancelMarkdownWorkspaceIndexStart()
    }
  }, [
    active,
    activeDocumentKey,
    activeEntryKind,
    activeEntryText,
    activePath,
    getFs,
    setActiveTextProgrammatic,
    setActiveMarkdownDocument,
    setStatusError,
    setStatusProgress,
    setStatusWithAutoClear,
    patchWorkspaceEntryInlineText,
    sourcesByPath,
    viewerInlineEditActive,
    lastSetActivePath,
  ])

  React.useEffect(() => {
    return () => {
      const timer = autosaveStatusTimerRef.current
      if (timer != null) window.clearTimeout(timer)
      autosaveStatusTimerRef.current = null
      autosaveInFlightRef.current = false
      autosavePendingRef.current = null
      markdownLexCacheRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!active) return
    if (viewerInlineEditActive) return
    const path = activePath
    if (!path) return
    if (activeEntryKind === 'folder') return
    const last = lastLoadedRef.current
    if (!userEditedActiveTextRef.current) return
    if (!shouldAutosaveWorkspaceFile({ path, lastLoaded: last, activeText, debouncedText })) return
    scheduleMarkdownWorkspaceAutosaveSync(() => {
      if (autosaveInFlightRef.current) {
        autosavePendingRef.current = { path, text: debouncedText }
        return
      }
      autosaveInFlightRef.current = true
      void (async () => {
        let nextTextToSave = debouncedText
        try {
          while (true) {
            let savingShown = false
            autosaveStatusTimerRef.current = window.setTimeout(() => {
              setStatusProgress('Saving', undefined, undefined, undefined, undefined, { ttlMs: 8000 })
              savingShown = true
            }, 220)
            try {
              const fs = await getFs()
              await fs.writeFileText(path, nextTextToSave)
              lastLoadedRef.current = { path, text: nextTextToSave }
              patchWorkspaceEntryInlineText(path, nextTextToSave)
              if (activeDocumentKey) {
                void setActiveMarkdownDocument({
                  name: activeDocumentKey,
                  text: normalizeWebpageFrontmatterView(nextTextToSave, 'markdown'),
                  normalizeMermaidMmd: false,
                  autoEnableFrontmatter: false,
                  sourceUrl: activeDocumentSourceUrl,
                })
              }
              try {
                const store = useGraphStore.getState()
                const wsPath = `workspace:${path}`
                const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
                const existing = current.find(f => String(f?.source?.path || '') === wsPath) || null
                if (existing) {
                  const inlineText = nextTextToSave.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? nextTextToSave : undefined
                  store.updateSourceFile(existing.id, {
                    text: inlineText ?? '',
                    status: 'idle',
                    error: undefined,
                  })
                }
              } catch {
                void 0
              }
              if (path === ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH) {
                try {
                  setGraphRagWorkflowJsonText(nextTextToSave)
                } catch {
                  void 0
                }
              }
              if (path === PARSER_SCRIPT_WORKSPACE_PATH) {
                try {
                  useParserUIState.getState().setScriptText(nextTextToSave)
                } catch {
                  void 0
                }
              }
              if (path === SCHEMA_CONFIG_WORKSPACE_PATH) {
                try {
                  const next = parseSchemaText(nextTextToSave)
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
              if (savingShown) setStatusWithAutoClear('Saved')
            } finally {
              const timer = autosaveStatusTimerRef.current
              if (timer != null) window.clearTimeout(timer)
              autosaveStatusTimerRef.current = null
            }
            const pending = autosavePendingRef.current
            if (!pending || pending.path !== path || pending.text === nextTextToSave) {
              if (pending && pending.path !== path) autosavePendingRef.current = pending
              break
            }
            autosavePendingRef.current = null
            nextTextToSave = pending.text
          }
        } catch (e) {
          setStatusError(`Save failed: ${String((e as { message?: unknown })?.message ?? e)}`)
        } finally {
          autosaveInFlightRef.current = false
        }
      })()
    }, { path, text: debouncedText })
    return () => {
      cancelMarkdownWorkspaceAutosaveSync(path)
    }
  }, [
    active,
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeEntryKind,
    activePath,
    activeText,
    debouncedText,
    getFs,
    setGraphRagWorkflowJsonText,
    setActiveMarkdownDocument,
    setStatusProgress,
    setStatusWithAutoClear,
    setStatusError,
    patchWorkspaceEntryInlineText,
    viewerInlineEditActive,
  ])

  React.useEffect(() => {
    if (!requestedRevealLine) return
    const h = editorRef.current
    if (!h) return
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
      h.focus()
      h.setSelectionOffsets(offset, offset)
      h.revealOffsetInCenter(offset)
    } catch {
      void 0
    }
    requestRevealLine(null)
  }, [requestRevealLine, requestedRevealLine])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onLayoutRequest = (ev: Event) => {
      const e = ev as CustomEvent<{ mode?: unknown } | undefined>
      const mode = String(e.detail?.mode || '').trim().toLowerCase()
      if (mode !== 'split' && mode !== 'editor') return
      setLayoutMode(prev => (prev === mode ? prev : mode))
    }
    window.addEventListener(MARKDOWN_LAYOUT_REQUEST_EVENT, onLayoutRequest as EventListener)
    return () => {
      window.removeEventListener(MARKDOWN_LAYOUT_REQUEST_EVENT, onLayoutRequest as EventListener)
    }
  }, [])

  const revealLineInEditor = React.useCallback(
    (line: number, endLine?: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const start = Math.floor(line)
      const end = Number.isFinite(endLine) && (endLine as number) > 0 ? Math.max(start, Math.floor(endLine as number)) : start
      setHighlightedLineRange({ start, end })
      const currentLayoutMode = layoutModeRef.current
      if (currentLayoutMode !== 'split' && currentLayoutMode !== 'editor') {
        setLayoutMode('split')
      }
      requestRevealLine(start)
    },
    [requestRevealLine, setLayoutMode],
  )
  const revealLineFromCanvas = React.useCallback(
    (line: number, endLine?: number) => {
      if (!Number.isFinite(line) || line <= 0) return
      const start = Math.floor(line)
      const end = Number.isFinite(endLine) && (endLine as number) > 0 ? Math.max(start, Math.floor(endLine as number)) : start
      const currentLayoutMode = layoutModeRef.current
      if (currentLayoutMode === 'editor' || currentLayoutMode === 'viewer') {
        setHighlightedLineRange({ start, end })
        return
      }
      revealLineInEditor(start, end)
    },
    [revealLineInEditor],
  )

  useCanvasMarkdownSync({
    active,
    entries,
    activePath,
    setActivePathSafe,
    setExpandedPaths,
    revealLineInEditor: revealLineFromCanvas,
    setStatusError,
  })

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    const nodeId = selectedNodeId ? String(selectedNodeId) : ''
    const edgeId = !nodeId && selectedEdgeId ? String(selectedEdgeId) : ''
    if (nodeId || edgeId) return
    setHighlightedLineRange(null)
  }, [selectedEdgeId, selectedNodeId, selectionSource, setHighlightedLineRange])

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

  const docLocationIndex = React.useMemo(() => {
    return buildDocLocationIndex({ nodes: graphNodesRef.current, edges: graphEdgesRef.current, matchesDoc: matchesActiveDoc })
  }, [docLocationRevision, matchesActiveDoc])

  const lastCaretLineRef = React.useRef<number | null>(null)
  const onEditorCaretLine = React.useCallback(
    (line: number) => {
      const currentLayoutMode = layoutModeRef.current
      if (currentLayoutMode !== 'editor' && currentLayoutMode !== 'split') return
      if (!Number.isFinite(line) || line <= 0) return
      const v = Math.floor(line)
      if (lastCaretLineRef.current === v) return
      lastCaretLineRef.current = v
      setHighlightedLineRange({ start: v, end: v })

      const hit = docLocationIndex.find(v)
      if (!hit) return
      if (hit.kind === 'node') {
        if (selectedNodeId === hit.id) return
        setSelectionSource('editor')
        selectNode(hit.id)
        return
      }
      if (selectedEdgeId === hit.id) return
      setSelectionSource('editor')
      selectEdge(hit.id)
    },
    [
      docLocationIndex,
      selectEdge,
      selectNode,
      selectedEdgeId,
      selectedNodeId,
      setSelectionSource,
    ],
  )

  const tocTokens = React.useMemo(() => {
    if (!active || !explorerOpen || tocCollapsed) return EMPTY_TOC_TOKENS
    const text = String(outlineText || '')
    if (!text.trim()) return EMPTY_TOC_TOKENS
    if (text.length > WORKSPACE_TOC_PARSE_MAX_CHARS) return EMPTY_TOC_TOKENS
    if (!text.includes('#') && !/<h[1-6]\b/i.test(text)) return EMPTY_TOC_TOKENS
    try {
      return getLexedTokensCached(text)
    } catch {
      return EMPTY_TOC_TOKENS
    }
  }, [active, explorerOpen, getLexedTokensCached, outlineText, tocCollapsed])

  const onTocReorder = React.useCallback(
    (parentId: string | null, fromIndex: number, toIndex: number) => {
      try {
        if (activeText.length > WORKSPACE_TOC_PARSE_MAX_CHARS) return
        const tokens = getLexedTokensCached(activeText)
        const next = reorderMarkdownHeadings(activeText, tokens, parentId, fromIndex, toIndex)
        if (next === activeText) return
        setActiveText(next)
      } catch {
        void 0
      }
    },
    [activeText, getLexedTokensCached, setActiveText],
  )
  const backlinksJobRef = React.useRef(0)
  React.useEffect(() => {
    if (!active || !explorerOpen || backlinksCollapsed || !activePath) {
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
  }, [active, activePath, backlinksCollapsed, entries, explorerOpen])

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
      const target = pickFolderContractTargetPath(path, folderModeContract)
      if (target) setActivePathSafe(target)
    },
    [folderModeContract, pickFolderContractTargetPath, setActivePathSafe, setSelectionPathSafe],
  )

  const handleApply = React.useCallback(async () => {
    const name = String(activeDocumentKey || '').trim()
    if (!name) {
      setStatusError('No file selected')
      return
    }
    const applyText = (() => {
      const raw = String(activeText || '')
      if (raw.trim()) return raw
      if (contentMode === 'nodeQuickEditor') return String(quickEditorEditorText || '')
      if (markdownDocumentName === activeDocumentKey && typeof markdownDocumentText === 'string' && markdownDocumentText) {
        return markdownDocumentText
      }
      return raw
    })()
    setStatusProgress('Applying')
    try {
      try {
        const st = useGraphStore.getState()
        if (String(st.documentSemanticMode || 'document') !== 'document') {
          st.setDocumentSemanticMode('document')
        }
      } catch {
        void 0
      }
      const ok = await applyMarkdownDocumentToGraph(name, applyText, { force: true })
      const geoReqs = (() => {
        const text = String(applyText || '')
        if (!text.includes('```')) return []
        const extracted = extractEmbeddedGeoJsonGraphDataRequests({
          markdownText: text,
          sourceDocumentPath: name,
          limit: 40,
        })
        if (typeof geoDatasetIntegration.isGeoJsonCodeBlock !== 'function') return extracted
        return extracted.filter(req => {
          try {
            return !!geoDatasetIntegration.isGeoJsonCodeBlock?.(req as never)
          } catch {
            return false
          }
        })
      })()

      if (geoReqs.length > 0 && typeof geoDatasetIntegration.registerGeoJsonFeatureCollection === 'function') {
        await Promise.all(geoReqs.map(req => geoDatasetIntegration.registerGeoJsonFeatureCollection?.(req as never)))
      }
      setStatusInfo(ok ? 'Applied' : 'Skipped')
    } catch (e) {
      setStatusError(`Failed: ${String((e as { message?: unknown })?.message ?? e)}`)
    }
  }, [activeDocumentKey, activeText, applyMarkdownDocumentToGraph, contentMode, geoDatasetIntegration, markdownDocumentName, markdownDocumentText, quickEditorEditorText, setStatusError, setStatusInfo, setStatusProgress])

  React.useEffect(() => {
    if (!workspaceCanvasPaneOpen) return
    const name = String(activeDocumentKey || '').trim()
    if (!name) return
    const text = String(activeText || '')
    if (!text.trim()) return
    const nodes = Array.isArray(graphNodesRef.current) ? graphNodesRef.current : []
    const edges = Array.isArray(graphEdgesRef.current) ? graphEdgesRef.current : []
    const isGraphEmpty = nodes.length === 0 && edges.length === 0
    if (!isGraphEmpty) return
    const sig = `${name}:${text.length}:${text.slice(0, 96)}`
    if (lastAutoApplySigRef.current === sig) return
    lastAutoApplySigRef.current = sig
    void handleApply()
  }, [activeDocumentKey, activeText, graphContentRevision, handleApply, workspaceCanvasPaneOpen])

  const handleFormatAction = React.useCallback(
    (action: MarkdownFormatAction) => {
      const h = editorRef.current
      if (!h) return
      const offsets = h.getSelectionOffsets()
      const selection = offsets || { startOffset: activeText.length, endOffset: activeText.length }
      const { nextText, nextSelection } = applyMarkdownFormatAction({ text: activeText, selection, action })
      setActiveText(nextText)
      const focusAndSelect = () => {
        const h2 = editorRef.current
        if (!h2) return
        try {
          h2.focus()
          h2.setSelectionOffsets(nextSelection.startOffset, nextSelection.endOffset)
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
    openedPath: activePath,
    selectionPath,
    selectionEntryKind: selectionEntry?.kind ?? null,
    activeDocumentKey,
    activeDocumentSourceUrl,
    setActiveText: setActiveTextProgrammatic,
    setEntries,
    lastLoadedRef,
    setExpandedPaths,
    setActivePathSafe,
    setSelectionPathSafe,
    setActiveMarkdownDocument,
    applyMarkdownDocumentToGraph,
  })

  const canRefreshActiveFromSource = React.useMemo(() => {
    if (!selectionPath || selectionEntry?.kind !== 'file') return false
    const src = sourcesByPath ? sourcesByPath[selectionPath] : null
    return !!(src && src.kind === 'url' && String((src as { url?: unknown }).url || '').trim())
  }, [selectionEntry, selectionPath, sourcesByPath])

  const revealInFinder = React.useCallback(
    (path: WorkspacePath) => {
      const normalized = normalizeWorkspacePath(path)
      const src = sourcesByPath ? sourcesByPath[normalized] : null
      if (src && src.kind === 'url' && String(src.url || '').trim()) {
        try {
          window.open(String(src.url || '').trim(), '_blank', 'noopener,noreferrer')
          setStatusWithAutoClear('Opened source URL', 1400)
          return
        } catch {
          void 0
        }
      }
      const localName = src && src.kind === 'local' ? String(src.originalName || '').trim() : ''
      const localLooksAbsolute =
        !!localName &&
        (localName.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(localName))
      if (localLooksAbsolute) {
        try {
          const fileUrl = `file://${localName.replace(/\\/g, '/')}`
          window.open(fileUrl, '_blank', 'noopener,noreferrer')
          setStatusWithAutoClear('Opened local file URL', 1600)
          return
        } catch {
          void 0
        }
      }
      if (src && src.kind === 'local') {
        try {
          const relative = normalized.replace(/^\/+/, '')
          void navigator.clipboard?.writeText(relative || normalized)
          setStatusWithAutoClear('Copied workspace-relative path', 1800)
        } catch {
          void 0
        }
      }
      setSelectionPathSafe(normalized)
      setActivePathSafe(normalized)
      setStatusWithAutoClear('Revealed in Source Files explorer', 1800)
    },
    [setActivePathSafe, setSelectionPathSafe, setStatusWithAutoClear, sourcesByPath],
  )

  const openBacklink = React.useCallback(
    (args: { path: WorkspacePath; line: number }) => {
      setActivePathSafe(args.path)
      setSelectionPathSafe(args.path)
      revealLineInEditor(args.line)
    },
    [revealLineInEditor, setActivePathSafe, setSelectionPathSafe],
  )

  const webpageEditorMode = webpageWorkspaceMeta?.view === 'json' ? 'json' : null
  const editorUri = activePath
    ? `inmemory://workspace/${encodeURIComponent(workspaceDocumentKey(activePath) || 'document')}${webpageEditorMode ? `?mode=${webpageEditorMode}` : ''}`
    : 'inmemory://model/empty'
  const editorLanguage = activePath ? (webpageEditorMode || languageForPath(activePath)) : 'markdown'

  const effectiveActiveText = (() => {
    if (contentMode === 'nodeQuickEditor') return quickEditorEditorText
    if (activeText) return activeText
    if (markdownDocumentName === activeDocumentKey && typeof markdownDocumentText === 'string' && markdownDocumentText) {
      return markdownDocumentText
    }
    return activeText
  })()
  const effectiveSetActiveText = React.useCallback(
    (next: string) => {
      if (contentMode === 'nodeQuickEditor') return
      userEditedActiveTextRef.current = true
      setActiveText(next)
    },
    [contentMode],
  )
  const effectiveViewerTextOverride = contentMode === 'nodeQuickEditor' && nodeQuickEditorFormat === 'json' ? quickEditorViewerText : null
  const combinedViewerTextOverride = effectiveViewerTextOverride || pdfWorkspaceViewerTextOverride || webpageWorkspaceViewerTextOverride
  const webpageDerivedReadOnlyActive = contentMode !== 'nodeQuickEditor' && !!(webpageWorkspaceMeta?.url && webpageWorkspaceMeta?.view === 'json')
  const effectiveEditorTextOverride =
    contentMode === 'nodeQuickEditor'
      ? null
      : webpageWorkspaceEditorTextOverride
  const effectiveIsEditing = contentMode !== 'nodeQuickEditor' && isEditing && !webpageDerivedReadOnlyActive
  const effectiveIsMarkdown = contentMode !== 'nodeQuickEditor' && isMarkdown && !(webpageWorkspaceMeta && webpageWorkspaceMeta.view !== 'markdown')

  const saveEnabled = effectiveIsEditing && activeEntryKind === 'file' && !!String(activeDocumentKey || '').trim()
  const lastViewerInlineEditSignalRef = React.useRef<boolean | null>(null)
  const handleViewerInlineEditStateChange = React.useCallback((active: boolean) => {
    if (lastViewerInlineEditSignalRef.current === active) return
    lastViewerInlineEditSignalRef.current = active
    scheduleMarkdownWorkspaceInlineEditStateSync(active, () => {
      setViewerInlineEditActive(prev => (prev === active ? prev : active))
    })
  }, [])
  React.useEffect(() => {
    return () => {
      cancelMarkdownWorkspaceInlineEditStateSync()
    }
  }, [])

  const actionBridge = React.useMemo(
    () => ({
      importLocalFiles: fileActions.handleImportLocalFiles,
      importLocalFolder: fileActions.handleImportLocalFolder,
      importUrl: fileActions.handleImportUrl,
      importWebsite: fileActions.handleImportWebsite,
      createNewFolder: () => void fileActions.createNewFolder({ parentPath: createParentPath }),
      save: saveEnabled ? () => void saveActiveFileNow() : undefined,
    }),
    [createParentPath, fileActions, saveActiveFileNow, saveEnabled],
  )

  React.useEffect(() => {
    return registerMarkdownWorkspaceActionBridge('markdown-workspace-explorer', actionBridge)
  }, [actionBridge])

  return (
    <section
      ref={workspaceRootRef}
      className={`flex-1 w-full h-full min-h-0 flex overflow-hidden rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Markdown Workspace"
    >
      {explorerOpen ? (
        <>
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
            onRefresh={() => void refresh()}
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
            onRevealInFinder={revealInFinder}
            onRenameEntry={fileActions.onRenameEntry}
            onDeleteEntry={fileActions.onDeleteEntry}
            renderSourceFileRight={renderSourceFileRight}
          />

          <VerticalResizeSeparatorHr ref={setResizeHandleEl} ariaLabel="Resize explorer" />
        </>
      ) : null}

      <MarkdownWorkspaceMain
        themeMode={themeMode}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        geoDatasetIntegration={geoDatasetIntegration}
        explorerOpen={explorerOpen}
        setExplorerOpen={setExplorerOpen}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        markdownWordWrap={markdownWordWrap}
        setMarkdownWordWrap={setMarkdownWordWrap}
        markdownTextHighlight={markdownTextHighlight}
        setMarkdownTextHighlight={setMarkdownTextHighlight}
        onStatusProgress={setStatusProgress}
        onStatusWithAutoClear={(label, ttlMs) => setStatusWithAutoClear(label, ttlMs)}
        onSaveAs={() => void saveAsActiveFileNow()}
        onToggleFullscreen={toggleFullscreen}
        presentationApiRef={presentationApiRef}
        isEditing={effectiveIsEditing}
        isMarkdown={effectiveIsMarkdown}
        onFormatAction={handleFormatAction}
        webpageWorkspaceMeta={webpageWorkspaceMeta}
        onWebpageChangeView={(view) => void switchActiveWebpageWorkspaceView(view)}
        onWebpageUpdateMeta={patch => void updateActiveWebpageWorkspaceMeta(patch)}
        activeText={effectiveActiveText}
        setActiveText={effectiveSetActiveText}
        editorTextOverride={effectiveEditorTextOverride}
        disableEditorMutations={
          webpageDerivedReadOnlyActive || (webpageWorkspaceMeta?.view === 'json' && typeof effectiveEditorTextOverride === 'string')
        }
        webpageHtmlOverride={null}
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
        onViewerInlineEditStateChange={handleViewerInlineEditStateChange}
      />
    </section>
  )
}
