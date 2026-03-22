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
