import { useGraphStore } from '@/hooks/useGraphStore'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import type { GraphData, JSONValue } from '@/lib/graph/types'

function ensureCanonicalFrontmatterVerificationGeometry(graphData: GraphData): GraphData {
  const metadata = graphData?.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return graphData
  const meta = metadata as Record<string, unknown>
  if (String(meta.kind || '').trim() !== 'frontmatter-flow') return graphData
  const rawSettings = meta.frontmatterFlowSettings
  const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? (rawSettings as Record<string, unknown>)
    : null
  const nextSettings: Record<string, JSONValue> = {
    ...(settings || {}),
    balancedViewportPreset: 'widgetFrontmatter',
  } as Record<string, JSONValue>
  if (settings && settings.balancedViewportPreset === nextSettings.balancedViewportPreset) return graphData
  return {
    ...graphData,
    metadata: {
      ...meta,
      frontmatterFlowSettings: nextSettings,
    },
  }
}

export function applyGraphDataCanonicalBootstrap(args: {
  graphData: GraphData
  rawText?: string | null
  applyGraphData?: boolean
}): void {
  const graphData = ensureCanonicalFrontmatterVerificationGeometry(args.graphData)
  const rawText = String(args.rawText || '')
  const store = useGraphStore.getState()
  if (args.applyGraphData !== false) {
    store.setGraphData(graphData)
  }
  const appliedGraphPreset = applyFrontmatterFlowImportModes(graphData, { rawText })
  if (!appliedGraphPreset) {
    applyCanvasFrontmatterPreset({
      graphData,
      rawText,
    })
  }
}
