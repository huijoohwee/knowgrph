import type { GraphData } from '@/lib/graph/types'
import type { GlobalEdgeType } from '@/lib/graph/edgeTypes'
import { normalizeGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { isPlainObject } from '@/lib/graph/value'
import type { BalancedSpreadViewportPreset } from '@/lib/ui/overlayBalancedSpread'

export type FrontmatterFlowRenderSettings = {
  rankdir: 'LR' | 'TB'
  edgeType: GlobalEdgeType
  balancedViewportPreset?: BalancedSpreadViewportPreset
  balancedHeroRowCount?: number
  balancedHeroRowGapScale?: number
  balancedPanelOffsetScale?: number
}

export function resolveFlowLayoutBalancedViewportPreset(args: {
  graphData: Pick<GraphData, 'metadata'> | null | undefined
  fallbackPreset: BalancedSpreadViewportPreset
}): BalancedSpreadViewportPreset {
  return readFrontmatterFlowRenderSettings(args.graphData)?.balancedViewportPreset || args.fallbackPreset
}

export function resolveBalancedViewportPreset(args: {
  graphData: Pick<GraphData, 'metadata'> | null | undefined
  fallbackPreset: BalancedSpreadViewportPreset
}): BalancedSpreadViewportPreset {
  return resolveFlowLayoutBalancedViewportPreset(args)
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
  const balancedViewportPresetRaw = String(settings.balancedViewportPreset || '').trim()
  const balancedViewportPreset: BalancedSpreadViewportPreset | undefined =
    balancedViewportPresetRaw === 'widgetFrontmatter'
      ? 'widgetFrontmatter'
      : balancedViewportPresetRaw === 'widgetCanvas'
        ? 'widgetCanvas'
        : balancedViewportPresetRaw === 'richMedia'
          ? 'richMedia'
          : undefined
  const balancedHeroRowCountRaw = Number(settings.balancedHeroRowCount)
  const balancedHeroRowCount =
    Number.isFinite(balancedHeroRowCountRaw) && balancedHeroRowCountRaw >= 2
      ? Math.max(2, Math.min(6, Math.floor(balancedHeroRowCountRaw)))
      : undefined
  const balancedHeroRowGapScaleRaw = Number(settings.balancedHeroRowGapScale)
  const balancedHeroRowGapScale =
    Number.isFinite(balancedHeroRowGapScaleRaw) && balancedHeroRowGapScaleRaw > 0
      ? Math.max(0.6, Math.min(1.5, balancedHeroRowGapScaleRaw))
      : undefined
  const balancedPanelOffsetScaleRaw = Number(settings.balancedPanelOffsetScale)
  const balancedPanelOffsetScale =
    Number.isFinite(balancedPanelOffsetScaleRaw) && balancedPanelOffsetScaleRaw > 0
      ? Math.max(0.8, Math.min(1.4, balancedPanelOffsetScaleRaw))
      : undefined
  return { rankdir, edgeType, balancedViewportPreset, balancedHeroRowCount, balancedHeroRowGapScale, balancedPanelOffsetScale }
}

export function isFrontmatterFlowComputedEnabled(
  graphData: Pick<GraphData, 'metadata'> | null | undefined,
): boolean {
  const settings = readFrontmatterFlowSettingsRecord(graphData)
  if (!settings) return true
  return settings.computed !== false
}
