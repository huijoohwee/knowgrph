import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'

type NodeWithOptionalProps = { properties?: unknown }

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

function assertMermaidSubgraphMembership(nodes: NodeWithOptionalProps[], expectedLayerMembers: Record<string, string[]>): void {
  const membershipByLayer = new Map<string, Set<string>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as { properties?: unknown }
    const props = (n.properties || {}) as Record<string, unknown>
    const subgraphName = String(props.mermaidSubgraphName || '').trim()
    if (!subgraphName) continue
    const nodeName = String(props.nodeName || '').trim()
    if (!nodeName) continue
    if (!membershipByLayer.has(subgraphName)) {
      membershipByLayer.set(subgraphName, new Set())
    }
    membershipByLayer.get(subgraphName)!.add(nodeName)
  }

  const expectedLayerNames = Object.keys(expectedLayerMembers)
  for (let i = 0; i < expectedLayerNames.length; i += 1) {
    const layerName = expectedLayerNames[i]!
    const members = membershipByLayer.get(layerName)
    if (!members) {
      throw new Error(`expected MermaidSubgraph membership for layer ${layerName}`)
    }
    const expectedMembers = expectedLayerMembers[layerName]!
    for (let j = 0; j < expectedMembers.length; j += 1) {
      const member = expectedMembers[j]!
      if (!members.has(member)) {
        throw new Error(`expected ${layerName} MermaidSubgraph to contain node ${member}`)
      }
    }
  }
}

async function runEdaMlpInterviewSessionMarkdownTest(
  markdown: string,
  strictL0Subgraph: boolean,
) {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const text = String(markdown ?? '')
  if (!text.trim()) {
    throw new Error('eda-mlp-interview-session markdown text is empty')
  }

  const jsonld = buildMarkdownJsonLd(
    'file://eda-mlp-interview-session.md',
    text,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'eda-mlp-interview-session.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []

  if (nodes.length === 0) {
    throw new Error('eda-mlp-interview-session produced no nodes')
  }
  if (edges.length === 0) {
    throw new Error('eda-mlp-interview-session produced no edges')
  }

  const mermaidNodes = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'MermaidNode')
  if (mermaidNodes.length === 0) {
    throw new Error('expected at least one MermaidNode from eda-mlp-interview-session')
  }

  const mermaidDiagrams = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'MermaidDiagram')
  if (mermaidDiagrams.length === 0) {
    throw new Error('expected at least one MermaidDiagram from eda-mlp-interview-session')
  }

  const anchorNodes = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'Anchor')
  if (anchorNodes.length === 0) {
    throw new Error('expected at least one Anchor node from eda-mlp-interview-session')
  }

  const internalLinks = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'InternalLink')
  if (internalLinks.length === 0) {
    throw new Error('expected at least one InternalLink node from eda-mlp-interview-session')
  }

  const pointsToEdges = edges.filter(e => String((e as { label?: unknown }).label || '') === 'pointsTo')
  if (pointsToEdges.length === 0) {
    throw new Error('expected at least one pointsTo edge from Mermaid frontmatter or internal links')
  }

  const nodeById = new Map<string, { type?: unknown }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as { id?: unknown; type?: unknown }
    const id = String(n.id || '')
    if (!id) continue
    nodeById.set(id, n)
  }

  const mermaidIds = new Set(mermaidNodes.map(n => String((n as { id?: unknown }).id || '')))
  const anchorIds = new Set(anchorNodes.map(n => String((n as { id?: unknown }).id || '')))

  const mermaidToAnchor = pointsToEdges.filter(e => {
    const src = String((e as { source?: unknown }).source || '')
    const tgt = String((e as { target?: unknown }).target || '')
    return mermaidIds.has(src) && anchorIds.has(tgt)
  })
  if (mermaidToAnchor.length === 0) {
    throw new Error('expected at least one pointsTo edge from MermaidNode to Anchor')
  }

  const internalLinkToAnchor = pointsToEdges.filter(e => {
    const src = String((e as { source?: unknown }).source || '')
    const tgt = String((e as { target?: unknown }).target || '')
    const srcNode = nodeById.get(src) as { type?: unknown } | undefined
    const tgtNode = nodeById.get(tgt) as { type?: unknown } | undefined
    return srcNode && tgtNode && String(srcNode.type || '') === 'InternalLink' && String(tgtNode.type || '') === 'Anchor'
  })
  if (internalLinkToAnchor.length === 0) {
    throw new Error('expected at least one pointsTo edge from InternalLink to Anchor')
  }

  const documentNodes = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'Document')
  if (documentNodes.length === 0) {
    throw new Error('expected at least one Document node from eda-mlp-interview-session')
  }

  const sectionNodes = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'Section')
  if (sectionNodes.length === 0) {
    throw new Error('expected at least one Section node from eda-mlp-interview-session')
  }

  const mermaidSubgraphs = nodes.filter(n => String((n as { type?: unknown }).type || '') === 'MermaidSubgraph')
  if (strictL0Subgraph) {
    if (mermaidSubgraphs.length === 0) {
      throw new Error('expected at least one MermaidSubgraph node from eda-mlp-interview-session')
    }

    const subgraphByName = new Map<string, { id?: unknown }>()
    for (let i = 0; i < mermaidSubgraphs.length; i += 1) {
      const n = mermaidSubgraphs[i] as { id?: unknown; properties?: unknown }
      const props = (n.properties || {}) as Record<string, unknown>
      const name = String(props.subgraphName || '').trim()
      if (!name) continue
      subgraphByName.set(name, n)
    }

    const l0Subgraph = subgraphByName.get('L0')
    if (!l0Subgraph) {
      throw new Error('expected a MermaidSubgraph with subgraphName "L0"')
    }

    const l0Id = String((l0Subgraph as { id?: unknown }).id || '')
    if (!l0Id) {
      throw new Error('L0 MermaidSubgraph is missing an id')
    }

    const l0Members = nodes.filter(n => {
      const props = (n as { properties?: unknown }).properties as Record<string, unknown> | undefined
      if (!props) return false
      const subgraphName = String(props.mermaidSubgraphName || '').trim()
      return subgraphName === 'L0'
    })

    const l0NodeNames = new Set(
      l0Members.map(n => String(((n as { properties?: unknown }).properties as Record<string, unknown> | undefined)?.nodeName || '')),
    )

    const expectedL0Members = ['B_FE', 'B_CT', 'B_RC', 'B_OC']
    for (let i = 0; i < expectedL0Members.length; i += 1) {
      if (!l0NodeNames.has(expectedL0Members[i]!)) {
        throw new Error(`expected L0 MermaidSubgraph to contain node ${expectedL0Members[i]}`)
      }
    }

    const expectedLayerMembers: Record<string, string[]> = {
      L1: ['S_PM', 'S_LC', 'S_EM'],
      L2: ['K_REC', 'K_FPR', 'K_PRE', 'K_AUC', 'K_F1'],
      L3: ['ST_MNAR', 'ST_CHI', 'ST_VIF', 'ST_SKEW', 'ST_QQ', 'ST_STRAT'],
      L4: ['M_LOG', 'M_KNN', 'M_XGB', 'M_THRE'],
      L5: ['I_PIPE', 'I_ERR', 'I_MON', 'I_DEP'],
      L6: ['MA_LOSS', 'MA_GRAD', 'MA_SIG', 'MA_AUC'],
    }
    assertMermaidSubgraphMembership(nodes as NodeWithOptionalProps[], expectedLayerMembers)
  }

  await Promise.resolve()
}

export async function testEdaMlpInterviewSessionMarkdownProducesMermaidAnchorsAndInternalLinks(markdown: string) {
  await runEdaMlpInterviewSessionMarkdownTest(markdown, true)
}

export async function testEdaMlpInterviewSessionMarkdownFixtureFromDisk() {
  const envValue = String(process.env.KNOWGRPH_EDA_MLP_INTERVIEW_MD_PATH || '').trim()
  if (!envValue) {
    await Promise.resolve()
    return
  }
  const pathMod = await import('node:path')
  const fsMod = await import('node:fs')
  const mdPath = pathMod.resolve(process.cwd(), envValue)
  const mdText = fsMod.readFileSync(mdPath, 'utf8')
  await runEdaMlpInterviewSessionMarkdownTest(mdText, false)
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

export async function testMarkdownFrontmatterOntologiesAndGraphLayersRoundTrip() {
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
  const { meta } = lexMarkdown(markdown)
  const ontologies = (meta as Record<string, unknown>).ontologies
  const graphLayers = (meta as Record<string, unknown>).graphLayers
  if (!Array.isArray(ontologies)) {
    throw new Error('frontmatter ontologies is not an array')
  }
  if (!Array.isArray(graphLayers)) {
    throw new Error('frontmatter graphLayers is not an array')
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
      `frontmatter graphLayers length ${graphLayersStrings.length} != ${expectedGraphLayers.length}`,
    )
  }
  for (let i = 0; i < expectedGraphLayers.length; i += 1) {
    if (graphLayersStrings[i] !== expectedGraphLayers[i]) {
      throw new Error(
        `frontmatter graphLayers[${i}] mismatch: expected ${expectedGraphLayers[i]}, got ${graphLayersStrings[i]}`,
      )
    }
  }
  await Promise.resolve()
}

export async function testMarkdownFrontmatterPolygonLayersAliasWarning() {
  const frontmatterLines = [
    '---',
    'polygonLayers:',
    '  - layerOne',
    '  - layerTwo',
    '---',
    '',
    '# Title',
  ]
  const markdown = frontmatterLines.join('\n')
  const { meta } = lexMarkdown(markdown)
  const graphLayers = (meta as Record<string, unknown>).graphLayers as unknown
  if (!Array.isArray(graphLayers)) {
    throw new Error('frontmatter graphLayers is not an array when using polygonLayers alias')
  }
  const names = graphLayers.map(v => String(v || ''))
  if (names.length !== 2 || names[0] !== 'layerOne' || names[1] !== 'layerTwo') {
    throw new Error(
      `frontmatter polygonLayers alias did not normalize correctly; got [${names.join(', ')}]`,
    )
  }
  const rawWarnings = (meta as Record<string, unknown>).__schemaLintWarnings as unknown
  if (!Array.isArray(rawWarnings) || rawWarnings.length === 0) {
    throw new Error('expected __schemaLintWarnings when polygonLayers alias is used in frontmatter')
  }
  const warnings = rawWarnings.map(v => String(v || '')).join(' ')
  if (!warnings.includes('polygonLayers') || !warnings.includes('graphLayers')) {
    throw new Error(
      `__schemaLintWarnings does not mention polygonLayers and graphLayers; got: ${warnings}`,
    )
  }
  await Promise.resolve()
}
