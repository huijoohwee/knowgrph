import type { GraphData } from '@/lib/graph/types'
import { findTraversalEdgeIds } from '@/lib/graph/graphragTraversal'
import {
  TRAVERSAL_MAX_DEPTH_MIN,
  TRAVERSAL_MAX_DEPTH_MAX,
  clampTraversalMaxDepth,
} from '@/features/panels/utils/orchestratorTraversal'
import {
  buildDefaultFloatingPanelTraversalConfig,
  initGraphTraversalFloatingPanelHarness,
} from '@/tests/lib/graphTraversalFloatingPanel'

export function testGraphTraversalFloatingPanelGenericDepthClamp() {
  const nodeCount = TRAVERSAL_MAX_DEPTH_MAX + 3
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    label: `n${index}`,
    type: 'test',
    properties: {},
  }))
  const edges = Array.from({ length: nodeCount - 1 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index}`,
    target: `n${index + 1}`,
    label: 'linked',
    properties: {},
  }))
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes,
    edges,
  }

  const baseConfig = buildDefaultFloatingPanelTraversalConfig()
  const scriptedConfigMax = {
    ...baseConfig,
    floatingPanelTraversal: {
      ...baseConfig.floatingPanelTraversal,
      traversalQuery: {
        traversalStartNodeId: 'n0',
        traversalMaxDepth: 99,
        traversalLabelFilter: '',
      },
      collapse: baseConfig.floatingPanelTraversal.collapse,
    },
  }

  const { restore } = initGraphTraversalFloatingPanelHarness(scriptedConfigMax)
  try {
    const traversalQueryMax = scriptedConfigMax.floatingPanelTraversal.traversalQuery
    const clampedDepthMax = clampTraversalMaxDepth(traversalQueryMax.traversalMaxDepth)
    if (clampedDepthMax !== TRAVERSAL_MAX_DEPTH_MAX) {
      throw new Error(
        `Floating panel traversalMaxDepth should clamp to TRAVERSAL_MAX_DEPTH_MAX; expected ${TRAVERSAL_MAX_DEPTH_MAX}, got ${clampedDepthMax}`,
      )
    }
    const edgeIdsMax = findTraversalEdgeIds(graph, {
      startNodeId: traversalQueryMax.traversalStartNodeId,
      maxDepth: clampedDepthMax,
      allowedEdgeLabels: undefined,
    })
    if (edgeIdsMax.length !== TRAVERSAL_MAX_DEPTH_MAX) {
      throw new Error(
        `Generic traversal from floating panel should respect clamped depth; expected ${TRAVERSAL_MAX_DEPTH_MAX} edges, got ${edgeIdsMax.length}`,
      )
    }

    const scriptedConfigMin = {
      ...baseConfig,
      floatingPanelTraversal: {
        ...baseConfig.floatingPanelTraversal,
        traversalQuery: {
          traversalStartNodeId: 'n0',
          traversalMaxDepth: 0,
          traversalLabelFilter: '',
        },
        collapse: baseConfig.floatingPanelTraversal.collapse,
      },
    }
    const traversalQueryMin = scriptedConfigMin.floatingPanelTraversal.traversalQuery
    const clampedDepthMin = clampTraversalMaxDepth(traversalQueryMin.traversalMaxDepth)
    if (clampedDepthMin !== TRAVERSAL_MAX_DEPTH_MIN) {
      throw new Error(
        `Floating panel traversalMaxDepth should clamp to TRAVERSAL_MAX_DEPTH_MIN; expected ${TRAVERSAL_MAX_DEPTH_MIN}, got ${clampedDepthMin}`,
      )
    }
    const edgeIdsMin = findTraversalEdgeIds(graph, {
      startNodeId: traversalQueryMin.traversalStartNodeId,
      maxDepth: clampedDepthMin,
      allowedEdgeLabels: undefined,
    })
    if (edgeIdsMin.length !== TRAVERSAL_MAX_DEPTH_MIN) {
      throw new Error(
        `Generic traversal from floating panel should respect clamped minimum depth; expected ${TRAVERSAL_MAX_DEPTH_MIN} edge, got ${edgeIdsMin.length}`,
      )
    }
  } finally {
    restore()
  }
}
