import { useGraphStore } from '@/hooks/useGraphStore'
import { withGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import type { GraphData } from '@/lib/graph/types'
import { applyCanvasFrontmatterPreset } from './canvasFrontmatterPreset'

const FRONTMATTER_FLOW_CANVAS_RENDER_MODE = '2d' as const
const FRONTMATTER_FLOW_CANVAS_2D_RENDERER = 'flowEditor' as const
const FRONTMATTER_FLOW_DOCUMENT_MODE = 'document' as const

const syncFrontmatterFlowSchemaEdgeType = (graphData: GraphData): boolean => {
  const settings = readFrontmatterFlowRenderSettings(graphData)
  if (!settings) return false
  const store = useGraphStore.getState()
  const current = store.schema
  const nextSchema = withGlobalEdgeType(current, settings.edgeType)
  if (nextSchema === current) return false
  store.setSchema(nextSchema)
  return true
}

export const applyFrontmatterFlowImportModes = (graphData: GraphData | null | undefined): boolean => {
  if (!graphData || !isFrontmatterFlowGraph(graphData)) return false
  const presetChanged = applyCanvasFrontmatterPreset({
    graphData,
    defaultCanvasRenderMode: FRONTMATTER_FLOW_CANVAS_RENDER_MODE,
    defaultCanvas2dRenderer: FRONTMATTER_FLOW_CANVAS_2D_RENDERER,
    defaultDocumentSemanticMode: FRONTMATTER_FLOW_DOCUMENT_MODE,
    defaultFrontmatterModeEnabled: true,
    disableMultiDimTableMode: true,
  })
  const edgeTypeChanged = syncFrontmatterFlowSchemaEdgeType(graphData)
  return presetChanged || edgeTypeChanged
}
