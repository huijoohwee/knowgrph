import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { builtInParsers } from '@/features/parsers/default'
import { listParsers, registerParser, resetParsers } from '@/features/parsers/registry'
import { toParserId, type ParserSpec } from '@/features/parsers/types'

export async function testLoaderCachesMarkdownFallbackPreferenceForRepeatedMarkdownImports() {
  const original = listParsers()
  const markdownSpec = builtInParsers.find(spec => String(spec.id) === 'markdown')
  if (!markdownSpec) throw new Error('expected built-in markdown parser to be available for fallback suppression test')

  const fakeEmptyMarkdownParser: ParserSpec = {
    id: toParserId('fake-empty-markdown'),
    name: 'Fake Empty Markdown',
    match: (name: string) => String(name || '').toLowerCase().endsWith('.md'),
    parse: () => ({
      graphData: {
        type: 'Graph',
        context: 'fake-empty-markdown',
        nodes: [],
        edges: [],
      },
      warnings: ['fake empty markdown parser'],
    }),
  }

  try {
    resetParsers()
    registerParser(fakeEmptyMarkdownParser)
    registerParser(markdownSpec)

    const name = 'fallback-preference-geo-markdown.md'
    const text = [
      'This is a plain text markdown document that intentionally avoids headings, fences, links, tables, and list markers so the markdown parser is not preferred on first selection.',
    ].join(' ')

    const first = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
    if (!first?.graphData) throw new Error('expected first markdown load to produce graph data')
    if (first.parserId !== 'markdown') {
      throw new Error(`expected first load to land on markdown parser after fallback, got ${String(first.parserId)}`)
    }
    const firstWarnings = Array.isArray(first.warnings) ? first.warnings : []
    if (!firstWarnings.some(warning => String(warning || '').includes('used markdown parser instead'))) {
      throw new Error('expected first load to report markdown fallback from the fake empty parser')
    }

    const second = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
    if (!second?.graphData) throw new Error('expected second markdown load to produce graph data')
    if (second.parserId !== 'markdown') {
      throw new Error(`expected second load to route directly to markdown parser, got ${String(second.parserId)}`)
    }
    const warnings = Array.isArray(second.warnings) ? second.warnings : []
    if (warnings.some(warning => String(warning || '').includes('used markdown parser instead'))) {
      throw new Error('expected second load to skip fallback warning after caching markdown parser preference')
    }
  } finally {
    resetParsers()
    original.forEach(spec => registerParser(spec))
  }
}

export async function testBestMatchPrefersMarkdownForStructuredGeoMarkdownOnFirstLoad() {
  const original = listParsers()
  const markdownSpec = builtInParsers.find(spec => String(spec.id) === 'markdown')
  if (!markdownSpec) throw new Error('expected built-in markdown parser to be available for structured markdown preference test')

  const fakeEmptyMarkdownParser: ParserSpec = {
    id: toParserId('fake-empty-markdown-structured'),
    name: 'Fake Empty Markdown Structured',
    match: (name: string) => String(name || '').toLowerCase().endsWith('.md'),
    parse: () => ({
      graphData: {
        type: 'Graph',
        context: 'fake-empty-markdown-structured',
        nodes: [],
        edges: [],
      },
      warnings: ['fake empty structured markdown parser'],
    }),
  }

  try {
    resetParsers()
    registerParser(fakeEmptyMarkdownParser)
    registerParser(markdownSpec)

    const name = 'structured-geo-markdown.md'
    const text = [
      '---',
      'kgCanvasSurfaceMode: "geospatial"',
      'kgCanvas2dRenderer: "flowEditor"',
      '---',
      '',
      '| Name | Coordinates (`lat, lng`) |',
      '|---|---|',
      '| A | `1.29027, 103.851959` |',
      '',
    ].join('\n')

    const result = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
    if (!result?.graphData) throw new Error('expected structured markdown load to produce graph data')
    if (result.parserId !== 'markdown') {
      throw new Error(`expected structured geo markdown to select markdown on first load, got ${String(result.parserId)}`)
    }
    const warnings = Array.isArray(result.warnings) ? result.warnings : []
    if (warnings.some(warning => String(warning || '').includes('used markdown parser instead'))) {
      throw new Error('expected structured geo markdown to avoid fallback warning on first load')
    }
  } finally {
    resetParsers()
    original.forEach(spec => registerParser(spec))
  }
}
