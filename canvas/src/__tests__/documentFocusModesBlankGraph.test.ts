import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { deriveGraphDataForActiveView } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { buildWorkspaceDataViewSourceTableId, writeWorkspaceDataViewState } from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'
import { applySavedDocumentUiModeStateWrites } from '@/features/canvas/graphStoreDocumentUiRestoreWrites'
import { MARKDOWN_TABLE_GRAPH_CELL_PROPERTY_PREVIEW_CHAR_LIMIT } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
  }

  key(index: number): string | null {
    if (!Number.isFinite(index) || index < 0) return null
    const keys = Array.from(this.map.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value))
  }
}

const ensureLocalStorage = (): Storage => {
  const g = globalThis as unknown as { window?: unknown }
  const w = (g.window ?? {}) as { localStorage?: Storage }
  if (!w.localStorage) w.localStorage = new MemoryStorage()
  g.window = w as unknown as Window
  return w.localStorage
}

export function testDocumentFocusModesBlankGraphGating() {
  const storage = ensureLocalStorage()
  storage.clear()

  const mdNoFrontmatterMermaid = ['---', 'title: X', '---', '', '# Hi', ''].join('\n')
  const gNoFm = parseJsonLd(buildMarkdownJsonLd('no-fm.md', mdNoFrontmatterMermaid))
  const focusedNoFm = deriveGraphDataForActiveView({
    graphData: gNoFm,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((focusedNoFm.nodes || []).length !== 0) {
    throw new Error('expected Frontmatter Mode to produce blank graph when mermaid frontmatter missing')
  }

  const mdWithMermaid = [
    '---',
    'title: X',
    'mermaid: |',
    '  flowchart TB',
    '    A-->B',
    '---',
    '',
    '# Hi',
    '',
  ].join('\n')
  const gFm = parseJsonLd(buildMarkdownJsonLd('has-fm.md', mdWithMermaid))
  const focusedFm = deriveGraphDataForActiveView({
    graphData: gFm,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((focusedFm.nodes || []).length === 0) {
    throw new Error('expected Frontmatter Mode to render non-blank graph when mermaid frontmatter exists')
  }

  const mdTableOnly = [
    '# Table',
    '',
    '| Task | Status | Date | Category |',
    '| --- | --- | --- | --- |',
    '| Try | Done | 2023-08-01 | A,1 |',
    '| Visit | Todo | 2023-08-03 | 1,Y |',
    '',
  ].join('\n')
  const gTable = parseJsonLd(buildMarkdownJsonLd('table.md', mdTableOnly))

  const tableFocusDisabled = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((tableFocusDisabled.nodes || []).length !== 0) {
    throw new Error('expected Table Mode to produce blank graph when DataView graph is not enabled')
  }

  const docNode = (gTable.nodes || []).find(n => String((n as any)?.type || '') === 'Document') as any
  const documentPath = String(docNode?.properties?.path || 'table.md')
  const tableNode = (gTable.nodes || []).find(n => String((n as any)?.type || '') === 'Table') as any
  const lineStart = Math.max(1, Math.floor(Number(tableNode?.metadata?.lineStart || 1)))
  const lineEnd = Math.max(lineStart, Math.floor(Number(tableNode?.metadata?.lineEnd || lineStart)))
  const tableId = `md-block:${lineStart}-${lineEnd}`
  writeWorkspaceDataViewState({
    activeDocumentPath: documentPath,
    tableId,
    value: {
      sv: 1,
      activeViewId: 'v0',
      views: [
        {
          v: 2,
          id: 'v0',
          name: 'Table',
          layout: 'table',
          groupByColumnId: null,
          visibleColumnIds: null,
          columnTypesById: null,
          filterGroups: [{ id: 'g0', rules: [] }],
          sortRules: [],
          graphEnabled: true,
          graphRolesByColumnId: { col_0: 'node', col_1: 'color', col_3: 'group' },
        },
      ],
    },
  })

  const tableFocusEnabled = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((tableFocusEnabled.nodes || []).length === 0) {
    throw new Error('expected Table Mode to render non-blank graph when DataView graph is enabled')
  }
}

export function testDocumentFrontmatterModePreservesFrontmatterFlowGraphFamily() {
  const graphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: { kind: 'frontmatter-flow' },
    nodes: [
      { id: 'w-text-script', type: 'TextGeneration', label: 'Text', properties: { 'flow:widgetFormId': 'videoScript' } },
      { id: 'w-video-scene', type: 'VideoGeneration', label: 'Video', properties: { 'flow:widgetFormId': 'videoGeneration' } },
    ],
    edges: [
      {
        id: 'e-scene-to-video-ref',
        source: 'w-text-script',
        target: 'w-video-scene',
        label: 'text_out -> reference_image',
        properties: {
          'flow:sourcePortKey': 'text_out',
          'flow:targetPortKey': 'reference_image',
        },
      },
    ],
  }

  const focused = deriveGraphDataForActiveView({
    graphData,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((focused.nodes || []).length !== 2) throw new Error('expected frontmatter-flow active view to preserve flow nodes')
  if ((focused.edges || []).length !== 1) throw new Error('expected frontmatter-flow active view to preserve flow edges')
  const props = ((focused.edges || [])[0]?.properties || {}) as Record<string, unknown>
  if (String(props['flow:sourcePortKey'] || '') !== 'text_out') throw new Error('expected frontmatter-flow active view to preserve source port key')
  if (String(props['flow:targetPortKey'] || '') !== 'reference_image') throw new Error('expected frontmatter-flow active view to preserve target port key')
}

export function testDeriveGraphDataForActiveViewCachesEquivalentInputs() {
  const markdown = ['# Cache', '', '- one', '- two', ''].join('\n')
  const graphData = parseJsonLd(buildMarkdownJsonLd('cache-view.md', markdown))
  const first = deriveGraphDataForActiveView({
    graphData,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'keyword',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  const second = deriveGraphDataForActiveView({
    graphData,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'keyword',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if (first !== second) {
    throw new Error('expected active-view derivation to reuse cached graph object for equivalent inputs')
  }
}

export function testCanvasDocumentModeToolbarActionsNormalizeConflictingFlags() {
  const calls: string[] = []
  const baseParams = {
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => calls.push('openGeo'),
    canvas2dRenderer: 'd3' as const,
    canvas3dMode: '3d',
    canvasRenderMode: '2d' as const,
    renderMediaAsNodes: false,
    timelineEnabled: true,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats' as const,
    schema: { nodeStyles: {}, edgeStyles: {}, rules: [], behavior: { allowEdgeCreation: true, allowNodeDrag: true } },
    setCanvas2dRenderer: (value: string) => calls.push(`renderer:${value}`),
    setCanvasRenderMode: (value: string) => calls.push(`surface:${value}`),
    setCanvas3dMode: (value: string) => calls.push(`3d:${value}`),
    setSchema: () => calls.push('schema'),
    setRenderMediaAsNodes: (value: boolean) => calls.push(`media:${String(value)}`),
    setTimelineEnabled: (value: boolean) => calls.push(`timeline:${String(value)}`),
    setBottomSurfaceCollapsed: (value: boolean) => calls.push(`bottomCollapsed:${String(value)}`),
    setBottomSurfaceTab: (value: 'stats' | 'history' | 'documentVersionGraph' | 'gitGraph' | 'gantt' | 'timeline') => calls.push(`bottomTab:${value}`),
    setDocumentSemanticMode: (value: 'document' | 'keyword') => calls.push(`semantic:${value}`),
    setFrontmatterModeEnabled: (value: boolean) => calls.push(`frontmatter:${String(value)}`),
    setMultiDimTableModeEnabled: (value: boolean) => calls.push(`mdtbl:${String(value)}`),
  }

  applyCanvasViewSelection({
    ...baseParams,
    id: 'document:frontmatter',
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
  })
  const frontmatterCalls = calls.splice(0)
  if (frontmatterCalls.join('|') !== 'mdtbl:false|frontmatter:true|semantic:document') {
    throw new Error(`expected Frontmatter toolbar action to normalize conflicting mode flags, got ${frontmatterCalls.join('|')}`)
  }

  applyCanvasViewSelection({
    ...baseParams,
    id: 'document:multiDimTable',
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
  })
  const tableCalls = calls.splice(0)
  if (tableCalls.join('|') !== 'frontmatter:false|mdtbl:true|semantic:document') {
    throw new Error(`expected Multi-dimensional Table toolbar action to normalize conflicting mode flags, got ${tableCalls.join('|')}`)
  }

  applyCanvasViewSelection({
    ...baseParams,
    id: 'document:multiDimTable',
    canvas2dRenderer: 'storyboard',
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
  })
  const storyboardTableCalls = calls.splice(0)
  if (storyboardTableCalls.join('|') !== 'mdtbl:true|semantic:document') {
    throw new Error(`expected Multi-dimensional Table toolbar action to re-apply table mode for non-graph renderer handoff, got ${storyboardTableCalls.join('|')}`)
  }

  applyCanvasViewSelection({
    ...baseParams,
    id: 'renderer:multiDimTable',
    canvas2dRenderer: 'd3',
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
  })
  const tableRendererCalls = calls.splice(0)
  if (tableRendererCalls.join('|') !== 'renderer:multiDimTable|frontmatter:false|mdtbl:true|semantic:document') {
    throw new Error(`expected Multi-dimensional Table renderer action to enter shared table mode, got ${tableRendererCalls.join('|')}`)
  }

  applyCanvasViewSelection({
    ...baseParams,
    id: 'renderer:d3',
    canvas2dRenderer: 'multiDimTable',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
  })
  const d3RendererCalls = calls.splice(0)
  if (d3RendererCalls.join('|') !== 'renderer:d3|mdtbl:false') {
    throw new Error(`expected switching away from Multi-dimensional Table renderer to clear table mode, got ${d3RendererCalls.join('|')}`)
  }
}

export function testMultiDimTableModeUsesGraphCapableRenderer() {
  useGraphStore.getState().resetAll()
  const store = useGraphStore.getState()
  store.setCanvasRenderMode('2d')
  store.setCanvas2dRenderer('storyboard')
  store.setDocumentSemanticMode('keyword')
  store.setFrontmatterModeEnabled(true)
  store.setMultiDimTableModeEnabled(true)

  const next = useGraphStore.getState()
  if (next.canvasRenderMode !== '2d') throw new Error(`expected Multi-dimensional Table mode to stay on 2D surface, got ${String(next.canvasRenderMode)}`)
  if (next.canvas2dRenderer !== 'multiDimTable') throw new Error(`expected Multi-dimensional Table mode to switch Storyboard to Multi-dimensional Table renderer, got ${String(next.canvas2dRenderer)}`)
  if (next.frontmatterModeEnabled !== false) throw new Error('expected Multi-dimensional Table mode to disable Frontmatter mode')
  if (next.multiDimTableModeEnabled !== true) throw new Error('expected Multi-dimensional Table mode to be enabled')
  if (next.documentSemanticMode !== 'keyword') throw new Error('expected renderer handoff to avoid changing semantic mode outside explicit toolbar actions')
}

export function testMultiDimTableRestoreUsesGraphCapableRenderer() {
  useGraphStore.getState().resetAll()
  const store = useGraphStore.getState()
  store.setCanvasRenderMode('2d')
  store.setCanvas2dRenderer('storyboard')
  store.setMultiDimTableModeEnabled(false)

  applySavedDocumentUiModeStateWrites(useGraphStore.getState(), {
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    canvasRenderMode: '2d',
    canvas3dMode: undefined,
    canvas2dRenderer: 'storyboard',
  })

  const next = useGraphStore.getState()
  if (next.canvasRenderMode !== '2d') throw new Error(`expected restored Multi-dimensional Table mode to use 2D surface, got ${String(next.canvasRenderMode)}`)
  if (next.canvas2dRenderer !== 'multiDimTable') throw new Error(`expected restored Multi-dimensional Table mode to normalize stale Storyboard renderer to Multi-dimensional Table, got ${String(next.canvas2dRenderer)}`)
  if (next.multiDimTableModeEnabled !== true) throw new Error('expected restored Multi-dimensional Table mode to stay enabled')
  if (next.frontmatterModeEnabled !== false) throw new Error('expected restored Multi-dimensional Table mode to keep Frontmatter mode disabled')
}

export function testDocumentFocusModeResolverPrecedence() {
  const storage = ensureLocalStorage()
  storage.clear()

  const mdTableOnly = [
    '# Table',
    '',
    '| Task | Status | Date | Category |',
    '| --- | --- | --- | --- |',
    '| Try | Done | 2023-08-01 | A,1 |',
    '| Visit | Todo | 2023-08-03 | 1,Y |',
    '',
  ].join('\n')
  const gTable = parseJsonLd(buildMarkdownJsonLd('table-resolver.md', mdTableOnly))
  const baseNodeCount = Array.isArray(gTable.nodes) ? gTable.nodes.length : 0
  if (baseNodeCount === 0) throw new Error('expected baseline markdown graph nodes for precedence test')

  const docNode = (gTable.nodes || []).find(n => String((n as any)?.type || '') === 'Document') as any
  const documentPath = String(docNode?.properties?.path || 'table-resolver.md')
  const tableNode = (gTable.nodes || []).find(n => String((n as any)?.type || '') === 'Table') as any
  const lineStart = Math.max(1, Math.floor(Number(tableNode?.metadata?.lineStart || 1)))
  const lineEnd = Math.max(lineStart, Math.floor(Number(tableNode?.metadata?.lineEnd || lineStart)))
  const tableId = `md-block:${lineStart}-${lineEnd}`
  writeWorkspaceDataViewState({
    activeDocumentPath: documentPath,
    tableId,
    value: {
      sv: 1,
      activeViewId: 'v0',
      views: [
        {
          v: 2,
          id: 'v0',
          name: 'Table',
          layout: 'table',
          groupByColumnId: null,
          visibleColumnIds: null,
          columnTypesById: null,
          filterGroups: [{ id: 'g0', rules: [] }],
          sortRules: [],
          graphEnabled: true,
          graphRolesByColumnId: { col_0: 'node', col_1: 'color', col_3: 'group' },
        },
      ],
    },
  })

  const frontmatterOnly = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  const multiDimOnly = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  const bothEnabled = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })

  const frontmatterNodeCount = Array.isArray(frontmatterOnly.nodes) ? frontmatterOnly.nodes.length : 0
  const multiDimNodeCount = Array.isArray(multiDimOnly.nodes) ? multiDimOnly.nodes.length : 0
  const bothEnabledNodeCount = Array.isArray(bothEnabled.nodes) ? bothEnabled.nodes.length : 0
  if (multiDimNodeCount === 0) throw new Error('expected multi-dimensional table mode to produce non-blank graph when DataView graph is enabled')
  if (bothEnabledNodeCount !== frontmatterNodeCount) {
    throw new Error('expected frontmatter mode to take precedence over multi-dimensional table mode when both toggles are enabled')
  }
  if (bothEnabledNodeCount === multiDimNodeCount) {
    throw new Error('expected both-enabled mode resolution to avoid multi-dimensional table derivation when frontmatter mode is active')
  }

  const keywordMode = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'keyword',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  if ((keywordMode.nodes || []).length !== (gTable.nodes || []).length || (keywordMode.edges || []).length !== (gTable.edges || []).length) {
    throw new Error('expected keyword mode to bypass frontmatter and multi-dimensional table transforms without changing graph content')
  }
  if (String(((keywordMode.metadata || {}) as Record<string, unknown>)['kg:activeDocumentViewMode'] || '') !== 'keyword') {
    throw new Error('expected keyword mode result to retain active document mode metadata')
  }

  const baselineLocked = deriveGraphDataForActiveView({
    graphData: gTable,
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: true,
    collapsedGroupIds: [],
  })
  if ((baselineLocked.nodes || []).length !== (gTable.nodes || []).length || (baselineLocked.edges || []).length !== (gTable.edges || []).length) {
    throw new Error('expected document structure baseline lock to bypass derived document mode transforms without changing graph content')
  }
  if (String(((baselineLocked.metadata || {}) as Record<string, unknown>)['kg:activeDocumentViewMode'] || '') !== 'documentStructure') {
    throw new Error('expected baseline lock result to retain document structure active mode metadata')
  }
}

export function testMultiDimTableActiveViewDerivesRawCsvSourceTableGraph() {
  const storage = ensureLocalStorage()
  storage.clear()

  const markdownName = '/docs/source-table.csv'
  const markdownText = [
    'URL,Title,Status,Category',
    'https://example.com/a,Alpha,Done,AI',
    'https://example.com/b,Beta,Doing,Data',
    '',
  ].join('\n')
  writeWorkspaceDataViewState({
    activeDocumentPath: markdownName,
    tableId: buildWorkspaceDataViewSourceTableId(2),
    value: {
      sv: 1,
      activeViewId: 'v0',
      views: [
        {
          v: 2,
          id: 'v0',
          name: 'Table',
          layout: 'table',
          groupByColumnId: null,
          visibleColumnIds: null,
          columnTypesById: null,
          filterGroups: [{ id: 'g0', rules: [] }],
          sortRules: [],
          graphEnabled: true,
          graphRolesByColumnId: { col_1: 'node', col_2: 'color', col_3: 'group' },
        },
      ],
    },
  })

  const derived = deriveGraphDataForActiveView({
    graphData: {
      type: 'Graph',
      context: 'workspace-active-source',
      nodes: [],
      edges: [],
      metadata: { source: `markdown:${markdownName}` },
    },
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
    markdownName,
    markdownText,
    jsonSourceText: null,
  })

  const labels = new Set((derived.nodes || []).map(node => String((node as { label?: unknown }).label || '').trim()))
  if (!labels.has('Alpha') || !labels.has('Beta')) {
    throw new Error('expected raw CSV source table graph to derive nodes from configured DataView node column')
  }
  if (String(((derived.metadata || {}) as Record<string, unknown>)['kg:activeDocumentViewMode'] || '') !== 'multiDimTable') {
    throw new Error('expected raw CSV source table graph to retain Multi-dimensional Table active mode metadata')
  }
}

export function testMultiDimTableActiveViewBoundsNonRoleCellProperties() {
  const storage = ensureLocalStorage()
  storage.clear()

  const markdownName = '/docs/source-table.csv'
  const longDescription = `Long description ${'payload '.repeat(120)}end`
  const markdownText = [
    'Title,Description,Status',
    `Alpha,"${longDescription}",Done`,
    '',
  ].join('\n')
  writeWorkspaceDataViewState({
    activeDocumentPath: markdownName,
    tableId: buildWorkspaceDataViewSourceTableId(1),
    value: {
      sv: 1,
      activeViewId: 'v0',
      views: [
        {
          v: 2,
          id: 'v0',
          name: 'Table',
          layout: 'table',
          groupByColumnId: null,
          visibleColumnIds: null,
          columnTypesById: null,
          filterGroups: [{ id: 'g0', rules: [] }],
          sortRules: [],
          graphEnabled: true,
          graphRolesByColumnId: { col_0: 'node', col_2: 'color' },
        },
      ],
    },
  })

  const derived = deriveGraphDataForActiveView({
    graphData: {
      type: 'Graph',
      context: 'workspace-active-source',
      nodes: [],
      edges: [],
      metadata: { source: `markdown:${markdownName}` },
    },
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
    markdownName,
    markdownText,
    jsonSourceText: null,
  })

  const alpha = (derived.nodes || []).find(node => String((node as { label?: unknown }).label || '') === 'Alpha')
  if (!alpha) throw new Error('expected raw CSV source table graph to derive Alpha node')
  const description = String(((alpha.properties || {}) as Record<string, unknown>)['md:table:description'] || '')
  if (!description || description === longDescription) {
    throw new Error('expected non-role CSV graph property to use bounded display text instead of full payload')
  }
  if (description.length > MARKDOWN_TABLE_GRAPH_CELL_PROPERTY_PREVIEW_CHAR_LIMIT + 3) {
    throw new Error(`expected bounded graph property length, got ${description.length}`)
  }
  if (String(((alpha.properties || {}) as Record<string, unknown>)['md:table:title'] || '') !== 'Alpha') {
    throw new Error('expected node role property to preserve the full node label value')
  }
}
