export type FlowWidgetPinnedById = Record<string, boolean>

const FLOW_WIDGET_PIN_POINTER_CLICK_GUARD_MS = 800
const flowWidgetPinPointerActivationAtByNodeId = new Map<string, number>()

function readFlowWidgetNodeId(nodeId: string | null | undefined): string {
  return String(nodeId || '').trim()
}

function pruneExpiredFlowWidgetPinPointerActivations(now: number): void {
  for (const [id, activatedAt] of flowWidgetPinPointerActivationAtByNodeId) {
    if (now - activatedAt > FLOW_WIDGET_PIN_POINTER_CLICK_GUARD_MS) {
      flowWidgetPinPointerActivationAtByNodeId.delete(id)
    }
  }
}

export function readFlowWidgetPinnedInCanvas(pinnedById: FlowWidgetPinnedById | null | undefined, nodeId: string | null | undefined): boolean {
  const id = readFlowWidgetNodeId(nodeId)
  if (!id) return true
  return (pinnedById || {})[id] !== false
}

export function setFlowWidgetPinnedById(
  pinnedById: FlowWidgetPinnedById | null | undefined,
  nodeId: string | null | undefined,
  pinned: boolean,
): FlowWidgetPinnedById | null {
  const id = readFlowWidgetNodeId(nodeId)
  if (!id) return null
  const current = pinnedById || {}
  if (Object.prototype.hasOwnProperty.call(current, id) && current[id] === pinned) return null
  return { ...current, [id]: pinned }
}

export function toggleFlowWidgetPinnedById(
  pinnedById: FlowWidgetPinnedById | null | undefined,
  nodeId: string | null | undefined,
): FlowWidgetPinnedById | null {
  return setFlowWidgetPinnedById(pinnedById, nodeId, !readFlowWidgetPinnedInCanvas(pinnedById, nodeId))
}

export function seedMissingFlowWidgetPinnedByIds(args: {
  pinnedById: FlowWidgetPinnedById | null | undefined
  nodeIds: ReadonlyArray<string>
  pinned: boolean
}): FlowWidgetPinnedById | null {
  const current = args.pinnedById || {}
  let next: FlowWidgetPinnedById | null = null
  for (let i = 0; i < args.nodeIds.length; i += 1) {
    const id = readFlowWidgetNodeId(args.nodeIds[i])
    if (!id || Object.prototype.hasOwnProperty.call(current, id)) continue
    if (!next) next = { ...current }
    next[id] = args.pinned
  }
  return next
}

export function markFlowWidgetPinPointerActivation(nodeId: string | null | undefined, now = Date.now()): boolean {
  const id = readFlowWidgetNodeId(nodeId)
  if (!id) return false
  pruneExpiredFlowWidgetPinPointerActivations(now)
  flowWidgetPinPointerActivationAtByNodeId.set(id, now)
  return true
}

export function shouldSkipFlowWidgetPinClickAfterPointerActivation(nodeId: string | null | undefined, now = Date.now()): boolean {
  const id = readFlowWidgetNodeId(nodeId)
  if (!id) return false
  pruneExpiredFlowWidgetPinPointerActivations(now)
  const activatedAt = flowWidgetPinPointerActivationAtByNodeId.get(id)
  return typeof activatedAt === 'number' && now - activatedAt <= FLOW_WIDGET_PIN_POINTER_CLICK_GUARD_MS
}
