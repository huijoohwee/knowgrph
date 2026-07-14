import type { GraphSchema } from '@/lib/graph/schema'
import { readNodePortHandleVisualMetrics } from '@/components/GraphCanvas/portHandlesConfig'

export const PORT_HANDLE_STROKE_CLASS = 'border-[color:var(--kg-canvas-accent)]'
export const PORT_HANDLE_LINE_CLASS = 'bg-[color:var(--kg-canvas-accent)]'
export const PORT_HANDLE_MIN_INTERACTIVE_SIZE_PX = 24
export const PORT_HANDLE_MIN_VISUAL_SIZE_PX = 10
export const PORT_HANDLE_VISUAL_SCALE = 1.75

export function readPortHandleUiMetrics(
  schema: GraphSchema | null,
  opts?: { nodeWidth?: number; nodeHeight?: number; zoomK?: number },
): {
  sizePx: number
  hitSizePx: number
  railWidthPx: number
  lineWidthPx: number
  lineOffsetPx: number
} {
  const base = readNodePortHandleVisualMetrics({
    schema: schema || ({ behavior: {} } as unknown as GraphSchema),
    nodeWidth: Number.isFinite(opts?.nodeWidth) ? Math.max(1, opts?.nodeWidth as number) : 180,
    nodeHeight: Number.isFinite(opts?.nodeHeight) ? Math.max(1, opts?.nodeHeight as number) : 96,
    zoomK: opts?.zoomK,
  })
  const sizePx = Math.max(PORT_HANDLE_MIN_VISUAL_SIZE_PX, Math.round(base.sizePx * PORT_HANDLE_VISUAL_SCALE))
  const hitSizePx = Math.max(6, Math.round(sizePx + 3))
  const offsetPx = Math.max(2, Math.floor(sizePx / 4))
  const railWidthPx = Math.max(hitSizePx, Math.round(hitSizePx + offsetPx))
  const lineWidthPx = Math.max(2, Math.floor(sizePx / 2))
  const lineOffsetPx = Math.max(1, Math.floor(sizePx / 2))
  return { sizePx, hitSizePx, railWidthPx, lineWidthPx, lineOffsetPx }
}
