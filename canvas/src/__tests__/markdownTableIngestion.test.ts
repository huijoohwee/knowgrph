import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'

export function testMarkdownAsciiTableFenceIngestionCreatesTableNodeWithCells() {
  const md = [
    '# Doc',
    '',
    '┌────┬────┐',
    '│ A  │ B  │',
    '├────┼────┤',
    '│ 1  │ 2  │',
    '└────┴────┘',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('test.md', md) as unknown as { ['@graph']?: unknown }
  const graph = (jsonld['@graph'] as unknown[]) || []
  const table = graph.find(n => (n as { ['@type']?: unknown })['@type'] === 'Table') as
    | { properties?: Record<string, unknown> }
    | undefined
  if (!table) throw new Error('expected a Table node')
  const props = table.properties || {}
  const header = props['table:header']
  const rows = props['table:rows']
  if (!Array.isArray(header) || header.join('|') !== 'A|B') {
    throw new Error(`unexpected table header: ${Array.isArray(header) ? header.join('|') : String(header)}`)
  }
  if (!Array.isArray(rows) || !Array.isArray(rows[0]) || (rows[0] as unknown[]).join('|') !== '1|2') {
    throw new Error('unexpected table rows')
  }
  const w = props['visual:width']
  const h = props['visual:height']
  if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0) throw new Error('expected visual:width')
  if (typeof h !== 'number' || !Number.isFinite(h) || h <= 0) throw new Error('expected visual:height')
}

export function testMarkdownPipeTableIngestionCreatesTableNodeWithCells() {
  const md = [
    '# Doc',
    '',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('test.md', md) as unknown as { ['@graph']?: unknown }
  const graph = (jsonld['@graph'] as unknown[]) || []
  const table = graph.find(n => (n as { ['@type']?: unknown })['@type'] === 'Table') as
    | { properties?: Record<string, unknown> }
    | undefined
  if (!table) throw new Error('expected a Table node')
  const props = table.properties || {}
  const header = props['table:header']
  const rows = props['table:rows']
  if (!Array.isArray(header) || header.join('|') !== 'A|B') {
    throw new Error(`unexpected table header: ${Array.isArray(header) ? header.join('|') : String(header)}`)
  }
  if (!Array.isArray(rows) || !Array.isArray(rows[0]) || (rows[0] as unknown[]).join('|') !== '1|2') {
    throw new Error('unexpected table rows')
  }
}

