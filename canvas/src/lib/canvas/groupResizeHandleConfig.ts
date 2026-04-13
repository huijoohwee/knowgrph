import type { GraphSchema } from '@/lib/graph/schema'

export type GroupResizeHandleConfig = {
  dotRadiusPx: number
  hitRadiusPx: number
  strokeWidthPx: number
  minBoundsSizePx: number
  dragSensitivity: number
  dragDeadzonePx: number
}

export const readGroupResizeHandleConfig = (schema: GraphSchema | null | undefined): GroupResizeHandleConfig => {
  const s = schema || null
  const base: GroupResizeHandleConfig = { dotRadiusPx: 6, hitRadiusPx: 16, strokeWidthPx: 1.25, minBoundsSizePx: 24, dragSensitivity: 0.72, dragDeadzonePx: 3 }
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
  const dragSensitivity =
    typeof (override as { dragSensitivity?: unknown }).dragSensitivity === 'number' && Number.isFinite((override as { dragSensitivity: number }).dragSensitivity)
      ? Math.max(0.35, Math.min(1, (override as { dragSensitivity: number }).dragSensitivity))
      : base.dragSensitivity
  const dragDeadzonePx =
    typeof (override as { dragDeadzonePx?: unknown }).dragDeadzonePx === 'number' && Number.isFinite((override as { dragDeadzonePx: number }).dragDeadzonePx)
      ? Math.max(0, Math.min(24, (override as { dragDeadzonePx: number }).dragDeadzonePx))
      : base.dragDeadzonePx
  return { dotRadiusPx, hitRadiusPx, strokeWidthPx, minBoundsSizePx, dragSensitivity, dragDeadzonePx }
}

export const pxToWorld = (px: number, zoomK: number): number => {
  const k = typeof zoomK === 'number' && Number.isFinite(zoomK) && zoomK > 0 ? zoomK : 1
  const p = typeof px === 'number' && Number.isFinite(px) ? px : 0
  return p / k
}

export const computeDynamicGroupResizeHandlePx = (args: {
  dotRadiusPx: number
  hitRadiusPx: number
  strokeWidthPx: number
  groupWidth: number
  groupHeight: number
}): { dotRadiusPx: number; hitRadiusPx: number; strokeWidthPx: number } => {
  const baseDot = Number.isFinite(args.dotRadiusPx) ? Math.max(1, args.dotRadiusPx) : 6
  const baseHit = Number.isFinite(args.hitRadiusPx) ? Math.max(baseDot + 1, args.hitRadiusPx) : Math.max(baseDot + 1, 16)
  const baseStroke = Number.isFinite(args.strokeWidthPx) ? Math.max(0.5, args.strokeWidthPx) : 1.25
  const w = Number.isFinite(args.groupWidth) ? Math.max(1, args.groupWidth) : 1
  const h = Number.isFinite(args.groupHeight) ? Math.max(1, args.groupHeight) : 1
  const minSide = Math.min(w, h)
  const scale = Math.max(0.25, Math.min(1, minSide / 360))
  const dotRadiusPx = Math.max(0.8, Math.min(14, baseDot * scale))
  const strokeWidthPx = Math.max(0.5, Math.min(4, baseStroke * Math.max(0.6, scale)))
  const hitRadiusPx = Math.max(Math.max(dotRadiusPx + 1, 12), Math.min(22, baseHit * Math.max(0.7, scale)))
  return { dotRadiusPx, hitRadiusPx, strokeWidthPx }
}

export const applyGroupResizeDragSensitivity = (args: {
  startWorld: { x: number; y: number }
  world: { x: number; y: number }
  zoomK: number
  dragSensitivity: number
  dragDeadzonePx: number
}): { x: number; y: number } => {
  const sx = Number.isFinite(args.startWorld.x) ? args.startWorld.x : 0
  const sy = Number.isFinite(args.startWorld.y) ? args.startWorld.y : 0
  const wx = Number.isFinite(args.world.x) ? args.world.x : sx
  const wy = Number.isFinite(args.world.y) ? args.world.y : sy
  const sensitivity = Number.isFinite(args.dragSensitivity) ? Math.max(0.35, Math.min(1, args.dragSensitivity)) : 0.72
  const deadzoneWorld = pxToWorld(Number.isFinite(args.dragDeadzonePx) ? Math.max(0, args.dragDeadzonePx) : 0, args.zoomK)
  const applyDeadzone = (v: number): number => {
    const a = Math.abs(v)
    if (a <= deadzoneWorld) return 0
    return v < 0 ? -(a - deadzoneWorld) : (a - deadzoneWorld)
  }
  const dx = applyDeadzone(wx - sx) * sensitivity
  const dy = applyDeadzone(wy - sy) * sensitivity
  return { x: sx + dx, y: sy + dy }
}
