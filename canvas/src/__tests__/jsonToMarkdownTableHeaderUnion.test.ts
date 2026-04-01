import { jsonToMarkdown, jsonToMarkdownPreferTable } from '@/features/markdown/jsonToMarkdown'

export async function testJsonToMarkdownTableHeaderUsesUnionOfRowKeys() {
  const rows = [
    { id: 'row-1', left: 'alpha' },
    { id: 'row-2', right: 'beta' },
    { id: 'row-3', center: 'gamma' },
  ]

  const markdown = jsonToMarkdown(rows, { defaultMode: 'table' }, 'table')
  const header = String(markdown.split('\n')[0] || '')

  if (!header.includes('id')) {
    throw new Error('expected header to include id column')
  }
  if (!header.includes('left')) {
    throw new Error('expected header to include left column from first row')
  }
  if (!header.includes('right')) {
    throw new Error('expected header to include right column from later row')
  }
  if (!header.includes('center')) {
    throw new Error('expected header to include center column from later row')
  }
}

export async function testJsonToMarkdownTableModeRendersTopLevelObjectArraysAsTables() {
  const value = {
    title: 'Example',
    nodes: [
      { id: 'n1', name: 'Alpha' },
      { id: 'n2', kind: 'service' },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
    ],
  }

  const markdown = jsonToMarkdown(value, { defaultMode: 'table' }, 'table')
  if (!markdown.includes('## nodes')) {
    throw new Error('expected table mode to render nodes heading')
  }
  if (!markdown.includes('## edges')) {
    throw new Error('expected table mode to render edges heading')
  }
  if (!markdown.includes('| id | name | kind |')) {
    throw new Error('expected nodes table header to include union of row keys')
  }
  if (!markdown.includes('| source | target |')) {
    throw new Error('expected edges table header to render for top-level array')
  }
}

export async function testJsonToMarkdownPreferTableAvoidsListStyleForJsonBackedObject() {
  const value = {
    meta: { project: 'Example' },
    stack: [
      { id: '01', tool: 'A' },
      { id: '02', tool: 'B', layer: ['x', 'y'] },
    ],
  }
  const markdown = jsonToMarkdownPreferTable(value, { defaultMode: 'hierarchical' }, 'hierarchical')
  if (!markdown.includes('| id | tool | layer |')) {
    throw new Error('expected prefer-table conversion to produce table header for object array')
  }
  if (markdown.includes('- **meta**')) {
    throw new Error('expected prefer-table conversion to avoid list-style fallback when tables exist')
  }
}
