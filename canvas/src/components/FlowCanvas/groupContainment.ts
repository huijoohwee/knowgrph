import type { FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { clampNumber, clampDelta, computeDeltaClampForTopLeftNodes } from '@/lib/canvas/groupContainment'
import { buildDeepestGroupRectByNodeId, buildGroupRectByIdFromGroups } from '@/lib/canvas/groupExplicitBounds'

export type FlowNodeClamp = { minX: number; maxX: number; minY: number; maxY: number }
export type FlowDeltaClamp = { minDx: number; maxDx: number; minDy: number; maxDy: number }

export const computeFlowNodeClamp = (args: { scene: FlowNativeScene; nodeId: string }): FlowNodeClamp | null => {
  const id = String(args.nodeId || '').trim()
  if (!id) return null
  const node = args.scene.nodeById.get(id) || null
  if (!node) return null
  const groups = (args.scene.groups || []) as GraphGroup[]
  const groupRectById = buildGroupRectByIdFromGroups(groups)
  const rectByNodeId = buildDeepestGroupRectByNodeId({ groups, groupRectById })
  const rect = rectByNodeId.get(id) || null
  if (!rect) return null
  const minX = rect.x
  const maxX = rect.x + rect.width - node.width
  const minY = rect.y
  const maxY = rect.y + rect.height - node.height
  return { minX, maxX, minY, maxY }
}

export const clampFlowNodeTopLeft = (args: { clamp: FlowNodeClamp; x: number; y: number }) => {
  return {
    x: clampNumber(args.x, args.clamp.minX, args.clamp.maxX),
    y: clampNumber(args.y, args.clamp.minY, args.clamp.maxY),
  }
}

export const computeFlowDeltaClampForNodes = (args: {
  scene: FlowNativeScene
  nodeIds: string[]
  startPosById: Map<string, { x: number; y: number }>
}): FlowDeltaClamp | null => {
  if (!args.nodeIds.length) return null
  const groups = (args.scene.groups || []) as GraphGroup[]
  const groupRectById = buildGroupRectByIdFromGroups(groups)
  const rectByNodeId = buildDeepestGroupRectByNodeId({ groups, groupRectById })
  const sizeById = new Map<string, { w: number; h: number }>()
  for (let i = 0; i < args.nodeIds.length; i += 1) {
    const id = String(args.nodeIds[i] || '').trim()
    if (!id) continue
    const n = args.scene.nodeById.get(id) || null
    if (!n) continue
    sizeById.set(id, { w: n.width, h: n.height })
  }
  return computeDeltaClampForTopLeftNodes({ nodeIds: args.nodeIds, startPosById: args.startPosById, sizeById, rectByNodeId })
}

export const clampFlowDelta = (args: { clamp: FlowDeltaClamp; dx: number; dy: number }) => {
  return clampDelta(args)
}
