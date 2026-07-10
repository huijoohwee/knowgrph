import { FLOW_HANDLE_DEFAULT_EDGE_ID } from '@/components/FlowCanvas/handles'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
} from '@/lib/graph/flowPorts'
import type { GraphEdge } from '@/lib/graph/types'
import { resolveFrontmatterOverlayEdgeCurveOptions } from '@/lib/storyboardWidget/frontmatterCollectiveLayout'
import {
  buildStoryboardCardMediaDropOverlayEdgeId,
  CARD_MEDIA_DROP_EDGE_TARGET_PORT,
  isStoryboardCardMediaDropOverlayEdge,
  readStoryboardCardMediaDropPanelSourcePortKey,
  readStoryboardCardMediaDropPanelTargetId,
} from '@/components/StoryboardWidgetCanvas/storyboardCardMediaDropGraph'

type OverlayNode = { id: unknown; metadata?: unknown; type?: unknown; properties?: unknown }

type OverlayEdge = {
  id: string
  source: string
  target: string
  sourcePortKey: string
  targetPortKey: string
  edgeType: string
}

type EdgeCurve = { bend: number; orbitShift: number; orbital: boolean; phase: -1 | 1 } | null

const buildMediaDropPairKey = (source: string, target: string): string => `${source}->${target}`

export function appendStoryboardCardMediaDropOverlayEdges(args: {
  defaultPortKeyByNodeId: Map<string, { in: string; out: string }>
  edgeCurveById: Map<string, EdgeCurve>
  edges: OverlayEdge[]
  graphMetaKind: string | null
  nodeIds: ReadonlySet<string>
  nodes: readonly OverlayNode[]
  overlayNodeById: ReadonlyMap<string, OverlayNode>
  rawEdgeById: Map<string, GraphEdge>
  readCanonicalId: (rawId: unknown) => string
}): void {
  const mediaDropPairKeys = new Set<string>()
  for (let i = 0; i < args.edges.length; i += 1) {
    const edge = args.edges[i]
    const rawEdge = args.rawEdgeById.get(edge.id)
    if (!rawEdge) continue
    if (isStoryboardCardMediaDropOverlayEdge(rawEdge, args.overlayNodeById.get(edge.source) || null, edge.target)) {
      mediaDropPairKeys.add(buildMediaDropPairKey(edge.source, edge.target))
    }
  }

  for (let i = 0; i < args.nodes.length; i += 1) {
    const sourceNode = args.nodes[i]
    const source = args.readCanonicalId(sourceNode?.id)
    const target = args.readCanonicalId(readStoryboardCardMediaDropPanelTargetId(sourceNode))
    if (!source || !target || !args.nodeIds.has(source) || !args.nodeIds.has(target)) continue

    const pairKey = buildMediaDropPairKey(source, target)
    if (mediaDropPairKeys.has(pairKey)) continue

    const id = buildStoryboardCardMediaDropOverlayEdgeId(source, target)
    if (args.rawEdgeById.has(id)) continue

    const sourcePortKey =
      readStoryboardCardMediaDropPanelSourcePortKey(sourceNode)
      || args.defaultPortKeyByNodeId.get(source)?.out
      || FLOW_HANDLE_DEFAULT_EDGE_ID
    const targetPortKey = CARD_MEDIA_DROP_EDGE_TARGET_PORT
    const syntheticEdge: GraphEdge = {
      id,
      source,
      target,
      label: 'linksTo',
      properties: {
        [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePortKey,
        [FLOW_EDGE_TARGET_PORT_KEY]: targetPortKey,
        storyboardCardMediaDropEdge: true,
        storyboardCardMediaTargetId: target,
      } as never,
    }

    args.rawEdgeById.set(id, syntheticEdge)
    args.edgeCurveById.set(id, resolveFrontmatterOverlayEdgeCurveOptions({
      graphMetaKind: args.graphMetaKind,
      edge: syntheticEdge,
      sourceNode,
      targetNode: args.overlayNodeById.get(target) || null,
      sourceId: source,
      targetId: target,
    }))
    args.edges.push({
      id,
      source,
      target,
      sourcePortKey,
      targetPortKey,
      edgeType: '',
    })
    mediaDropPairKeys.add(pairKey)
  }
}
