import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { deriveMarkdownTableGraphForFrontmatterMode } from '@/features/markdown/tableGraph/deriveMarkdownTableGraph'
import { writeWorkspaceDataViewState } from '@/components/BottomPanel/markdownWorkspace/main/viewer/workspaceDataViewConfig'

export function testMarkdownTableGraphFrontmatterDerivationFromAirvioStyleTable() {
  const md = [
    '# Getting Started',
    '',
    '| Task | Status | Date | Category |',
    '| --- | --- | --- | --- |',
    '| Try the Infinite Canvas | Done | 2023-08-01 | A,1 |',
    '| Observe what airvio can do | Doing | 2023-08-02 | B,2 |',
    '| Visit airvio | Done | 2023-08-03 | 1,Y |',
    '| Invite and collaborate | Todo | 2023-08-08 | 2,Z |',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('airvio-index.md', md)
  const baseGraph = parseJsonLd(jsonld)

  const docNode = (baseGraph.nodes || []).find(n => String((n as any)?.type || '') === 'Document') as any
  const documentPath = String(docNode?.properties?.path || 'airvio-index.md')
  const tableNode = (baseGraph.nodes || []).find(n => String((n as any)?.type || '') === 'Table') as any
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
          graphRolesByColumnId: {
            col_0: 'node',
            col_1: 'color',
            col_3: 'group',
          },
        },
      ],
    },
  })

  const derived = deriveMarkdownTableGraphForFrontmatterMode({ graphData: baseGraph })
  if (!derived) throw new Error('expected a derived table graph')

  const labels = new Set((derived.nodes || []).map(n => String((n as { label?: unknown }).label || '').trim()).filter(Boolean))
  if (!labels.has('Try the Infinite Canvas')) throw new Error('missing task node: Try the Infinite Canvas')
  if (!labels.has('Invite and collaborate')) throw new Error('missing task node: Invite and collaborate')

  const doneNode = (derived.nodes || []).find(n => String((n as any).label || '') === 'Try the Infinite Canvas') as any
  const fill = doneNode?.properties?.['visual:fill']
  if (typeof fill !== 'string' || !fill.trim()) throw new Error('expected status-based visual:fill for Done')

  const meta = (derived.metadata || {}) as Record<string, unknown>
  const subgraphs = meta['kg:subgraphs']
  if (!Array.isArray(subgraphs) || subgraphs.length < 1) throw new Error('expected at least one cluster subgraph from Category')
}

export function testMarkdownTableGraphFrontmatterDerivationWithoutWorkspaceConfig() {
  const md = [
    '# Single Table',
    '',
    '| Task | Status | Category |',
    '| --- | --- | --- |',
    '| Keep D3 table visible | Doing | A,1 |',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('table-no-config.md', md)
  const baseGraph = parseJsonLd(jsonld)
  const derived = deriveMarkdownTableGraphForFrontmatterMode({ graphData: baseGraph })
  if (!derived) throw new Error('expected derived graph without stored workspace config')

  const labels = new Set((derived.nodes || []).map(n => String((n as { label?: unknown }).label || '').trim()).filter(Boolean))
  if (!labels.has('Keep D3 table visible')) throw new Error('expected single-row table task node to be derived')
}

export function testMarkdownTableGraphFrontmatterDerivationForceEnabledIgnoresStoredDisable() {
  const md = [
    '# Forced Graph',
    '',
    '| Task | Status | Category |',
    '| --- | --- | --- |',
    '| Keep visible when disabled | Doing | A,1 |',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('table-force-enabled.md', md)
  const baseGraph = parseJsonLd(jsonld)
  const docNode = (baseGraph.nodes || []).find(n => String((n as any)?.type || '') === 'Document') as any
  const documentPath = String(docNode?.properties?.path || 'table-force-enabled.md')
  const tableNode = (baseGraph.nodes || []).find(n => String((n as any)?.type || '') === 'Table') as any
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
          graphEnabled: false,
          graphRolesByColumnId: {
            col_0: 'node',
            col_1: 'color',
            col_2: 'group',
          },
        },
      ],
    },
  })

  const forced = deriveMarkdownTableGraphForFrontmatterMode({ graphData: baseGraph, forceGraphEnabled: true })
  if (!forced) throw new Error('expected forced derivation to return graph')
  if (!Array.isArray(forced.nodes) || forced.nodes.length < 1) throw new Error('expected forced derivation to include nodes')
}

export function testMarkdownTableGraphFrontmatterPrefersConfiguredTableWhenMultipleTablesExist() {
  const md = [
    '# Two Tables',
    '',
    '| Task | Status |',
    '| --- | --- |',
    '| First table row | Done |',
    '',
    '| Task | Status |',
    '| --- | --- |',
    '| Second table row | Doing |',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('two-tables.md', md)
  const baseGraph = parseJsonLd(jsonld)

  const docNode = (baseGraph.nodes || []).find(n => String((n as any)?.type || '') === 'Document') as any
  const documentPath = String(docNode?.properties?.path || 'two-tables.md')
  const tableNodes = (baseGraph.nodes || []).filter(n => String((n as any)?.type || '') === 'Table') as any[]
  if (tableNodes.length < 2) throw new Error('expected two Table nodes')
  const tableNode = tableNodes[1]
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
          graphRolesByColumnId: {
            col_0: 'node',
            col_1: 'color',
          },
        },
      ],
    },
  })

  const derived = deriveMarkdownTableGraphForFrontmatterMode({ graphData: baseGraph })
  if (!derived) throw new Error('expected a derived table graph')
  const labels = new Set((derived.nodes || []).map(n => String((n as { label?: unknown }).label || '').trim()).filter(Boolean))
  if (!labels.has('Second table row')) throw new Error('expected configured second table to be selected')
  if (labels.has('First table row')) throw new Error('expected first table row to be absent when second table is configured')
}
