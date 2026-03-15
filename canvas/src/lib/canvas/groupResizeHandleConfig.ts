import type { GraphSchema } from '@/lib/graph/schema'

export type GroupResizeHandleConfig = {
  dotRadiusPx: number
  hitRadiusPx: number
  strokeWidthPx: number
  minBoundsSizePx: number
}

export const readGroupResizeHandleConfig = (schema: GraphSchema | null | undefined): GroupResizeHandleConfig => {
  const s = schema || null
  const base: GroupResizeHandleConfig = { dotRadiusPx: 6, hitRadiusPx: 14, strokeWidthPx: 1.25, minBoundsSizePx: 24 }
  if (!s) return base
  const cfg = s.layout?.groups as unknown as {
    resizeHandle?: Partial<GroupResizeHandleConfig> | null
  } | null
  const override = cfg?.resizeHandle || null
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base
  const dotRadiusPx = typeof override.dotRadiusPx === 'number' && Number.isFinite(override.dotRadiusPx) ? Math.max(1, override.dotRadiusPx) : base.dotRadiusPx
  const hitRadiusPx = typeof override.hitRadiusPx === 'number' && Number.isFinite(override.hitRadiusPx) ? Math.max(dotRadiusPx + 1, override.hitRadiusPx) : base.hitRadiusPx
  const strokeWidthPx = typeof override.strokeWidthPx === 'number' && Number.isFinite(override.strokeWidthPx) ? Math.max(0.5, override.strokeWidthPx) : base.strokeWidthPx
  const minBoundsSizePx =
    typeof override.minBoundsSizePx === 'number' && Number.isFinite(override.minBoundsSizePx) ? Math.max(1, override.minBoundsSizePx) : base.minBoundsSizePx
  return { dotRadiusPx, hitRadiusPx, strokeWidthPx, minBoundsSizePx }
}

export const pxToWorld = (px: number, zoomK: number): number => {
  const k = typeof zoomK === 'number' && Number.isFinite(zoomK) && zoomK > 0 ? zoomK : 1
  const p = typeof px === 'number' && Number.isFinite(px) ? px : 0
  return p / k
}

