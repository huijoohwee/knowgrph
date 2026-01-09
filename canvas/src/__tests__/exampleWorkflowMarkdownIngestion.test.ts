import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'

const EXAMPLE_WORKFLOW_MARKDOWN = [
  '# Example Workflow Markdown Fixture',
  '',
  'This is a minimal markdown fixture representing a slice of the',
  'example assessment document. It is intentionally compact and',
  'domain-agnostic while still exercising the markdown ingestion pipeline.',
  '',
  '## Section A',
  '',
  '- Item one',
  '- Item two',
  '',
  '[External link](https://example.com)',
  '',
  '![Example image](https://example.com/example.png)',
].join('\n')

export async function testExampleWorkflowMarkdownIngestionProducesGraph() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = String(EXAMPLE_WORKFLOW_MARKDOWN || '')
  if (!markdown.trim()) {
    throw new Error('example workflow markdown fixture text is empty')
  }

  const jsonld = buildMarkdownJsonLd('file://example-workflow.md', markdown)

  const res = applyParser(toParserId('jsonld'), {
    name: 'example-workflow.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  if (nodes.length === 0) {
    throw new Error('example workflow markdown produced no nodes')
  }
  const edges = res.graphData.edges || []
  if (edges.length === 0) {
    throw new Error('example workflow markdown produced no edges')
  }

  await Promise.resolve()
}

export async function testMarkdownMermaidFrontmatterTemplateProducesEntitiesEdgesAndMentions(markdown: string) {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const text = String(markdown ?? '')
  if (!text.trim()) {
    throw new Error('md-mmd-template markdown text is empty')
  }

  const jsonld = buildMarkdownJsonLd(
    'file://md-mmd-template.md',
    text,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'md-mmd-template.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []

  if (nodes.length === 0) {
    throw new Error('md-mmd-template produced no nodes')
  }
  if (edges.length === 0) {
    throw new Error('md-mmd-template produced no edges')
  }

  const semanticEdges = edges.filter(e => String((e as { label?: unknown }).label || '') === 'semanticRelation')
  if (semanticEdges.length > 0) {
    throw new Error('expected no semanticRelation edges derived from Mermaid frontmatter')
  }

  await Promise.resolve()
}

export async function testMarkdownFrontmatterOntologiesAndPolygonLayersRoundTrip() {
  const frontmatterLines = [
    '---',
    'ontologies:',
    '  - prefix: prov',
    '    iri: http://www.w3.org/ns/prov#',
    '  - prefix: mex',
    '    iri: http://mex.aksw.org/mex-core#',
    '  - prefix: pplan',
    '    iri: http://purl.org/net/p-plan#',
    '  - prefix: mls',
    '    iri: http://www.w3.org/ns/mls#',
    '  - prefix: geo',
    '    iri: http://www.opengis.net/ont/geosparql#',
    '  - prefix: ro',
    '    iri: https://w3id.org/ro/crate#',
    'polygonLayers:',
    '  - competencyHyperspace',
    '  - performanceSpace',
    '  - classDistributionSpace',
    '  - preprocessingCluster',
    '  - modelTypeClusters',
    '  - kpiViolationRegion',
    '  - candidateClusters',
    '  - assessmentRegion',
    '---',
    '',
    '# Title',
  ]
  const markdown = frontmatterLines.join('\n')
  const { meta } = lexMarkdown(markdown)
  const ontologies = (meta as Record<string, unknown>).ontologies
  const polygonLayers = (meta as Record<string, unknown>).polygonLayers
  if (!Array.isArray(ontologies)) {
    throw new Error('frontmatter ontologies is not an array')
  }
  if (!Array.isArray(polygonLayers)) {
    throw new Error('frontmatter polygonLayers is not an array')
  }
  const expectedOntologies = [
    { prefix: 'prov', iri: 'http://www.w3.org/ns/prov#' },
    { prefix: 'mex', iri: 'http://mex.aksw.org/mex-core#' },
    { prefix: 'pplan', iri: 'http://purl.org/net/p-plan#' },
    { prefix: 'mls', iri: 'http://www.w3.org/ns/mls#' },
    { prefix: 'geo', iri: 'http://www.opengis.net/ont/geosparql#' },
    { prefix: 'ro', iri: 'https://w3id.org/ro/crate#' },
  ]
  if (ontologies.length !== expectedOntologies.length) {
    throw new Error(
      `frontmatter ontologies length ${ontologies.length} != ${expectedOntologies.length}`,
    )
  }
  for (let i = 0; i < expectedOntologies.length; i += 1) {
    const actual = ontologies[i] as Record<string, unknown>
    const expected = expectedOntologies[i]
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`frontmatter ontologies[${i}] is not an object`)
    }
    const prefix = String(actual.prefix || '')
    const iri = String(actual.iri || '')
    if (prefix !== expected.prefix || iri !== expected.iri) {
      throw new Error(
        `frontmatter ontologies[${i}] mismatch: expected prefix=${expected.prefix} iri=${expected.iri}, got prefix=${prefix} iri=${iri}`,
      )
    }
  }
  const expectedPolygonLayers = [
    'competencyHyperspace',
    'performanceSpace',
    'classDistributionSpace',
    'preprocessingCluster',
    'modelTypeClusters',
    'kpiViolationRegion',
    'candidateClusters',
    'assessmentRegion',
  ]
  const polygonLayersStrings = polygonLayers.map(v => String(v || ''))
  if (polygonLayersStrings.length !== expectedPolygonLayers.length) {
    throw new Error(
      `frontmatter polygonLayers length ${polygonLayersStrings.length} != ${expectedPolygonLayers.length}`,
    )
  }
  for (let i = 0; i < expectedPolygonLayers.length; i += 1) {
    if (polygonLayersStrings[i] !== expectedPolygonLayers[i]) {
      throw new Error(
        `frontmatter polygonLayers[${i}] mismatch: expected ${expectedPolygonLayers[i]}, got ${polygonLayersStrings[i]}`,
      )
    }
  }
  await Promise.resolve()
}
