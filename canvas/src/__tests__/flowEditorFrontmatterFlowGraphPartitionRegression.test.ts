import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildFlowCanvasGraphDataOverride,
  type FrontmatterOverlayVisualIsolation,
} from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceVisibility'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'
import { KG_SUBGRAPHS_KEY, readSubgraphs } from '@/lib/graph/subgraphs'
import type { GraphData } from '@/lib/graph/types'

export function testFlowEditorFrontmatterFlowGraphPartitionExcludesAllRenderNodes() {
  const metadataSubgraphs = [
    {
      id: 'canvas_cluster',
      label: 'Canvas Cluster',
      memberNodeIds: ['widget_input', 'rich_media_panel', 'section_display'],
      kind: 'cluster',
    },
  ]
  const graphData: GraphData = {
    type: 'Graph',
    metadata: {
      kind: 'frontmatter-flow',
      [KG_SUBGRAPHS_KEY]: metadataSubgraphs,
    },
    nodes: [
      { id: 'widget_input', type: 'FlowWidget', label: 'Widget input', properties: { 'flow:widgetFormId': 'test_widget' } },
      { id: 'rich_media_panel', type: 'FlowRichMediaPanel', label: 'Rich media panel', properties: {} },
      { id: 'section_display', type: 'Section', label: 'Display section', properties: {} },
      { id: 'canvas_display_proxy', type: 'Panel', label: 'Display proxy', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'widget_input', target: 'rich_media_panel', label: 'Widget to panel', type: 'default', properties: {} },
      { id: 'e2', source: 'section_display', target: 'canvas_display_proxy', label: 'Section to proxy', type: 'default', properties: {} },
    ],
  }
  const frontmatterOverlayVisualIsolation: FrontmatterOverlayVisualIsolation = {
    kind: 'frontmatter-flow',
    visibleNodeIds: ['widget_input'],
    hasFullOverlayCoverageForVisibleNodes: true,
  }
  const partitioned = buildFlowCanvasGraphDataOverride({
    renderGraphDataOverride: graphData,
    frontmatterOverlayVisualIsolation,
    overlayEditorNodeIdsSnapshot: ['widget_input'],
    overlayOnlyActive: true,
  })
  const nodeIds = Array.isArray(partitioned?.nodes) ? partitioned.nodes.map(node => String(node?.id || '').trim()).filter(Boolean) : []
  const edgeIds = Array.isArray(partitioned?.edges) ? partitioned.edges.map(edge => String(edge?.id || '').trim()).filter(Boolean) : []
  const subgraphIds = readSubgraphs(partitioned).map(subgraph => subgraph.id)
  if (nodeIds.length !== 0) throw new Error(`expected FlowCanvas frontmatter-flow graph partition to exclude every Flow Editor render node, got ${nodeIds.join(',')}`)
  if (edgeIds.length !== 0) throw new Error(`expected FlowCanvas frontmatter-flow graph partition to exclude edges attached to Flow Editor render nodes, got ${edgeIds.join(',')}`)
  if (subgraphIds.length !== 0) throw new Error(`expected FlowCanvas frontmatter-flow graph partition to exclude metadata groups attached to Flow Editor render nodes, got ${subgraphIds.join(',')}`)

  const composedGraphData: GraphData = {
    ...graphData,
    context: 'kgc-semantic-markdown',
    metadata: {
      kind: 'kgc-semantic',
      graphKind: 'kgc-semantic',
      baseGraphKind: 'frontmatter-flow',
      [KG_SUBGRAPHS_KEY]: metadataSubgraphs,
    },
  }
  const composedIsolation: FrontmatterOverlayVisualIsolation = {
    ...frontmatterOverlayVisualIsolation,
    kind: 'frontmatter-flow',
  }
  const composedPartitioned = buildFlowCanvasGraphDataOverride({
    renderGraphDataOverride: composedGraphData,
    frontmatterOverlayVisualIsolation: composedIsolation,
    overlayEditorNodeIdsSnapshot: ['widget_input'],
    overlayOnlyActive: true,
  })
  const composedNodeIds = Array.isArray(composedPartitioned?.nodes) ? composedPartitioned.nodes.map(node => String(node?.id || '').trim()).filter(Boolean) : []
  const composedEdgeIds = Array.isArray(composedPartitioned?.edges) ? composedPartitioned.edges.map(edge => String(edge?.id || '').trim()).filter(Boolean) : []
  const composedSubgraphIds = readSubgraphs(composedPartitioned).map(subgraph => subgraph.id)
  if (composedNodeIds.length !== 0) throw new Error(`expected FlowCanvas composed frontmatter-flow graph partition to exclude every Flow Editor render node, got ${composedNodeIds.join(',')}`)
  if (composedEdgeIds.length !== 0) throw new Error(`expected FlowCanvas composed frontmatter-flow graph partition to exclude edges attached to Flow Editor render nodes, got ${composedEdgeIds.join(',')}`)
  if (composedSubgraphIds.length !== 0) throw new Error(`expected FlowCanvas composed frontmatter-flow graph partition to exclude metadata groups attached to Flow Editor render nodes, got ${composedSubgraphIds.join(',')}`)

  const widgetEligible = filterGraphToFlowWidgetEligible(graphData)
  const eligibleSubgraphs = readSubgraphs(widgetEligible)
  if (eligibleSubgraphs.length !== 1 || eligibleSubgraphs[0]?.memberNodeIds.join('|') !== 'widget_input') {
    throw new Error(`expected shared Flow widget eligibility filter to prune metadata group members outside retained widget nodes, got ${JSON.stringify(eligibleSubgraphs)}`)
  }

  const runtimeSource = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/useFlowCanvasRuntime.ts'), 'utf8')
  if (!runtimeSource.includes('inputHasNativeSceneContent') || !runtimeSource.includes('runtimeHasNativeSceneContent')) {
    throw new Error('expected FlowCanvas native scene rebuild guard to compare desired input content with retained runtime content')
  }
  if (runtimeSource.includes('graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0')) {
    throw new Error('FlowCanvas native scene rebuild guard must not keep stale runtime nodes when Flow Editor partition input is empty')
  }
  if (!runtimeSource.includes('const nativeSceneContentRemoved = !inputHasNativeSceneContent && runtimeHasNativeSceneContent')) {
    throw new Error('expected FlowCanvas native scene rebuild to detect when Flow Editor partition removes previously rendered native nodes/groups/edges')
  }
  if (!runtimeSource.includes('if (nativeSceneContentRemoved) {\n      requestFlowNativeDraw(runtime, buildDrawArgs())\n      return\n    }')) {
    throw new Error('expected FlowCanvas native scene rebuild to force a clearing draw when frontmatter-flow partition removes native scene content')
  }
  const clearDrawIndex = runtimeSource.indexOf('if (nativeSceneContentRemoved) {')
  const suppressIndex = runtimeSource.indexOf('if (shouldSuppressWorkspacePreInitDraw()) return', clearDrawIndex)
  const deferIndex = runtimeSource.indexOf('if (shouldDeferWorkspaceOpenDraw()) return', clearDrawIndex)
  if (clearDrawIndex < 0 || suppressIndex < 0 || deferIndex < 0 || clearDrawIndex > suppressIndex || clearDrawIndex > deferIndex) {
    throw new Error('expected native scene clear draw to happen before Flow Editor workspace pre-init/deferred draw gates')
  }
}

export function testFlowEditorForeignRendererGraphPartitionExcludesNativeFlowCanvasNodes() {
  const graphData: GraphData = {
    type: 'Graph',
    metadata: {
      kind: 'strybldr-storyboard',
      kgCanvas2dRenderer: 'strybldr',
      frontmatterMeta: {
        kgCanvas2dRenderer: 'strybldr',
        kgRendererCompatibility: [
          '2D Renderer: Strybldr',
          '2D Renderer: Storyboard',
          '2D Renderer: Flow Editor',
        ],
      },
      [KG_SUBGRAPHS_KEY]: [
        {
          id: 'storytree',
          label: 'Storytree',
          memberNodeIds: ['source', 'fork'],
          kind: 'cluster',
        },
      ],
    },
    nodes: [
      { id: 'source', type: 'StrybldrImageSource', label: 'Source', properties: {} },
      { id: 'fork', type: 'StorytreeNode', label: 'Fork', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'source', target: 'fork', label: 'forks', type: 'containsElement', properties: {} },
    ],
  }
  const partitioned = buildFlowCanvasGraphDataOverride({
    renderGraphDataOverride: graphData,
    frontmatterOverlayVisualIsolation: {
      kind: 'strybldr-storyboard',
      visibleNodeIds: [],
      hasFullOverlayCoverageForVisibleNodes: true,
    },
    overlayEditorNodeIdsSnapshot: [],
    overlayOnlyActive: false,
  })
  const nodeIds = Array.isArray(partitioned?.nodes) ? partitioned.nodes.map(node => String(node?.id || '').trim()).filter(Boolean) : []
  const edgeIds = Array.isArray(partitioned?.edges) ? partitioned.edges.map(edge => String(edge?.id || '').trim()).filter(Boolean) : []
  const subgraphIds = readSubgraphs(partitioned).map(subgraph => subgraph.id)
  if (nodeIds.length !== 0) throw new Error(`expected Flow Editor to keep Strybldr-owned graph nodes out of FlowCanvas, got ${nodeIds.join(',')}`)
  if (edgeIds.length !== 0) throw new Error(`expected Flow Editor to keep Strybldr-owned graph edges out of FlowCanvas, got ${edgeIds.join(',')}`)
  if (subgraphIds.length !== 0) throw new Error(`expected Flow Editor to prune Strybldr-owned graph groups from FlowCanvas, got ${subgraphIds.join(',')}`)

  const flowEditorGraph: GraphData = {
    ...graphData,
    metadata: {
      ...graphData.metadata,
      kind: 'flow-editor',
      kgCanvas2dRenderer: 'flowEditor',
      frontmatterMeta: { kgCanvas2dRenderer: 'flowEditor' },
    },
  }
  const retained = buildFlowCanvasGraphDataOverride({
    renderGraphDataOverride: flowEditorGraph,
    frontmatterOverlayVisualIsolation: {
      kind: 'flow-editor',
      visibleNodeIds: [],
      hasFullOverlayCoverageForVisibleNodes: true,
    },
    overlayEditorNodeIdsSnapshot: [],
    overlayOnlyActive: false,
  })
  const retainedNodeIds = Array.isArray(retained?.nodes) ? retained.nodes.map(node => String(node?.id || '').trim()).filter(Boolean) : []
  if (retainedNodeIds.join('|') !== 'source|fork') {
    throw new Error(`expected Flow Editor-owned graphs to retain native FlowCanvas backing nodes, got ${retainedNodeIds.join(',')}`)
  }
}
