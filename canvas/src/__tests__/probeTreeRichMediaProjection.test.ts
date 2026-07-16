import { applyConnectedValuesToNodeForRender } from '@/lib/render/effectiveMediaNode'
import { buildRichMediaPanelOverlayState, listDisplayRichMediaOverlayNodes } from '@/lib/render/richMediaSsot'
import type { GraphNode } from '@/lib/graph/types'

const cell = (key: string, value: unknown) => ({ key, type: typeof value, value })

export function testProbeTreeWorkflowPanelPreservesPublishedTextAcrossEmptyLineageValue() {
  const panel = {
    id: 'n2',
    type: 'RichMediaPanel',
    label: cell('label', 'Probe-Tree Branches'),
    properties: {
      output: cell('output', '# Probe-Tree Branches\n\n1. Evidence scope'),
      richMediaActiveTab: cell('richMediaActiveTab', 'text'),
      workflowOutputAnchorNodeId: cell('workflowOutputAnchorNodeId', 'n1'),
      workflowOutputKey: cell('workflowOutputKey', 'probe-tree-branches'),
    },
  } as unknown as GraphNode
  const connectedValuesBySchemaPath = {
    'properties.output': {
      value: '',
      sources: [{ edgeId: 'workflow-output-n1-probe-tree-branches-n2', nodeId: 'n1', portKey: 'output' }],
    },
  }
  const renderNode = applyConnectedValuesToNodeForRender({ node: panel, connectedValuesBySchemaPath })
  const state = buildRichMediaPanelOverlayState({ node: panel, renderNode, connectedValuesBySchemaPath })
  if (!state?.hasText || !state.text.includes('# Probe-Tree Branches')) {
    throw new Error(`expected the named workflow publication to survive an empty lineage value, got ${JSON.stringify(state)}`)
  }
  const overlays = listDisplayRichMediaOverlayNodes({
    renderMediaAsNodes: false,
    canvasRenderMode: '2d',
    canvas2dRenderer: 'storyboard',
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    nodes: [panel],
    poolMax: 24,
    connectedValuesByNodeId: new Map([['n2', connectedValuesBySchemaPath]]),
  })
  if (overlays[0]?.title !== 'Probe-Tree Branches' || !overlays[0]?.panel?.hasText) {
    throw new Error(`expected the visible Rich Media overlay to retain its Probe-Tree title and text, got ${JSON.stringify(overlays)}`)
  }
}
