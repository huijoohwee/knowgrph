import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { deriveGraphDataForActiveView } from '@/hooks/useActiveGraphData'
import { writeWorkspaceDataViewState } from '@/components/BottomPanel/markdownWorkspace/main/viewer/workspaceDataViewConfig'

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
