import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import { buildTextWidgetOutputSrcDoc } from '@/lib/render/widgetOutputSrcDoc'

export function testRichMediaPanelTextFallbackRendersMarkdownBlocksAsHtml() {
  const markdown = [
    '| Kind | Value |',
    '| --- | --- |',
    '| Table | Multi-dimensional |',
    '',
    '```ts',
    'const value = 42',
    '```',
    '',
    '> Quoted line',
  ].join('\n')

  const spec = getNodeMediaSpec({
    id: 'rich-media-panel-markdown-blocks',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    label: 'Rich Media Panel',
    properties: {
      richMediaActiveTab: 'text',
      output: markdown,
    },
  } as Parameters<typeof getNodeMediaSpec>[0])

  if (!spec) throw new Error('expected Rich Media Panel markdown text fallback to produce a media spec')
  if (spec.kind !== 'iframe') throw new Error(`expected Rich Media Panel markdown text fallback to render as iframe, got ${String(spec.kind)}`)
  const srcDoc = String(spec.srcDoc || '')
  for (const snippet of ['data-kg-rich-media-markdown-srcdoc="1"', '<table>', '<blockquote>', '<pre><code', 'const value = 42']) {
    if (!srcDoc.includes(snippet)) throw new Error(`expected markdown srcDoc snippet: ${snippet}`)
  }
}

export function testTextWidgetOutputSrcDocEscapesRawHtmlWhileRenderingMarkdown() {
  const srcDoc = buildTextWidgetOutputSrcDoc({
    title: 'Raw HTML guard',
    text: ['# Title', '', '<script>alert(1)</script>', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
  })
  if (srcDoc.includes('<script>alert(1)</script>')) {
    throw new Error('expected text widget srcDoc to escape raw script HTML')
  }
  if (!srcDoc.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) {
    throw new Error('expected escaped script text to remain visible in markdown output')
  }
  if (!srcDoc.includes('<table>')) throw new Error('expected markdown table to render in text widget srcDoc')
}

export function testMarkdownViewerDocumentNormalizesGenericDivContainers() {
  const srcDoc = buildTextWidgetOutputSrcDoc({
    title: 'Semantic HTML guard',
    text: ['A generic HTML division element should stay readable as text:', '', '<div><span>Plain text</span></div>'].join('\n'),
  })
  if (/<div\b|<\/div>/i.test(srcDoc)) {
    throw new Error(`expected generated markdown viewer srcDoc to avoid generic HTML division element tags, got: ${srcDoc}`)
  }
  if (!srcDoc.includes('&lt;div&gt;&lt;span&gt;Plain text&lt;/span&gt;&lt;/div&gt;')) {
    throw new Error('expected raw markdown div text to remain escaped and visible')
  }
  if (!srcDoc.includes('<main>') || !srcDoc.includes('<section data-kg-rich-media-markdown-srcdoc="1">')) {
    throw new Error('expected generated markdown viewer srcDoc to use semantic main/section containers')
  }
}

export function testRichMediaMediaAliasesHaveSingleSharedOwner() {
  const root = process.cwd()
  const owner = readFileSync(resolve(root, 'src', 'lib', 'canvas', 'graph-elements', 'mediaProperties.ts'), 'utf8')
  const parserUtils = readFileSync(resolve(root, 'src', 'features', 'parsers', 'markdownJsonLdUtils.ts'), 'utf8')
  const builder = readFileSync(resolve(root, 'src', 'features', 'parsers', 'markdownJsonLdBuilder.ts'), 'utf8')
  const parserImpl = readFileSync(resolve(root, 'src', 'lib', 'parsers', 'markdownJsonLd.impl.ts'), 'utf8')

  if (!owner.includes('export function buildAliasedMediaProperties')) {
    throw new Error('expected media alias helper to live in the shared media properties owner')
  }
  for (const [label, text] of [['utils', parserUtils], ['builder', builder], ['impl', parserImpl]] as const) {
    if (!text.includes("buildAliasedMediaProperties } from '@/lib/canvas/graph-elements/mediaProperties'")) {
      throw new Error(`expected markdown parser ${label} to reuse shared media alias helper`)
    }
    if (text.includes('function buildAliasedMediaProperties') || text.includes('const buildAliasedMediaProperties =')) {
      throw new Error(`expected markdown parser ${label} not to own a duplicate media alias helper`)
    }
  }
}

export function testMarkdownTableGraphCacheUsesSharedSemanticKey() {
  const tableGraph = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'markdown', 'tableGraph', 'deriveMarkdownTableGraph.ts'),
    'utf8',
  )
  if (!tableGraph.includes("buildScopedGraphSemanticKey('markdown-table-graph'")) {
    throw new Error('expected multi-dimensional table graph cache to reuse shared scoped semantic key helper')
  }
  if (tableGraph.includes('fnv1a32PushString') || tableGraph.includes('hashStringToHex(')) {
    throw new Error('expected multi-dimensional table graph cache to remove local hash owners')
  }
}
