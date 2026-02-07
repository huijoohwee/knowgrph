import type { GraphSchema } from '@/lib/graph/schema'

export const PORT_HANDLE_STROKE_CLASS = 'border-[color:var(--kg-canvas-accent)]'
export const PORT_HANDLE_LINE_CLASS = 'bg-[color:var(--kg-canvas-accent)]'

export function readPortHandleUiMetrics(schema: GraphSchema | null): {
  sizePx: number
  hitSizePx: number
  railWidthPx: number
  lineWidthPx: number
  lineOffsetPx: number
} {
  const rawSize = schema?.behavior?.portHandles?.size
  const sizePx = typeof rawSize === 'number' && Number.isFinite(rawSize) ? Math.max(8, Math.floor(rawSize * 2 + 4)) : 12
  const hitSizePx = Math.max(18, sizePx + 6)
  const offsetPx = Math.max(2, Math.floor(sizePx / 4))
  const railWidthPx = Math.max(hitSizePx, hitSizePx + offsetPx)
  const lineWidthPx = Math.max(6, Math.floor(sizePx / 2))
  const lineOffsetPx = Math.max(1, Math.floor(sizePx / 2))
  return { sizePx, hitSizePx, railWidthPx, lineWidthPx, lineOffsetPx }
}

