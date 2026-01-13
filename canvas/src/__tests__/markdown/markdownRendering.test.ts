import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { renderMarkdownPreview } from './markdownTestUtils'

export async function testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo() {
  const markdownLines = readFileSync(
    resolve(process.cwd(), 'src', '__tests__', 'demo', 'markdown-slide-demo.md'),
    'utf8',
  ).split('\n')

  const abbrLineIndex = markdownLines.findIndex(line => line.includes('<abbr'))
  if (abbrLineIndex === -1) {
    throw new Error('Could not find <abbr> line in markdown-slide-demo.md')
  }

  const snippet = markdownLines.slice(Math.max(0, abbrLineIndex - 5), abbrLineIndex + 15).join('\n')
  const html = renderMarkdownPreview(snippet, 'docs/markdown-slide-demo.md')

  if (!html.includes('Hover over this term:')) {
    throw new Error('expected abbr line to be present in rendered HTML')
  }
  if (!html.includes('Canvas Viewer')) {
    throw new Error('expected abbr inner text to be rendered')
  }
  if (html.includes('<abbr') || html.includes('</abbr>')) {
    throw new Error('expected abbr markup not to appear in rendered HTML')
  }

  if (!html.includes('Tailwind‑style span with custom color')) {
    throw new Error('expected span inner text to be rendered')
  }
  if (!html.includes('text-emerald-400') || !html.includes('font-semibold')) {
    throw new Error('expected span Tailwind classes to be applied')
  }
  if (html.includes('<span class="text-emerald-400 font-semibold">Tailwind‑style span with custom color</span>')) {
    throw new Error('expected raw span markup not to be echoed directly')
  }
}

export async function testMarkdownHeadMetaFrontmatterArrays() {
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
    'graphLayers:',
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
  const { headMeta } = splitSlides(markdown)

  if (!headMeta || typeof headMeta !== 'object' || Array.isArray(headMeta)) {
    throw new Error('headMeta is missing or not an object')
  }

  const meta = headMeta as Record<string, unknown>
  const ontologies = meta.ontologies as unknown
  const graphLayers = meta.graphLayers as unknown

  if (!Array.isArray(ontologies)) {
    throw new Error('headMeta.ontologies is not an array')
  }
  if (!Array.isArray(graphLayers)) {
    throw new Error('headMeta.graphLayers is not an array')
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
      `headMeta.ontologies length ${ontologies.length} != ${expectedOntologies.length}`,
    )
  }

  for (let i = 0; i < expectedOntologies.length; i += 1) {
    const actual = ontologies[i] as Record<string, unknown>
    const expected = expectedOntologies[i]
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`headMeta.ontologies[${i}] is not an object`)
    }
    const prefix = String(actual.prefix || '')
    const iri = String(actual.iri || '')
    if (prefix !== expected.prefix || iri !== expected.iri) {
      throw new Error(
        `headMeta.ontologies[${i}] mismatch: expected prefix=${expected.prefix} iri=${expected.iri}, got prefix=${prefix} iri=${iri}`,
      )
    }
  }

  const expectedGraphLayers = [
    'competencyHyperspace',
    'performanceSpace',
    'classDistributionSpace',
    'preprocessingCluster',
    'modelTypeClusters',
    'kpiViolationRegion',
    'candidateClusters',
    'assessmentRegion',
  ]

  const graphLayersStrings = graphLayers.map(v => String(v || ''))
  if (graphLayersStrings.length !== expectedGraphLayers.length) {
    throw new Error(
      `headMeta.graphLayers length ${graphLayersStrings.length} != ${expectedGraphLayers.length}`,
    )
  }

  for (let i = 0; i < expectedGraphLayers.length; i += 1) {
    if (graphLayersStrings[i] !== expectedGraphLayers[i]) {
      throw new Error(
        `headMeta.graphLayers[${i}] mismatch: expected ${expectedGraphLayers[i]}, got ${graphLayersStrings[i]}`,
      )
    }
  }

  await Promise.resolve()
}
