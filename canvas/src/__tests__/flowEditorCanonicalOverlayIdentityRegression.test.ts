import { buildFrontmatterOverlayVisualIsolation } from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceVisibility'
import { getCachedFlowEditorWidgetPlacementContext } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import { resolveFlowEditorOverlayElementIdentity } from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceElements'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { GraphData } from '@/lib/graph/types'

export function testFlowEditorFrontmatterOverlayIdentityCanonicalizesComposedWidgetIds() {
  const graph: GraphData = {
    type: 'Graph',
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterMeta: {
        widget_bundle: {
          graph: {
            nodes_ref: ['ws:source::target-node'],
          },
        },
      },
    },
    nodes: [
      {
        id: 'ws:source::target-node',
        type: 'TextGeneration',
        label: 'Target node',
        properties: {},
      },
    ],
    edges: [],
  }

  const placement = getCachedFlowEditorWidgetPlacementContext({
    graphData: graph,
    graphRevision: 90101,
    openWidgetNodeIds: [],
  })
  if (!placement) throw new Error('expected placement context')
  if (placement.frontmatterOverlayNodeIds.length !== 1 || placement.frontmatterOverlayNodeIds[0] !== 'target-node') {
    throw new Error('expected frontmatter overlay ids to be canonicalized before overlay rendering')
  }

  const identity = resolveFlowEditorOverlayElementIdentity({
    graphMetaKind: 'frontmatter-flow',
    overlayNodeId: placement.frontmatterOverlayNodeIds[0],
    node: graph.nodes[0],
  })
  if (identity.overlayIdentityId !== 'target-node' || identity.renderNodeId !== 'target-node') {
    throw new Error('expected frontmatter overlay render identity to stay canonical across composed handoff')
  }
  if (identity.actionNodeId !== 'ws:source::target-node') {
    throw new Error('expected frontmatter overlay mutations to keep targeting the concrete graph node')
  }

  const coverage = buildFrontmatterOverlayVisualIsolation({
    renderGraphDataOverride: graph,
    frontmatterVisibleSceneDisplay: {
      displayNodes: [{ id: 'ws:source::target-node' }],
    },
    frontmatterRichMediaOverlayNodeIdsSnapshot: [],
    overlayEditorNodeIdsSnapshot: placement.frontmatterOverlayNodeIds,
    renderGraphEligibleNodeIds: new Set(['ws:source::target-node']),
  })
  if (!coverage.hasFullOverlayCoverageForVisibleNodes) {
    throw new Error('expected frontmatter overlay coverage to compare canonical and composed node ids')
  }

  const collectiveGraph: GraphData = {
    type: 'Graph',
    metadata: {
      kind: 'kgc-semantic',
      graphKind: 'kgc-semantic',
      baseGraphKind: 'frontmatter-flow',
      frontmatterMeta: {
        director_brief: { shots: [{ id: 'shot-1' }] },
        widget_bundle: {
          graph: {
            nodes_ref: ['rich-panel'],
          },
        },
      },
    },
    nodes: [
      {
        id: 'driver-widget',
        type: 'default',
        label: 'Driver Widget',
        properties: { 'flow:widgetFormId': 'fm:driver-widget' },
      },
      {
        id: 'rich-panel',
        type: 'FlowRichMediaPanel',
        label: 'Rich Panel',
        properties: {},
      },
      {
        id: 'display-section',
        type: 'Section',
        label: 'Display Section',
        properties: {},
      },
    ],
    edges: [],
  }
  const collectivePlacement = getCachedFlowEditorWidgetPlacementContext({
    graphData: collectiveGraph,
    graphRevision: 90103,
    openWidgetNodeIds: [],
  })
  const collectiveIds = new Set(collectivePlacement?.frontmatterOverlayNodeIds || [])
  if (!collectiveIds.has('driver-widget') || !collectiveIds.has('rich-panel')) {
    throw new Error(`expected composed frontmatter overlay ids to include eligible widgets and rich panels, got ${Array.from(collectiveIds).join(',')}`)
  }
  if (collectiveIds.has('display-section')) {
    throw new Error('expected composed frontmatter overlay ids to exclude non-widget section nodes')
  }
}

export function testFlowEditorConnectedValuesResolveCanonicalTargetNodeIds() {
  const graph: GraphData = {
    type: 'Graph',
    metadata: {
      kind: 'frontmatter-flow',
    },
    nodes: [
      {
        id: 'ws:source::producer-node',
        type: 'ProducerWidget',
        label: 'Producer',
        properties: { output: 'ready' },
      },
      {
        id: 'ws:source::target-node',
        type: 'TargetWidget',
        label: 'Target',
        properties: {},
      },
    ],
    edges: [
      {
        id: 'edge-1',
        label: 'producer to target',
        source: 'ws:source::producer-node',
        target: 'ws:source::target-node',
        properties: {
          'flow:sourcePortKey': 'out',
          'flow:targetPortKey': 'in',
        },
      },
    ],
  }
  const registry: WidgetRegistryEntry[] = [
    {
      id: 'producer',
      isEnabled: true,
      nodeTypeId: 'ProducerWidget',
      widgetTypeId: 'producer',
      formId: 'producer',
      fields: [],
      ports: [{ portKey: 'out', direction: 'output', schemaPath: 'properties.output' }],
      updatedAt: '',
    },
    {
      id: 'target',
      isEnabled: true,
      nodeTypeId: 'TargetWidget',
      widgetTypeId: 'target',
      formId: 'target',
      fields: [],
      ports: [{ portKey: 'in', direction: 'input', schemaPath: 'properties.input' }],
      updatedAt: '',
    },
  ]

  const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData: graph,
    registry,
    targetNodeIds: new Set(['target-node']),
    graphRevision: 90102,
  })
  const connected = connectedValuesByNodeId.get('ws:source::target-node')
  if (!connected) {
    throw new Error('expected canonical connected-value target to resolve to the concrete composed graph node')
  }
  const value = connected['properties.input']?.value
  if (value !== 'ready') {
    throw new Error(`expected connected value to resolve through composed graph target, received ${String(value)}`)
  }
}
