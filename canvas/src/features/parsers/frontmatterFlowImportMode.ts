import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'

const FRONTMATTER_FLOW_CANVAS_RENDER_MODE = '2d' as const
const FRONTMATTER_FLOW_CANVAS_2D_RENDERER = 'flowEditor' as const
const FRONTMATTER_FLOW_DOCUMENT_MODE = 'document' as const

export const applyFrontmatterFlowImportModes = (graphData: GraphData | null | undefined): boolean => {
  if (!graphData || !isFrontmatterFlowGraph(graphData)) return false
  const store = useGraphStore.getState()
  let changed = false

  try {
    if (store.canvasRenderMode !== FRONTMATTER_FLOW_CANVAS_RENDER_MODE) {
      store.setCanvasRenderMode(FRONTMATTER_FLOW_CANVAS_RENDER_MODE)
      changed = true
    }
  } catch {
    void 0
  }

  try {
    if (store.canvas2dRenderer !== FRONTMATTER_FLOW_CANVAS_2D_RENDERER) {
      store.setCanvas2dRenderer(FRONTMATTER_FLOW_CANVAS_2D_RENDERER)
      changed = true
    }
  } catch {
    void 0
  }

  try {
    if (store.documentSemanticMode !== FRONTMATTER_FLOW_DOCUMENT_MODE) {
      store.setDocumentSemanticMode(FRONTMATTER_FLOW_DOCUMENT_MODE)
      changed = true
    }
  } catch {
    void 0
  }

  try {
    if (store.frontmatterModeEnabled !== true) {
      store.setFrontmatterModeEnabled(true)
      changed = true
    }
  } catch {
    void 0
  }

  try {
    if (store.multiDimTableModeEnabled !== false) {
      store.setMultiDimTableModeEnabled(false)
      changed = true
    }
  } catch {
    void 0
  }

  return changed
}
