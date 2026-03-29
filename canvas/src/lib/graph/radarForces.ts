import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

const readNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

const readClamped = (raw: unknown, fallback: number, min: number, max: number): number => {
  const parsed = readNumber(raw)
  if (parsed == null) return fallback
  return Math.max(min, Math.min(max, parsed))
}

export type RadarForceConfig = {
  spokeDistancePx: number
  flowDistancePx: number
  flowCurveBend: number
  flowOrbitShift: number
  flowArrowLengthPx: number
  flowArrowHalfWidthPx: number
  nodeCharge: number
  hubCharge: number
  spokeStrengthScale: number
  flowStrengthScale: number
}

export const readRadarForceConfig = (schema: GraphSchema): RadarForceConfig => {
  const forces = (schema.layout?.forces || {}) as Record<string, unknown>
  return {
    spokeDistancePx: readClamped(forces.radarSpokeDistancePx, 150, 40, 1400),
    flowDistancePx: readClamped(forces.radarFlowDistancePx, 360, 60, 2400),
    flowCurveBend: readClamped(forces.radarFlowCurveBend, 0.18, -0.8, 0.8),
    flowOrbitShift: readClamped(forces.radarFlowOrbitShift, 0.06, 0, 0.45),
    flowArrowLengthPx: readClamped(forces.radarFlowArrowLengthPx, 12, 4, 30),
    flowArrowHalfWidthPx: readClamped(forces.radarFlowArrowHalfWidthPx, 5.2, 2, 14),
    nodeCharge: readClamped(forces.radarNodeCharge, -110, -600, -5),
    hubCharge: readClamped(forces.radarHubCharge, -16, -120, 8),
    spokeStrengthScale: readClamped(forces.radarSpokeStrengthScale, 1, 0.2, 2.5),
    flowStrengthScale: readClamped(forces.radarFlowStrengthScale, 1, 0.2, 2.5),
  }
}

export const isRadarHubNode = (node: GraphNode): boolean => {
  const props = (node.properties || {}) as Record<string, unknown>
  return props['kg:radarHub'] === true || String(node.type || '').trim().toLowerCase() === 'hub'
}

export const isRadarGraphNode = (node: GraphNode): boolean => {
  const props = (node.properties || {}) as Record<string, unknown>
  return props['kg:radarNode'] === true || props['kg:radarHub'] === true || isRadarHubNode(node)
}

export const isRadarGraph = (nodes: GraphNode[]): boolean => {
  for (let i = 0; i < nodes.length; i += 1) {
    if (isRadarGraphNode(nodes[i]!)) return true
  }
  return false
}

export const isRadarSpokeEdge = (edge: GraphEdge): boolean => {
  const props = ((edge as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
  return props['kg:radarSpoke'] === true || String(edge.label || '').trim() === 'spokeTo'
}

export const isRadarFlowEdge = (edge: GraphEdge): boolean => {
  const props = ((edge as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
  return props['kg:radarFlow'] === true || String(edge.label || '').trim() === 'pointsTo'
}
