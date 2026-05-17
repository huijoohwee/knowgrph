import { useGraphStore } from '@/hooks/useGraphStore'

export const __flowCanvasDebug: {
  lastBuiltSceneNodeCount: number
  lastBuiltSceneKey: string
  lastZoomViewKey: string
  sceneNodeIds: string[]
  mediaNodeIds: string[]
  overlayNodeIds: string[]
  widgetWorldRectById: Record<string, { left: number; top: number; width: number; height: number }>
  richMediaRectById: Record<string, { left: number; top: number; width: number; height: number }>
  lastOverlayProxyPointerDown: string
  lastRichMediaResizeTrace: string
  lastRichMediaResizeTarget: string
  lastRecoveryReason: string
  lastRuntimeTransform: string
  lastExpectedFit: string
} = {
  lastBuiltSceneNodeCount: 0,
  lastBuiltSceneKey: '',
  lastZoomViewKey: '',
  sceneNodeIds: [],
  mediaNodeIds: [],
  overlayNodeIds: [],
  widgetWorldRectById: {},
  richMediaRectById: {},
  lastOverlayProxyPointerDown: '',
  lastRichMediaResizeTrace: '',
  lastRichMediaResizeTarget: '',
  lastRecoveryReason: '',
  lastRuntimeTransform: '',
  lastExpectedFit: '',
}

const FLOW_CANVAS_DEBUG_TOAST_ID = 'flow-canvas-runtime-debug-status'

let lastFlowCanvasDebugToastSig = ''

export function readFlowCanvasDebugStatusLine(): string {
  const reason = __flowCanvasDebug.lastRecoveryReason || '-'
  const transform = __flowCanvasDebug.lastRuntimeTransform || '-'
  const expected = __flowCanvasDebug.lastExpectedFit || '-'
  return `Flow status ${reason} | t ${transform} | e ${expected}`
}

export function readFlowCanvasDebugGeometrySnapshot(): string {
  const widgetParts = Object.entries(__flowCanvasDebug.widgetWorldRectById || {})
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([id, rect]) => `${id}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}`)
  const richMediaParts = Object.entries(__flowCanvasDebug.richMediaRectById || {})
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([id, rect]) => `${id}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}`)
  return `widgets[${widgetParts.join('|')}] media[${richMediaParts.join('|')}]`
}

export function syncFlowCanvasDebugWindow(): void {
  try {
    ;(window as unknown as { __flowCanvasDebug?: unknown }).__flowCanvasDebug = __flowCanvasDebug
  } catch {
    void 0
  }
}

export function resetFlowCanvasDebugStatus(args?: { dismissToast?: boolean }) {
  __flowCanvasDebug.lastRecoveryReason = ''
  __flowCanvasDebug.lastRuntimeTransform = ''
  __flowCanvasDebug.lastExpectedFit = ''
  syncFlowCanvasDebugWindow()
  lastFlowCanvasDebugToastSig = ''
  if (args?.dismissToast !== true) return
  try {
    useGraphStore.getState().dismissUiToast(FLOW_CANVAS_DEBUG_TOAST_ID)
  } catch {
    void 0
  }
}

export function syncFlowCanvasDebugToast(args: { enabled: boolean }) {
  if (args.enabled !== true) {
    resetFlowCanvasDebugStatus({ dismissToast: true })
    return
  }
  const message = readFlowCanvasDebugStatusLine()
  const sig = message
  if (!message || sig === lastFlowCanvasDebugToastSig) return
  lastFlowCanvasDebugToastSig = sig
  try {
    useGraphStore.getState().upsertUiToast({
      id: FLOW_CANVAS_DEBUG_TOAST_ID,
      kind: 'neutral',
      message,
      ttlMs: null,
      dismissible: true,
      log: false,
    })
  } catch {
    void 0
  }
}
