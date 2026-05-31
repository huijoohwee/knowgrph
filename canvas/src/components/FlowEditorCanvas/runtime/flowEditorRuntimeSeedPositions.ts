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
