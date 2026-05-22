import { useGraphStore } from '@/hooks/useGraphStore'
import { dispatchRuntimeZoomAction } from '@/lib/canvas/runtimeZoomDispatch'

const isEditableTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

export function handleCanvasPointerModeHotkey(e: KeyboardEvent): boolean {
  const target = e.target
  if (isEditableTarget(target)) return false

  const lowerKey = e.key.toLowerCase()
  const plainKey = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey
  if (!plainKey || (lowerKey !== 'v' && lowerKey !== 'h')) return false

  try {
    const state = useGraphStore.getState()
    if (state.workspaceViewMode === 'canvas' && state.canvasRenderMode === '2d' && state.canvas2dRenderer === 'design') {
      e.preventDefault()
      state.setCanvasPointerMode2d(lowerKey === 'h' ? 'pan' : 'select')
      return true
    }
  } catch {
    return false
  }

  return false
}

export function handleCanvasZoomHotkey(e: KeyboardEvent): boolean {
  const target = e.target
  if (isEditableTarget(target)) return false

  const isCmd = e.metaKey || e.ctrlKey
  if (!isCmd) return false

  const k = e.key
  const isZoomIn = k === '+' || k === '='
  const isZoomOut = k === '-' || k === '_'
  const isReset = k === '0'
  if (!isZoomIn && !isZoomOut && !isReset) return false

  e.preventDefault()
  if (isReset) {
    void dispatchRuntimeZoomAction('reset')
    return true
  }

  const type = isZoomIn ? 'in' : 'out'
  void dispatchRuntimeZoomAction(type)
  return true
}
