import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { readDocumentViewModeContext } from '@/lib/graph/documentViewMode'
import type { GraphSchema } from '@/lib/graph/schema'

type FlowFitIntent = 'fitToView' | 'fitToScreen' | 'initialFit'

export function readFlowEditorPortExtraPadScreenPx(schema: GraphSchema | null): number {
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
}) {
  const mode = readLayoutMode(args.schema)
  const opts = readFitAllOptions({ schema: args.schema, mode, intent: args.intent })
  if (args.enableDocumentStructureBounds !== true) return opts

  const documentViewMode = readDocumentViewModeContext({
    frontmatterModeEnabled: args.frontmatterModeEnabled === true,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled === true,
    documentSemanticMode: String(args.documentSemanticMode || 'document'),
    documentStructureBaselineLock: args.documentStructureBaselineLock === true,
  })
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
