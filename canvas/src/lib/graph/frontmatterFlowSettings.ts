import type { GraphData } from '@/lib/graph/types'

export type FrontmatterFlowRenderSettings = {
  rankdir: 'LR' | 'TB'
  edgeType: 'bezier' | 'straight' | 'step' | 'smoothstep'
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
  const edgeRaw = String(settings.edgeType || '').trim().toLowerCase()
  const edgeType: 'bezier' | 'straight' | 'step' | 'smoothstep' =
    edgeRaw === 'straight' || edgeRaw === 'step' || edgeRaw === 'smoothstep' || edgeRaw === 'bezier'
      ? edgeRaw
      : 'bezier'
  return { rankdir, edgeType }
}

export function isFrontmatterFlowComputedEnabled(
  graphData: Pick<GraphData, 'metadata'> | null | undefined,
): boolean {
  const settings = readFrontmatterFlowSettingsRecord(graphData)
  if (!settings) return true
  return settings.computed !== false
}
