type FlowPortHandlePointerDragArgs = {
  event: FlowPortHandlePointerDragEvent
  sourceNodeId: string
  sourcePortKey?: string | null
}

type FlowPortHandleMouseDragArgs = {
  event: FlowPortHandleMouseDragEvent
  sourceNodeId: string
  sourcePortKey?: string | null
}

type FlowPortHandlePointerDragEvent = {
  button: number
  pointerId: number
  clientX: number
  clientY: number
  preventDefault: () => void
}

type FlowPortHandleMouseDragEvent = {
  button: number
  clientX: number
  clientY: number
  preventDefault: () => void
}

export type FlowPortHandleFinalizeDetail = {
  sourceNodeId: string
  targetNodeId: string
  targetPortKey: string | null
}

export type FlowPortHandleCancelDetail = {
  sourceNodeId: string
  sourcePortKey: string | null
  clientX: number
  clientY: number
}

export type FlowPortHandlePreviewDetail = {
  phase: 'start' | 'move' | 'cancel'
  sourceNodeId: string
  sourcePortKey: string | null
  clientX: number
  clientY: number
}

export const FLOW_PORT_HANDLE_FINALIZE_EVENT = 'kg-flow-port-handle-finalize'
export const FLOW_PORT_HANDLE_CANCEL_EVENT = 'kg-flow-port-handle-cancel'
export const FLOW_PORT_HANDLE_PREVIEW_EVENT = 'kg-flow-port-handle-preview'

export const FLOW_PORT_HANDLE_SELECTOR = 'button[data-kg-port-handle="1"]'
const PORT_HANDLE_DROP_RADIUS_PX = 36

export function readFlowPortHandleAtClientPoint(args: {
  clientX: number
  clientY: number
  dir?: 'in' | 'out'
}): HTMLButtonElement | null {
  const matches = (handle: HTMLButtonElement | null): handle is HTMLButtonElement => {
    if (!handle) return false
    if (args.dir && handle.dataset.kgPortDir !== args.dir) return false
    return true
  }
  const direct = document.elementFromPoint(args.clientX, args.clientY)?.closest<HTMLButtonElement>(FLOW_PORT_HANDLE_SELECTOR) || null
  if (matches(direct)) return direct
  const elementsFromPoint = document.elementsFromPoint
  if (typeof elementsFromPoint !== 'function') return null
  const stack = elementsFromPoint.call(document, args.clientX, args.clientY)
  for (const element of stack) {
    const handle = element.closest<HTMLButtonElement>(FLOW_PORT_HANDLE_SELECTOR)
    if (matches(handle)) return handle
  }
  return null
}

function scheduleAfterHandleStateCommit(callback: () => void): number {
  const requestFrame = document.defaultView?.requestAnimationFrame
  if (typeof requestFrame === 'function') return requestFrame.call(document.defaultView, callback)
  return setTimeout(callback, 0) as unknown as number
}

function cancelScheduledHandleCommit(id: number): void {
  const cancelFrame = document.defaultView?.cancelAnimationFrame
  if (typeof cancelFrame === 'function') {
    cancelFrame.call(document.defaultView, id)
    return
  }
  clearTimeout(id)
}

function readSemanticInputHandleAt(args: {
  clientX: number
  clientY: number
  sourceNodeId: string
}): HTMLButtonElement | null {
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  if (!sourceNodeId) return null
  const exact = readFlowPortHandleAtClientPoint({ clientX: args.clientX, clientY: args.clientY, dir: 'in' })
  if (exact?.dataset.kgPortDir === 'in' && exact.dataset.kgPortNodeId && exact.dataset.kgPortNodeId !== sourceNodeId) return exact

  let nearest: HTMLButtonElement | null = null
  let nearestDistance = PORT_HANDLE_DROP_RADIUS_PX
  const handles = Array.from(document.querySelectorAll<HTMLButtonElement>(FLOW_PORT_HANDLE_SELECTOR))
  for (const handle of handles) {
    if (handle.dataset.kgPortDir !== 'in') continue
    if (!handle.dataset.kgPortNodeId || handle.dataset.kgPortNodeId === sourceNodeId) continue
    const rect = handle.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distance = Math.hypot(centerX - args.clientX, centerY - args.clientY)
    if (distance > nearestDistance) continue
    nearestDistance = distance
    nearest = handle
  }
  return nearest
}

function finalizeSemanticInputHandleAt(args: {
  clientX: number
  clientY: number
  sourceNodeId: string
}): boolean {
  const target = readSemanticInputHandleAt(args)
  if (!target) return false
  const targetNodeId = String(target.dataset.kgPortNodeId || '').trim()
  if (!targetNodeId) return false
  const targetPortKey = String(target.dataset.kgPortKey || '').trim() || null
  const detail: FlowPortHandleFinalizeDetail = {
    sourceNodeId: args.sourceNodeId,
    targetNodeId,
    targetPortKey,
  }
  const EventCtor = document.defaultView?.CustomEvent || CustomEvent
  const event = new EventCtor(FLOW_PORT_HANDLE_FINALIZE_EVENT, {
    cancelable: true,
    detail,
  }) as CustomEvent<FlowPortHandleFinalizeDetail>
  document.dispatchEvent(event)
  if (!event.defaultPrevented && !target.disabled) target.click()
  return true
}

function dispatchFlowPortHandlePreview(detail: FlowPortHandlePreviewDetail): void {
  const EventCtor = document.defaultView?.CustomEvent || CustomEvent
  document.dispatchEvent(new EventCtor(FLOW_PORT_HANDLE_PREVIEW_EVENT, { detail }))
}

function dispatchFlowPortHandleCancel(detail: FlowPortHandleCancelDetail): void {
  const EventCtor = document.defaultView?.CustomEvent || CustomEvent
  document.dispatchEvent(new EventCtor(FLOW_PORT_HANDLE_CANCEL_EVENT, { detail }))
}

export function startFlowPortHandlePointerDrag(args: FlowPortHandlePointerDragArgs): void {
  if (typeof document === 'undefined' || args.event.button !== 0) return
  const pointerId = args.event.pointerId
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  const sourcePortKey = String(args.sourcePortKey || '').trim() || null
  if (!sourceNodeId) return
  args.event.preventDefault()
  dispatchFlowPortHandlePreview({ phase: 'start', sourceNodeId, sourcePortKey, clientX: args.event.clientX, clientY: args.event.clientY })

  let finishFrame = 0

  const cleanup = () => {
    document.removeEventListener('pointermove', move, true)
    document.removeEventListener('pointerup', finish, true)
    document.removeEventListener('pointercancel', cancel, true)
    if (finishFrame) cancelScheduledHandleCommit(finishFrame)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId === pointerId) dispatchFlowPortHandlePreview({ phase: 'move', sourceNodeId, sourcePortKey, clientX: event.clientX, clientY: event.clientY })
  }
  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    dispatchFlowPortHandlePreview({ phase: 'cancel', sourceNodeId, sourcePortKey, clientX: event.clientX, clientY: event.clientY })
    cleanup()
  }
  const finish = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    cleanup()
    const clientX = event.clientX
    const clientY = event.clientY
    dispatchFlowPortHandlePreview({ phase: 'move', sourceNodeId, sourcePortKey, clientX, clientY })
    finishFrame = scheduleAfterHandleStateCommit(() => {
      finishFrame = 0
      if (!finalizeSemanticInputHandleAt({ clientX, clientY, sourceNodeId })) {
        dispatchFlowPortHandlePreview({ phase: 'cancel', sourceNodeId, sourcePortKey, clientX, clientY })
        dispatchFlowPortHandleCancel({ sourceNodeId, sourcePortKey, clientX, clientY })
      }
    })
  }

  document.addEventListener('pointermove', move, true)
  document.addEventListener('pointerup', finish, true)
  document.addEventListener('pointercancel', cancel, true)
}

export function startFlowPortHandleMouseDrag(args: FlowPortHandleMouseDragArgs): void {
  if (typeof document === 'undefined' || args.event.button !== 0) return
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  const sourcePortKey = String(args.sourcePortKey || '').trim() || null
  if (!sourceNodeId) return
  args.event.preventDefault()
  dispatchFlowPortHandlePreview({ phase: 'start', sourceNodeId, sourcePortKey, clientX: args.event.clientX, clientY: args.event.clientY })

  const move = (event: MouseEvent) => {
    dispatchFlowPortHandlePreview({ phase: 'move', sourceNodeId, sourcePortKey, clientX: event.clientX, clientY: event.clientY })
  }
  const finish = (event: MouseEvent) => {
    document.removeEventListener('mousemove', move, true)
    document.removeEventListener('mouseup', finish, true)
    const clientX = event.clientX
    const clientY = event.clientY
    dispatchFlowPortHandlePreview({ phase: 'move', sourceNodeId, sourcePortKey, clientX, clientY })
    scheduleAfterHandleStateCommit(() => {
      if (!finalizeSemanticInputHandleAt({ clientX, clientY, sourceNodeId })) {
        dispatchFlowPortHandlePreview({ phase: 'cancel', sourceNodeId, sourcePortKey, clientX, clientY })
        dispatchFlowPortHandleCancel({ sourceNodeId, sourcePortKey, clientX, clientY })
      }
    })
  }

  document.addEventListener('mousemove', move, true)
  document.addEventListener('mouseup', finish, true)
}
