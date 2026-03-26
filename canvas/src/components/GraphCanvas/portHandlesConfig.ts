import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens'

export type PortHandlesConfig = {
  enabled: boolean
  placement: 'cardinal'
  size: number
  offset: number
  strokeWidth: number
  stroke: string
  fill: string
}

export const computeDynamicNodePortHandlePx = (args: {
  sizePx: number
  strokeWidthPx: number
  offsetPx: number
  nodeWidth: number
  nodeHeight: number
}): { sizePx: number; strokeWidthPx: number; offsetPx: number } => {
  const baseSize = Number.isFinite(args.sizePx) ? Math.max(0.8, args.sizePx) : 4
  const baseStroke = Number.isFinite(args.strokeWidthPx) ? Math.max(0.5, args.strokeWidthPx) : 1.5
  const baseOffset = Number.isFinite(args.offsetPx) ? Math.max(0, args.offsetPx) : 2
  const w = Number.isFinite(args.nodeWidth) ? Math.max(1, args.nodeWidth) : 1
  const h = Number.isFinite(args.nodeHeight) ? Math.max(1, args.nodeHeight) : 1
  const minSide = Math.min(w, h)
  const scale = Math.max(0.25, Math.min(1.1, minSide / 140))
  const sizePx = Math.max(0.8, Math.min(12, baseSize * scale))
  const strokeWidthPx = Math.max(0.5, Math.min(4, baseStroke * Math.max(0.7, scale)))
  const offsetPx = Math.max(0, Math.min(14, baseOffset * Math.max(0.75, scale)))
  return { sizePx, strokeWidthPx, offsetPx }
}

export const computeZoomScaledPortHandlePx = (args: {
  sizePx: number
  strokeWidthPx: number
  offsetPx: number
  zoomK?: number
}): { sizePx: number; strokeWidthPx: number; offsetPx: number } => {
  const k = typeof args.zoomK === 'number' && Number.isFinite(args.zoomK) && args.zoomK > 0 ? args.zoomK : 1
  const zoomScale = Math.max(0.6, Math.min(1.6, Math.pow(k, 0.35)))
  const sizePx = Math.max(0.8, Math.min(16, args.sizePx * zoomScale))
  const strokeWidthPx = Math.max(0.5, Math.min(5, args.strokeWidthPx * Math.max(0.8, zoomScale)))
  const offsetPx = Math.max(0, Math.min(18, args.offsetPx * Math.max(0.85, zoomScale)))
  return { sizePx, strokeWidthPx, offsetPx }
}

export const shouldRenderNodePortHandleAsDot = (sizePx: number): boolean => {
  const s = Number.isFinite(sizePx) ? sizePx : 0
  return s <= 2.8
}

export const readNodePortHandleVisualMetrics = (args: {
  schema: GraphSchema
  nodeWidth: number
  nodeHeight: number
  zoomK?: number
}): { sizePx: number; strokeWidthPx: number; offsetPx: number } => {
  const cfg = getPortHandlesConfig(args.schema)
  const dynamic = computeDynamicNodePortHandlePx({
    sizePx: cfg.size,
    strokeWidthPx: cfg.strokeWidth,
    offsetPx: cfg.offset,
    nodeWidth: args.nodeWidth,
    nodeHeight: args.nodeHeight,
  })
  return computeZoomScaledPortHandlePx({
    sizePx: dynamic.sizePx,
    strokeWidthPx: dynamic.strokeWidthPx,
    offsetPx: dynamic.offsetPx,
    zoomK: args.zoomK,
  })
}

export function getPortHandlesConfig(schema: GraphSchema): PortHandlesConfig {
  const raw = schema.behavior?.portHandles || {}
  const enabled = Boolean(raw.enabled)
  const placement = raw.placement === 'cardinal' ? 'cardinal' : 'cardinal'
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size > 0 ? raw.size : 4
  const offset = typeof raw.offset === 'number' && Number.isFinite(raw.offset) && raw.offset >= 0 ? raw.offset : 2
  const strokeWidth =
    typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth) && raw.strokeWidth >= 0 ? raw.strokeWidth : 1.5
  const stroke = getThreeSelectionConfig(schema).selectedEdgeColor
  const fill = UI_THEME_COLORS_CSS.bg
  return { enabled, placement, size, offset, strokeWidth, stroke, fill }
}
