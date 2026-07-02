import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import {
  clampFrontmatterInitialFitFillRatio,
  FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO,
} from '@/components/FlowCanvas/frontmatterLayoutConfig'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import type { GraphSchema } from '@/lib/graph/schema'
import { MEDIA_PANEL_LAYOUT_FRAME_16X9 } from '@/lib/render/mediaPanelSpec'

type FlowFitIntent = 'fitToView' | 'fitToScreen' | 'initialFit'
export { FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO } from '@/components/FlowCanvas/frontmatterLayoutConfig'

export function resolveFitReferenceFrame(args: {
  viewportW?: number
  viewportH?: number
  referenceWidth?: number
  referenceHeight?: number
}): { width: number; height: number } {
  const width = Math.max(
    320,
    Math.floor(
      Number.isFinite(args.referenceWidth)
        ? Number(args.referenceWidth)
        : MEDIA_PANEL_LAYOUT_FRAME_16X9.width,
    ),
  )
  const height = Math.max(
    180,
    Math.floor(
      Number.isFinite(args.referenceHeight)
        ? Number(args.referenceHeight)
        : MEDIA_PANEL_LAYOUT_FRAME_16X9.height,
    ),
  )
  const viewportW = Math.max(1, Math.floor(Number(args.viewportW) || width))
  const viewportH = Math.max(1, Math.floor(Number(args.viewportH) || height))
  return {
    width: Math.min(viewportW, width),
    height: Math.min(viewportH, height),
  }
}

export function readStoryboardWidgetPortExtraPadScreenPx(schema: GraphSchema | null): number {
  const port = schema?.behavior?.portHandles || null
  const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled)
  if (!portEnabled) return 0
  const portSizePx = typeof (port as { size?: unknown } | null)?.size === 'number' ? Math.max(0, (port as { size: number }).size) : 4
  const portOffsetPx = typeof (port as { offset?: unknown } | null)?.offset === 'number' ? Math.max(0, (port as { offset: number }).offset) : 2
  return portSizePx + portOffsetPx + 8
}

export function buildFlowFitOptions(args: {
  schema: GraphSchema | null
  intent: FlowFitIntent
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  documentSemanticMode: string
  documentStructureBaselineLock: boolean
  enableDocumentStructureBounds?: boolean
  frontmatterFlowInitialFitFillRatio?: number
}) {
  const mode = readLayoutMode(args.schema)
  const documentViewMode = readDocumentViewModeContext({
    frontmatterModeEnabled: args.frontmatterModeEnabled === true,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled === true,
    documentSemanticMode: String(args.documentSemanticMode || 'document'),
    documentStructureBaselineLock: args.documentStructureBaselineLock === true,
  })
  const targetFillRatioOverride =
    documentViewMode.activeDocumentViewMode === 'frontmatter' && args.intent === 'initialFit'
      ? clampFrontmatterInitialFitFillRatio(
          args.frontmatterFlowInitialFitFillRatio ?? FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO,
        )
      : undefined
  const opts = readFitAllOptions({
    schema: args.schema,
    mode,
    intent: args.intent,
    targetFillRatioOverride,
  })
  if (args.enableDocumentStructureBounds !== true) return opts
  if (documentViewMode.forceDocumentStructureGroups !== true) return opts

  opts.detectClusters = false
  opts.includeGroupsBounds = true
  opts.deriveGroupsOptions = { forceDocumentStructure: true }
  opts.schema = {
    ...(args.schema || {}),
    layout: {
      ...((args.schema?.layout || {}) as Record<string, unknown>),
      groups: { ...(args.schema?.layout?.groups || {}), enabled: true },
    },
  } as GraphSchema
  return opts
}
