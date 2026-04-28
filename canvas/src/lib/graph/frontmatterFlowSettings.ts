import type { GraphData } from '@/lib/graph/types'
import type { GlobalEdgeType } from '@/lib/graph/edgeTypes'
import { normalizeGlobalEdgeType } from '@/lib/graph/edgeTypes'

export type FrontmatterFlowRenderSettings = {
  rankdir: 'LR' | 'TB'
  edgeType: GlobalEdgeType
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFrontmatterFlowSettingsRecord(graphData: Pick<GraphData, 'metadata'> | null | undefined): Record<string, unknown> | null {
  const meta = isRecord(graphData?.metadata) ? (graphData?.metadata as Record<string, unknown>) : null
  if (!meta) return null
  if (String(meta.kind || '').trim() !== 'frontmatter-flow') return null
  const settings = isRecord(meta.frontmatterFlowSettings) ? (meta.frontmatterFlowSettings as Record<string, unknown>) : null
  return settings
}

export function readFrontmatterFlowRenderSettings(
  graphData: Pick<GraphData, 'metadata'> | null | undefined,
): FrontmatterFlowRenderSettings | null {
  const settings = readFrontmatterFlowSettingsRecord(graphData)
  if (!settings) return null
  const directionRaw = String(settings.direction || '').trim().toUpperCase()
  const rankdir: 'LR' | 'TB' = directionRaw === 'TB' || directionRaw === 'BT' ? 'TB' : 'LR'
  const edgeType = normalizeGlobalEdgeType(settings.edgeType)
  return { rankdir, edgeType }
}

export function isFrontmatterFlowComputedEnabled(
  graphData: Pick<GraphData, 'metadata'> | null | undefined,
): boolean {
  const settings = readFrontmatterFlowSettingsRecord(graphData)
  if (!settings) return true
  return settings.computed !== false
}
