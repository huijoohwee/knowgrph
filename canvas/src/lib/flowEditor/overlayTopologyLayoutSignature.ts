import { hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'

function measuredLayoutKey(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? String(Math.round(n)) : '0'
}

function readVisualLayoutKey(props: Record<string, unknown>, key: string): string {
  const raw = props[key]
  return raw == null ? '' : measuredLayoutKey(raw)
}

export function buildOverlayTopologyLayoutSignature(graphData: GraphData | null | undefined): string {
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  const edges = Array.isArray(graphData?.edges) ? (graphData!.edges as GraphEdge[]) : []
  const nodeParts = nodes
    .map(node => {
      const id = String(node?.id || '').trim()
      if (!id) return ''
      const props = (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) ? node.properties as Record<string, unknown> : {}
      return [
        id,
        String(node.type || '').trim(),
        readVisualLayoutKey(props, 'visual:width'),
        readVisualLayoutKey(props, 'visual:height'),
        readVisualLayoutKey(props, 'visual:minWidth'),
        readVisualLayoutKey(props, 'visual:minHeight'),
        String(props['visual:zIndex'] || '').trim(),
        String(props['flow:widgetFormId'] || '').trim(),
      ].join(':')
    })
    .filter(Boolean)
    .sort()
  const edgeParts = edges
    .map(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      const sourcePortKey = readFlowEdgePortKey(edge, 'source') || ''
      const targetPortKey = readFlowEdgePortKey(edge, 'target') || ''
      return [
        String(edge.id || '').trim(),
        src || '',
        tgt || '',
        String(edge.label || '').trim(),
        sourcePortKey,
        targetPortKey,
      ].join(':')
    })
    .filter(part => part.replace(/:/g, '').trim())
    .sort()
  return hashSignatureParts(['overlay-topology-layout', nodeParts.length, ...nodeParts, edgeParts.length, ...edgeParts])
}
