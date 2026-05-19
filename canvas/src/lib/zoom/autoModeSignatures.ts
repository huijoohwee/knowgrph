import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

export function buildAutoFitToScreenSignature(args: {
  nodeCount: number
  viewportW: number
  viewportH: number
  graphDataRevision: number
  schema: GraphSchema | null
  mediaPanelDensity?: string | null
  renderMediaAsNodes?: boolean
  visibilityFrameKey?: string | null
}): string {
  const nodeCount = Math.max(0, Math.floor(Number(args.nodeCount) || 0))
  const viewportW = Math.max(1, Math.floor(Number(args.viewportW) || 1))
  const viewportH = Math.max(1, Math.floor(Number(args.viewportH) || 1))
  const graphDataRevision = Math.max(0, Math.floor(Number(args.graphDataRevision) || 0))
  const density = String(args.mediaPanelDensity || '')
  const media = args.renderMediaAsNodes ? 1 : 0
  const visibilityFrameKey = String(args.visibilityFrameKey || '')
  const schema = args.schema
  const [minScale, maxScale] = schema ? readZoomScaleExtent(schema) : [0.1, 4]
  const fitSig = schema
    ? `${String(schema.layout?.fitPadding ?? '')}|${String(schema.layout?.fitDetectClusters ?? '')}|${String(schema.layout?.fitTargetAspectRatio ?? '')}|${String(schema.layout?.fitEnforceAspectRatio ?? '')}|${minScale}|${maxScale}|${density}|${media}`
    : `${minScale}|${maxScale}|${density}|${media}`
  return `${nodeCount}|${viewportW}x${viewportH}|${graphDataRevision}|${fitSig}|${visibilityFrameKey}`
}

export function buildAutoZoomSelectionSignature(args: {
  graphDataRevision: number
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}): string {
  const nodeIds =
    Array.isArray(args.selectedNodeIds) && args.selectedNodeIds.length > 0
      ? args.selectedNodeIds
      : args.selectedNodeId
        ? [args.selectedNodeId]
        : []
  const edgeIds =
    Array.isArray(args.selectedEdgeIds) && args.selectedEdgeIds.length > 0
      ? args.selectedEdgeIds
      : args.selectedEdgeId
        ? [args.selectedEdgeId]
        : []
  const groupIds =
    Array.isArray(args.selectedGroupIds) && args.selectedGroupIds.length > 0
      ? args.selectedGroupIds
      : args.selectedGroupId
        ? [args.selectedGroupId]
        : []
  const n = nodeIds.map(v => String(v || '').trim()).filter(Boolean).sort().join(',')
  const e = edgeIds.map(v => String(v || '').trim()).filter(Boolean).sort().join(',')
  const g = groupIds.map(v => String(v || '').trim()).filter(Boolean).sort().join(',')
  const rev = Math.max(0, Math.floor(Number(args.graphDataRevision) || 0))
  if (!n && !e && !g) return ''
  return `${n}|${e}|${g}|${rev}`
}
