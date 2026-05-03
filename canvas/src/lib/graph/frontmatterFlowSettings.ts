import type { GraphData } from '@/lib/graph/types'
import type { GlobalEdgeType } from '@/lib/graph/edgeTypes'
import { normalizeGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { isPlainObject } from '@/lib/graph/value'

export type FrontmatterFlowRenderSettings = {
  rankdir: 'LR' | 'TB'
  edgeType: GlobalEdgeType
}

function readFrontmatterFlowSettingsRecord(graphData: Pick<GraphData, 'metadata'> | null | undefined): Record<string, unknown> | null {
  const meta = toMetadataRecord(graphData?.metadata)
  if (String(meta.kind || '').trim() !== 'frontmatter-flow') return null
  const rawSettings = meta.frontmatterFlowSettings
  const settings = toMetadataRecord(rawSettings)
  return isPlainObject(rawSettings) ? settings : null
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
