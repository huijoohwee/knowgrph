import type React from 'react'

type FlowPortHandlePointerDragArgs = {
  event: React.PointerEvent<HTMLButtonElement>
  sourceNodeId: string
}

type FlowPortHandleMouseDragArgs = {
  event: React.MouseEvent<HTMLButtonElement>
  sourceNodeId: string
}

const PORT_HANDLE_SELECTOR = 'button[data-kg-port-handle="1"]'
const PORT_HANDLE_DROP_RADIUS_PX = 36

function readSemanticInputHandleAt(args: {
  clientX: number
  clientY: number
  sourceNodeId: string
}): HTMLButtonElement | null {
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  if (!sourceNodeId) return null
  const exact = document.elementFromPoint(args.clientX, args.clientY)?.closest<HTMLButtonElement>(PORT_HANDLE_SELECTOR)
  if (exact?.dataset.kgPortDir === 'in' && exact.dataset.kgPortNodeId && exact.dataset.kgPortNodeId !== sourceNodeId) return exact

  let nearest: HTMLButtonElement | null = null
  let nearestDistance = PORT_HANDLE_DROP_RADIUS_PX
  const handles = Array.from(document.querySelectorAll<HTMLButtonElement>(PORT_HANDLE_SELECTOR))
  for (const handle of handles) {
    if (handle.dataset.kgPortDir !== 'in') continue
    if (!handle.dataset.kgPortNodeId || handle.dataset.kgPortNodeId === sourceNodeId) continue
    if (handle.disabled) continue
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

function clickSemanticInputHandleAt(args: {
  clientX: number
  clientY: number
  sourceNodeId: string
}): void {
  const target = readSemanticInputHandleAt(args)
  if (!target) return
  target.click()
}

export function startFlowPortHandlePointerDrag(args: FlowPortHandlePointerDragArgs): void {
  if (typeof document === 'undefined' || args.event.button !== 0) return
  const pointerId = args.event.pointerId
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  if (!sourceNodeId) return

  const cleanup = () => {
    document.removeEventListener('pointerup', finish, true)
    document.removeEventListener('pointercancel', cancel, true)
  }
  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    cleanup()
  }
  const finish = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    cleanup()
    clickSemanticInputHandleAt({ clientX: event.clientX, clientY: event.clientY, sourceNodeId })
  }

  document.addEventListener('pointerup', finish, true)
  document.addEventListener('pointercancel', cancel, true)
}

export function startFlowPortHandleMouseDrag(args: FlowPortHandleMouseDragArgs): void {
  if (typeof document === 'undefined' || args.event.button !== 0) return
  const sourceNodeId = String(args.sourceNodeId || '').trim()
  if (!sourceNodeId) return

  const cleanup = () => {
    document.removeEventListener('mouseup', finish, true)
  }
  const finish = (event: MouseEvent) => {
    cleanup()
    clickSemanticInputHandleAt({ clientX: event.clientX, clientY: event.clientY, sourceNodeId })
  }

  document.addEventListener('mouseup', finish, true)
}
