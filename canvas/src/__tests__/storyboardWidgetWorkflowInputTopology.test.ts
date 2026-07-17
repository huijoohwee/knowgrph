import {
  preserveStoryboardWidgetWorkflowInputTopology,
  WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
  WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function testTextRunPersistenceKeepsManualOutputStandalone() {
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
        [WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY]: WORKFLOW_OUTPUT_EDGE_MODE_MANUAL,
      },
    }],
    edges: [],
  }
  const repaired = preserveStoryboardWidgetWorkflowInputTopology({ graphData: outputOnlyGraph, anchorNode })
  const nodeIds = (repaired.nodes || []).map(node => String(node.id || ''))
  if (!nodeIds.includes('n1') || !nodeIds.includes('n2')) {
    throw new Error(`expected text Run persistence to retain input and output nodes, got ${JSON.stringify(nodeIds)}`)
  }
  if (repaired.edges.length !== 0) {
    throw new Error(`expected manual text output to remain standalone until an authored edge exists, got ${JSON.stringify(repaired.edges)}`)
  }
  const stable = preserveStoryboardWidgetWorkflowInputTopology({ graphData: repaired, anchorNode })
  if (stable !== repaired || stable.edges.length !== 0) {
    throw new Error('expected manual output topology preservation to be idempotent without synthesizing an edge')
  }
}
