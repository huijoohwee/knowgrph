import type React from 'react'

type FlowPortHandlePointerDragArgs = {
  event: React.PointerEvent<HTMLButtonElement>
  sourceNodeId: string
}

const PORT_HANDLE_SELECTOR = 'button[data-kg-port-handle="1"]'

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
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>(PORT_HANDLE_SELECTOR)
    if (!target || target.dataset.kgPortDir !== 'in') return
    if (!target.dataset.kgPortNodeId || target.dataset.kgPortNodeId === sourceNodeId) return
    target.click()
  }

  document.addEventListener('pointerup', finish, true)
  document.addEventListener('pointercancel', cancel, true)
}
