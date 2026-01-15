import { CODEBASE_INDEX_PIPELINE_COMMAND, HELP_PIPELINE_COMMAND_TEXT } from '@/lib/config'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'

export async function testHelpPipelineCopyMatchesCommandConstant() {
  if (!CODEBASE_INDEX_PIPELINE_COMMAND.includes('python -m knowgrph_parser markdown')) {
    throw new Error('pipeline command missing markdown CLI invocation')
  }
  if (!CODEBASE_INDEX_PIPELINE_COMMAND.includes('docs/knowgrph-pipeline-document.md')) {
    throw new Error('pipeline command missing default markdown input path')
  }
  if (HELP_PIPELINE_COMMAND_TEXT !== CODEBASE_INDEX_PIPELINE_COMMAND) {
    throw new Error('HelpView pipeline command text does not match CODEBASE_INDEX_PIPELINE_COMMAND')
  }
  await Promise.resolve()
}

export function testMarkdownParserMetadataAnchorsAreAgenticRagCompatible() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const markdown = [
    '# Title',
    '',
    'Paragraph with a [link](https://example.com).',
    '',
    '![Alt text](https://example.com/image.png)',
    '',
    '## Section',
    '',
    '- a',
    '- b',
    '',
    '```ts',
    'console.log("x")',
    '```',
    '',
  ].join('\n')
  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`markdown parse warnings: ${res.warnings.join('; ')}`)
  const nodes = res.graphData.nodes || []
  if (nodes.length < 2) throw new Error(`expected markdown nodes, got ${nodes.length}`)
  const doc = nodes.find(n => n.type === 'Document')
  if (!doc) throw new Error('missing Document node')
  const img = nodes.find(n => n.type === 'Image')
  if (!img) throw new Error('missing Image node')
  const imgProps = (img.properties || {}) as Record<string, unknown>
  const imgUrl = String(imgProps.url || imgProps.media_url || '')
  if (imgUrl !== 'https://example.com/image.png') throw new Error(`Image url mismatch: ${imgUrl}`)
  const edges = res.graphData.edges || []
  const embeds = edges.find(e => e.label === 'embedsImage' && e.target === img.id)
  if (!embeds) throw new Error('missing embedsImage edge to Image node')
  const meta = (doc.metadata || {}) as Record<string, unknown>
  if (meta.parsedAt) throw new Error('metadata.parsedAt should not be emitted')
  const documentPath = String(meta.documentPath || '')
  if (documentPath !== 'doc.md') throw new Error(`metadata.documentPath mismatch: ${documentPath}`)
  const ts = String(meta.timestamp || '')
  if (!ts || !Number.isFinite(Date.parse(ts))) throw new Error(`metadata.timestamp not ISO: ${ts}`)
  const lineStart = meta.lineStart
  const lineEnd = meta.lineEnd
  if (typeof lineStart !== 'number' || lineStart !== 1) throw new Error(`metadata.lineStart mismatch: ${String(lineStart)}`)
  if (typeof lineEnd !== 'number' || lineEnd < lineStart) throw new Error(`metadata.lineEnd mismatch: ${String(lineEnd)}`)
  const props = (doc.properties || {}) as Record<string, unknown>
  const docLabels = props.labels
  if (!Array.isArray(docLabels) || !docLabels.map(v => String(v)).includes('Document')) {
    throw new Error('Document node should include labels[] with Document')
  }
}

export function testMarkdownGraphSupportsDocumentStructureLayerMode() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const markdown = ['# Title', '', 'Paragraph one.', '', 'Paragraph two.'].join('\n')
  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`markdown parse warnings: ${res.warnings.join('; ')}`)
  const baseGraph = res.graphData
  const schema: GraphSchema = {
    ...defaultSchema,
    layers: {
      ...(defaultSchema.layers || {}),
      mode: 'document-structure',
    },
  }
  const derived = deriveGraphDataForLayers(baseGraph, schema)
  if (!derived) throw new Error('deriveGraphDataForLayers returned null for markdown graph')
  const nodes = Array.isArray(derived.nodes) ? derived.nodes : []
  if (nodes.length === 0) throw new Error('document-structure layer produced no nodes')
  const docOrSection = nodes.find(n => n.type === 'Document' || n.type === 'Section')
  if (!docOrSection) throw new Error('expected Document or Section node in markdown graph')
  const props = (docOrSection.properties || {}) as Record<string, unknown>
  const layer = props['visual:layer']
  if (typeof layer !== 'number' || layer <= 0) {
    throw new Error('document-structure layer should assign numeric visual:layer to structural nodes')
  }
}

export function testMarkdownGraphSupportsSemanticLayerMode() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const markdown = [
    '# Title',
    '',
    'First paragraph about graphs and layers.',
    '',
    'Second paragraph about graphs, tokens, and similarity edges.',
  ].join('\n')
  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`markdown parse warnings: ${res.warnings.join('; ')}`)
  const baseGraph = res.graphData
  const schema: GraphSchema = {
    ...defaultSchema,
    layers: {
      ...(defaultSchema.layers || {}),
      mode: 'semantic',
      semantic: {
        ...(defaultSchema.layers?.semantic || {}),
        similarityEdgeLabel: 'relatedTo',
        textKeys: ['chunk_text'],
        topKEdgesPerNode: 2,
        minSimilarity: 0,
      },
    },
  }
  const derived = deriveGraphDataForLayers(baseGraph, schema)
  if (!derived) throw new Error('deriveGraphDataForLayers returned null for markdown graph in semantic mode')
  const edges = Array.isArray(derived.edges) ? derived.edges : []
  if (!edges.length) throw new Error('semantic layer produced no edges for markdown graph')
  const semanticEdges = edges.filter(e => {
    const meta = (e.metadata || {}) as Record<string, unknown>
    return meta.kind === 'semantic'
  })
  if (semanticEdges.length === 0) {
    throw new Error('semantic layer did not produce any derived semantic edges for markdown graph')
  }
}
