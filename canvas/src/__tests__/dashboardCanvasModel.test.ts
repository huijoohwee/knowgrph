import { buildDashboardCanvasModel } from '@/components/DashboardCanvas/dashboardModel'
import type { GraphData } from '@/lib/graph/types'
import { BLOCK_SCHEMA } from '@/__tests__/canvas3dMode.test'

export function testDashboardCanvasModelDerivesCardsWithoutFixtureBackfill() {
  const graph = {
    type: 'generic',
    metadata: {
      title: 'Neutral Pipeline',
      sourceKind: 'unit',
    },
    nodes: [
      {
        id: 'source',
        label: 'Source',
        type: 'Input',
        properties: {
          inputText: 'query',
          score: 2,
        },
      },
      {
        id: 'worker',
        label: 'Worker',
        type: 'Process',
        properties: {
          computeMethod: 'transform',
          score: 4,
        },
      },
      {
        id: 'artifact',
        label: 'Artifact',
        type: 'Output',
        properties: {
          output: 'summary',
          mediaUrl: 'https://example.test/artifact',
          score: 6,
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'source', target: 'worker', label: 'feeds', type: 'Flow', properties: { weight: 1 } },
      { id: 'e2', source: 'worker', target: 'artifact', label: 'emits', type: 'Flow', properties: { weight: 2 } },
    ],
  } as GraphData
  const model = buildDashboardCanvasModel(graph, {
    ...BLOCK_SCHEMA,
    behavior: {
      ...BLOCK_SCHEMA.behavior,
      canvasGrid: {
        enabled: true,
        variant: 'dots',
        majorEvery: 4,
      },
    },
  })

  if (model.title !== 'Neutral Pipeline') {
    throw new Error(`Expected metadata title to drive dashboard title, got ${model.title}`)
  }
  const nodeMetric = model.metrics.find(metric => metric.id === 'nodes')
  const edgeMetric = model.metrics.find(metric => metric.id === 'edges')
  const gridMetric = model.metrics.find(metric => metric.id === 'grid')
  if (nodeMetric?.value !== '3' || edgeMetric?.value !== '2') {
    throw new Error(`Expected graph-derived metric counts, got ${JSON.stringify({ nodeMetric, edgeMetric })}`)
  }
  if (model.grid.enabled !== true || model.grid.variant !== 'dots' || gridMetric?.value !== 'On') {
    throw new Error(`Expected dashboard model to reuse shared canvas grid config, got ${JSON.stringify(model.grid)}`)
  }
  const sections = model.sections.map(section => section.id).join('|')
  if (sections !== 'structure|signals') {
    throw new Error(`Expected stable generic dashboard sections, got ${sections}`)
  }
}

export function testDashboardCanvasModelReadsFrontmatterMetadata() {
  const graph = {
    type: 'Graph',
    metadata: {
      frontmatterMeta: {
        title: 'Published Frontmatter Demo',
        sourceKind: 'published-markdown-frontmatter',
      },
    },
    nodes: [
      {
        id: 'source',
        label: 'Source',
        type: 'DashboardInput',
        properties: {
          input_query: 'frontmatter metadata smoke',
          score: 5,
        },
      },
    ],
    edges: [],
  } as GraphData

  const model = buildDashboardCanvasModel(graph, BLOCK_SCHEMA)

  if (model.title !== 'Published Frontmatter Demo') {
    throw new Error(`Expected frontmatter title to drive dashboard title, got ${model.title}`)
  }
  if (model.subtitle !== 'Graph · published-markdown-frontmatter') {
    throw new Error(`Expected frontmatter sourceKind to drive dashboard subtitle, got ${model.subtitle}`)
  }
}

export function testDashboardCanvasModelKeepsScrollableDegreeRowsBounded() {
  const graph = {
    type: 'generic',
    metadata: {
      title: 'Scrollable Rows',
    },
    nodes: Array.from({ length: 30 }, (_, index) => ({
      id: `node-${index + 1}`,
      label: `Node ${index + 1}`,
      type: index % 2 === 0 ? 'Input' : 'Output',
      properties: {
        score: index + 1,
      },
    })),
    edges: Array.from({ length: 29 }, (_, index) => ({
      id: `edge-${index + 1}`,
      source: `node-${index + 1}`,
      target: `node-${index + 2}`,
      label: 'links',
      type: 'Flow',
      properties: {},
    })),
  } as GraphData

  const model = buildDashboardCanvasModel(graph, BLOCK_SCHEMA)
  const degreeCard = model.sections
    .flatMap(section => section.cards)
    .find(card => card.id === 'degree-leaders')

  if (!degreeCard) throw new Error('Expected degree-leaders dashboard card')
  if (degreeCard.rows.length !== 24) {
    throw new Error(`Expected bounded scrollable degree rows to keep 24 rows, got ${degreeCard.rows.length}`)
  }
}
