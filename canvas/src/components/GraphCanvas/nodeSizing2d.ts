import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { MINIMAP_HEIGHT, MINIMAP_WIDTH, ZOOM_MAX } from '@/features/minimap/math'

export type NodeRenderShape2d = 'circle' | 'rect'

export function getNodeRenderShape2d(node: GraphNode, schema: GraphSchema): NodeRenderShape2d {
  const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
  if (String(node.type || '') === 'Image') return 'rect'
  const fromSchema = schema.nodeShapes?.[String(node.type || '')]
  if (fromSchema === 'rect') return 'rect'
  if (fromSchema === 'circle') return 'circle'
  const mode = schema.behavior?.nodeShapeMode
  if (mode === 'rect') return 'rect'
  if (mode === 'circle') return 'circle'
  const raw = (node.properties || {})['visual:shape']
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'rect') return 'rect'
  if (v === 'circle') return 'circle'
  return portHandlesEnabled ? 'rect' : 'circle'
}

function getRectNodeMaxZoomMinimapRatios(schema?: GraphSchema | null): { widthRatio: number; heightRatio: number } {
  const cfg = schema?.layout?.rectNodes || {}
  const wRaw = cfg.maxZoomMinimapWidthRatio
  const hRaw = cfg.maxZoomMinimapHeightRatio
  const rawWidth =
    typeof wRaw === 'number' && Number.isFinite(wRaw)
      ? wRaw
      : typeof hRaw === 'number' && Number.isFinite(hRaw)
          ? hRaw * 2
          : 5.0
  const widthRatio = Math.max(1, Math.min(50, rawWidth))
  const heightRatio = widthRatio / 2
  return { widthRatio, heightRatio }
}

export function getRectNodeTargetPxAtMaxZoom(schema?: GraphSchema | null): { widthPx: number; heightPx: number } {
  const { widthRatio, heightRatio } = getRectNodeMaxZoomMinimapRatios(schema)
  return {
    widthPx: MINIMAP_WIDTH * widthRatio,
    heightPx: MINIMAP_HEIGHT * heightRatio,
  }
}

export function getRectNodeDefaultDimensions2d(schema?: GraphSchema | null): { width: number; height: number } {
  const { widthPx, heightPx } = getRectNodeTargetPxAtMaxZoom(schema)
  const denom = Math.max(1e-6, ZOOM_MAX)
  return {
    width: widthPx / denom,
    height: heightPx / denom,
  }
}

export function getRectFallbackPolicy(schema: GraphSchema): 'minimap' | 'radius' {
  const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
  return portHandlesEnabled ? 'minimap' : 'radius'
}

export function getNodeRectDimensions2d(node: GraphNode, schema: GraphSchema): { width: number; height: number } {
  const props = (node.properties || {}) as Record<string, unknown>
  const visualW = props['visual:width']
  const visualH = props['visual:height']
  const w =
    typeof visualW === 'number' && Number.isFinite(visualW) && visualW > 0
      ? visualW
      : null
  const h =
    typeof visualH === 'number' && Number.isFinite(visualH) && visualH > 0
      ? visualH
      : null

  const policy = getRectFallbackPolicy(schema)
  const fallback = (() => {
    if (policy === 'minimap') return getRectNodeDefaultDimensions2d(schema)
    const r = getRenderNodeRadius2d(node, schema)
    const rr = typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 10
    return { width: rr * 2, height: rr * 2 }
  })()

  return { width: w ?? fallback.width, height: h ?? fallback.height }
}

export function getNodeHalfExtents2d(node: GraphNode, schema: GraphSchema): { halfW: number; halfH: number } {
  const shape = getNodeRenderShape2d(node, schema)
  if (shape === 'circle') {
    const r = getRenderNodeRadius2d(node, schema)
    const rr = typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 10
    return { halfW: rr, halfH: rr }
  }
  const { width, height } = getNodeRectDimensions2d(node, schema)
  return { halfW: width / 2, halfH: height / 2 }
}
