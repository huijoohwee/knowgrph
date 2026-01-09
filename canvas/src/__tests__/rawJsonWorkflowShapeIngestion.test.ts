import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export function testRawJsonWorkflowShapeIngestion() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const raw = {
    meta: { title: 'Workflow Shape Graph', version: '1.0' },
    workflow_nodes: [
      {
        id: 'step-problem',
        type: 'milestone',
        label: 'Problem Framing',
        phase: 'problem',
        layer: 0,
      },
      {
        id: 'step-data',
        type: 'milestone',
        label: 'Data Preparation',
        phase: 'data',
        layer: 1,
      },
      {
        id: 'step-model',
        type: 'milestone',
        label: 'Modeling',
        phase: 'modeling',
        layer: 2,
      },
    ],
    workflow_edges: [
      {
        id: 'e-problem-data',
        source: 'step-problem',
        target: 'step-data',
        label: 'precedes',
        kind: 'sequence',
      },
      {
        id: 'e-data-model',
        source: 'step-data',
        target: 'step-model',
        label: 'precedes',
        kind: 'sequence',
      },
    ],
  }

  const text = JSON.stringify(raw)

  const res = applyParser(toParserId('json'), {
    name: 'workflow-shape.json',
    text,
  })

  if (!res) throw new Error('raw workflow json parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`raw workflow json parse warnings: ${res.warnings.join('; ')}`)
  }

  const graph = res.graphData
  const nodes = graph.nodes || []
  const edges = graph.edges || []

  if (nodes.length !== 3) {
    throw new Error(`expected 3 workflow nodes, got ${nodes.length}`)
  }
  if (edges.length !== 2) {
    throw new Error(`expected 2 workflow edges, got ${edges.length}`)
  }

  const problem = nodes.find(n => n.id === 'step-problem')
  const data = nodes.find(n => n.id === 'step-data')
  const model = nodes.find(n => n.id === 'step-model')

  if (!problem || !data || !model) {
    throw new Error('missing expected workflow nodes')
  }

  const problemProps = (problem.properties || {}) as Record<string, unknown>
  const dataProps = (data.properties || {}) as Record<string, unknown>
  const modelProps = (model.properties || {}) as Record<string, unknown>

  if (problemProps.phase !== 'problem') {
    throw new Error('expected phase property on problem node to be preserved')
  }
  if (dataProps.phase !== 'data') {
    throw new Error('expected phase property on data node to be preserved')
  }
  if (modelProps.phase !== 'modeling') {
    throw new Error('expected phase property on model node to be preserved')
  }

  const seqEdges = edges.filter(e => e.label === 'precedes')
  if (seqEdges.length !== 2) {
    throw new Error(`expected 2 precedes edges, got ${seqEdges.length}`)
  }
}
