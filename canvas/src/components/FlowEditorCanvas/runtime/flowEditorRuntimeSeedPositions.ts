import { shouldUseFlowEditorWidgetFloatingScreenAuthority } from '@/lib/flowEditor/widgetPlacementAuthority'

export type FlowWidgetScreenPosition = { top: number; left: number }
export type FlowWidgetWorldPosition = { x: number; y: number }

export function syncFlowWidgetScreenAuthorityPosition(args: {
  id: string
  world: FlowWidgetWorldPosition
  nextScreenPos: Record<string, FlowWidgetScreenPosition>
  pinnedById: Record<string, boolean>
  defaultPinnedInCanvas: boolean
  graphMetaKind: string | null
  zoomK: number
  zoomX: number
  zoomY: number
}): boolean {
  const pinnedRaw = args.pinnedById[args.id]
  const pinnedInCanvas = typeof pinnedRaw === 'boolean' ? pinnedRaw : args.defaultPinnedInCanvas
  if (!shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind: args.graphMetaKind, pinnedInCanvas })) return false
  const left = args.world.x * args.zoomK + args.zoomX
  const top = args.world.y * args.zoomK + args.zoomY
  if (!Number.isFinite(left) || !Number.isFinite(top)) return false
  const prev = args.nextScreenPos[args.id]
  if (prev && Math.abs(prev.left - left) <= 0.0001 && Math.abs(prev.top - top) <= 0.0001) return false
  args.nextScreenPos[args.id] = { left, top }
  return true
}
