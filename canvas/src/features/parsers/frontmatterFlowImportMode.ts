import { useGraphStore } from '@/hooks/useGraphStore'
import { withGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
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
  applyCanvasFrontmatterPreset({
    graphData,
    defaultCanvasRenderMode: FRONTMATTER_FLOW_CANVAS_RENDER_MODE,
    defaultCanvas2dRenderer: FRONTMATTER_FLOW_CANVAS_2D_RENDERER,
    defaultDocumentSemanticMode: FRONTMATTER_FLOW_DOCUMENT_MODE,
    defaultFrontmatterModeEnabled: true,
    disableMultiDimTableMode: true,
  })
  syncFrontmatterFlowSchemaEdgeType(graphData)
  const graphKey = buildGraphMetaKeyIgnoringPending(graphData)
  useGraphStore.setState(prev => {
    const prevState = prev as unknown as {
      flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
      flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
    }
    const currentWorld = prevState.flowWidgetWorldPosByNodeId || {}
    const currentByKey = prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
    const hasGlobalWorld = Object.keys(currentWorld).length > 0
    const hasKeyedWorld = graphKey ? Object.keys(currentByKey[graphKey] || {}).length > 0 : false
    if (!hasGlobalWorld && !hasKeyedWorld) return {}
    const nextByKey = graphKey ? { ...currentByKey, [graphKey]: {} } : currentByKey
    return graphKey
      ? { flowWidgetWorldPosByNodeId: {}, flowWidgetWorldPosByNodeIdByGraphMetaKey: nextByKey }
      : { flowWidgetWorldPosByNodeId: {} }
  })
  // A frontmatter-flow graph always owns the import landing contract. Returning
  // true here avoids downstream fallback preset replays when the effective
  // state is already aligned and nothing had to mutate this frame.
  return true
}
