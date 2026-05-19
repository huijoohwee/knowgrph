import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import type { GraphData } from '@/lib/graph/types'
import { shouldUseFlowEditorWidgetFloatingScreenAuthority } from '@/lib/flowEditor/widgetPlacementAuthority'

export type FlowWidgetScreenPosition = { top: number; left: number }
export type FlowWidgetWorldPosition = { x: number; y: number }

export type FlowWidgetSeedStoreState = {
  graphData?: GraphData | null
  flowWidgetPosByNodeId?: Record<string, FlowWidgetScreenPosition>
  flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, FlowWidgetScreenPosition>>
  flowWidgetWorldPosByNodeId?: Record<string, FlowWidgetWorldPosition>
  flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, FlowWidgetWorldPosition>>
}

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

export function shouldReseedFrontmatterScreenAuthorityCollective(args: {
  isFrontmatterFlow: boolean
  ids: string[]
  pinnedById: Record<string, boolean>
  defaultPinnedInCanvas: boolean
  graphMetaKind: string | null
  worldById: Record<string, FlowWidgetWorldPosition>
  zoomK: number
  zoomX: number
  zoomY: number
  panelScreen: { width: number; height: number }
  visibleViewport: { left: number; top: number; right: number; bottom: number; width: number; height: number }
}): boolean {
  if (!args.isFrontmatterFlow || args.ids.length < 2) return false
  let measured = 0
  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY
  let centroidX = 0
  let centroidY = 0
  for (let i = 0; i < args.ids.length; i += 1) {
    const id = args.ids[i]!
    const pinnedRaw = args.pinnedById[id]
    const pinnedInCanvas = typeof pinnedRaw === 'boolean' ? pinnedRaw : args.defaultPinnedInCanvas
    if (!shouldUseFlowEditorWidgetFloatingScreenAuthority({ graphMetaKind: args.graphMetaKind, pinnedInCanvas })) continue
    const world = args.worldById[id]
    if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return false
    const left = world.x * args.zoomK + args.zoomX
    const top = world.y * args.zoomK + args.zoomY
    const right = left + args.panelScreen.width
    const bottom = top + args.panelScreen.height
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) return false
    measured += 1
    minLeft = Math.min(minLeft, left)
    minTop = Math.min(minTop, top)
    maxRight = Math.max(maxRight, right)
    maxBottom = Math.max(maxBottom, bottom)
    centroidX += left + args.panelScreen.width / 2
    centroidY += top + args.panelScreen.height / 2
  }
  if (measured < 2) return false
  centroidX /= measured
  centroidY /= measured
  const targetCenterX = (args.visibleViewport.left + args.visibleViewport.right) / 2
  const targetCenterY = (args.visibleViewport.top + args.visibleViewport.bottom) / 2
  const centroidTolerancePx = Math.max(6, Math.min(args.visibleViewport.width, args.visibleViewport.height) * 0.02)
  const offCenter = Math.abs(centroidX - targetCenterX) > centroidTolerancePx || Math.abs(centroidY - targetCenterY) > centroidTolerancePx
  return offCenter
    || minLeft < args.visibleViewport.left - 1
    || minTop < args.visibleViewport.top - 1
    || maxRight > args.visibleViewport.right + 1
    || maxBottom > args.visibleViewport.bottom + 1
}

export function resolveOffscreenPinnedFlowWidgetIds(args: {
  ids: string[]
  worldById: Record<string, FlowWidgetWorldPosition>
  panelWorldW: number
  panelWorldH: number
  viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }
}): string[] {
  return args.ids
    .filter(id => {
      const world = args.worldById[id]
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return false
      const right = world.x + args.panelWorldW
      const bottom = world.y + args.panelWorldH
      if (right <= args.viewportBounds.minX) return true
      if (bottom <= args.viewportBounds.minY) return true
      if (world.x >= args.viewportBounds.maxX) return true
      if (world.y >= args.viewportBounds.maxY) return true
      return false
    })
    .sort((a, b) => a.localeCompare(b))
}

function flowWidgetWorldPositionsEqual(
  left: Record<string, FlowWidgetWorldPosition>,
  right: Record<string, FlowWidgetWorldPosition>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (let i = 0; i < rightKeys.length; i += 1) {
    const key = rightKeys[i]!
    const a = left[key]
    const b = right[key]
    if (!a || !b || Math.abs(a.x - b.x) > 0.0001 || Math.abs(a.y - b.y) > 0.0001) return false
  }
  return true
}

export function buildWorkspaceBlockedFlowWidgetSeedPatch(args: {
  prevState: FlowWidgetSeedStoreState
  graphDataForSeeding: GraphData | null
  nextWorld: Record<string, FlowWidgetWorldPosition>
  nextScreenPos: Record<string, FlowWidgetScreenPosition>
  changedScreenPos: boolean
}): Partial<FlowWidgetSeedStoreState> {
  const prevWorld = args.prevState.flowWidgetWorldPosByNodeId || {}
  if (!args.changedScreenPos && flowWidgetWorldPositionsEqual(prevWorld, args.nextWorld)) return {}
  const graphKey = buildGraphMetaKeyIgnoringPending(args.graphDataForSeeding || args.prevState.graphData || null)
  if (!graphKey) {
    return {
      ...(args.changedScreenPos ? { flowWidgetPosByNodeId: args.nextScreenPos } : {}),
      flowWidgetWorldPosByNodeId: args.nextWorld,
    }
  }
  const posByKey = args.prevState.flowWidgetPosByNodeIdByGraphMetaKey || {}
  const worldByKey = args.prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
  return {
    ...(args.changedScreenPos ? { flowWidgetPosByNodeId: args.nextScreenPos, flowWidgetPosByNodeIdByGraphMetaKey: { ...posByKey, [graphKey]: args.nextScreenPos } } : {}),
    flowWidgetWorldPosByNodeId: args.nextWorld,
    flowWidgetWorldPosByNodeIdByGraphMetaKey: { ...worldByKey, [graphKey]: args.nextWorld },
  }
}
