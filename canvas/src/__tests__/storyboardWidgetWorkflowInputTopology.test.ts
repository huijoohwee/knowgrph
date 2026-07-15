import { preserveStoryboardWidgetWorkflowInputTopology } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function testTextRunPersistenceRestoresMissingInputAndOutputEdge() {
  const anchorNode: GraphNode = {
    id: 'n1',
    type: 'TextGeneration',
    label: 'Widget Card',
    properties: { prompt: '/sme-care-agent @source.frontmatter #runtime-ready' },
  }
  const outputOnlyGraph: GraphData = {
    type: 'Graph',
    nodes: [{
      id: 'n2',
      type: 'RichMediaPanel',
      label: 'Rich Media Panel',
      properties: {
        output: '# SME Workspace Assessment',
        workflowOutputAnchorNodeId: 'n1',
        workflowOutputKey: 'output',
      },
    }],
    edges: [],
  }
  const repaired = preserveStoryboardWidgetWorkflowInputTopology({ graphData: outputOnlyGraph, anchorNode })
  const nodeIds = (repaired.nodes || []).map(node => String(node.id || ''))
  if (!nodeIds.includes('n1') || !nodeIds.includes('n2')) {
    throw new Error(`expected text Run persistence to retain input and output nodes, got ${JSON.stringify(nodeIds)}`)
  }
  const outputEdge = (repaired.edges || []).find(edge => edge.source === 'n1' && edge.target === 'n2')
  if (!outputEdge || outputEdge.label !== 'output') {
    throw new Error(`expected text Run persistence to restore the n1 -> n2 output edge, got ${JSON.stringify(repaired.edges)}`)
  }
  const stable = preserveStoryboardWidgetWorkflowInputTopology({ graphData: repaired, anchorNode })
  if (stable !== repaired || stable.edges.length !== 1) {
    throw new Error('expected topology preservation to be idempotent after the input node and output edge exist')
  }
}
