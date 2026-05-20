import { buildMarkdownJsonLd } from '@/lib/parsers/markdownJsonLd.impl'
import { readDocumentMetadataEntries } from '@/lib/graph/documentMetadata'

export async function testMarkdownAppendixMetadataEntriesSurfaceInDerivedGraphMetadata() {
  const markdown = [
    'Press `@key:Ctrl+S` to save.',
    '',
    '---',
    '',
    '<!-- appendix -->',
    '',
    '[^1]: Existing citation.',
    '',
    '<!-- metadata | type: key | value: Ctrl+S | note: Save shortcut used in toolbar copy. -->',
    '<!-- metadata | type: url | value: https://devpost.com | note: Canonical submission destination. -->',
    '',
    '<!-- /appendix -->',
  ].join('\n')
  const jsonld = buildMarkdownJsonLd('appendix-metadata.md', markdown) as Record<string, unknown>
  const rootMetadata = (jsonld.metadata || {}) as Record<string, unknown>
  const entries = readDocumentMetadataEntries(rootMetadata)
  if (entries.length !== 2) {
    throw new Error(`expected derived graph metadata to expose two typed document metadata entries; got ${JSON.stringify(entries)}`)
  }
  if (entries[0]?.type !== 'key' || entries[0]?.value !== 'Ctrl+S' || entries[0]?.note !== 'Save shortcut used in toolbar copy.') {
    throw new Error(`expected first metadata entry to preserve type/value/note; got ${JSON.stringify(entries[0] || null)}`)
  }
  if (entries[1]?.type !== 'url' || entries[1]?.value !== 'https://devpost.com' || entries[1]?.note !== 'Canonical submission destination.') {
    throw new Error(`expected second metadata entry to preserve type/value/note; got ${JSON.stringify(entries[1] || null)}`)
  }
  const graph = Array.isArray(jsonld['@graph']) ? (jsonld['@graph'] as Array<Record<string, unknown>>) : []
  const documentNode = graph.find(node => node && node['@type'] === 'Document') || null
  if (!documentNode) throw new Error('expected derived graph to include a document node')
  const docProps = (documentNode.properties || {}) as Record<string, unknown>
  const docEntries = readDocumentMetadataEntries({ documentMetadataEntries: docProps.documentMetadataEntries })
  if (docEntries.length !== 2) {
    throw new Error(`expected document node properties to expose document metadata entries; got ${JSON.stringify(docEntries)}`)
  }
}
