import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { applyCanvasFrontmatterPreset } from './canvasFrontmatterPreset'

const FRONTMATTER_FLOW_CANVAS_RENDER_MODE = '2d' as const
const FRONTMATTER_FLOW_CANVAS_2D_RENDERER = 'flowEditor' as const
const FRONTMATTER_FLOW_DOCUMENT_MODE = 'document' as const

export const applyFrontmatterFlowImportModes = (graphData: GraphData | null | undefined): boolean => {
  if (!graphData || !isFrontmatterFlowGraph(graphData)) return false
  return applyCanvasFrontmatterPreset({
    graphData,
    defaultCanvasRenderMode: FRONTMATTER_FLOW_CANVAS_RENDER_MODE,
    defaultCanvas2dRenderer: FRONTMATTER_FLOW_CANVAS_2D_RENDERER,
    defaultDocumentSemanticMode: FRONTMATTER_FLOW_DOCUMENT_MODE,
    defaultFrontmatterModeEnabled: true,
    disableMultiDimTableMode: true,
  })
}
