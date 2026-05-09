import { useGraphStore } from '@/hooks/useGraphStore'

export const __flowCanvasDebug: {
  lastBuiltSceneNodeCount: number
  lastBuiltSceneKey: string
  lastZoomViewKey: string
  sceneNodeIds: string[]
  mediaNodeIds: string[]
  overlayNodeIds: string[]
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

export function syncFlowCanvasDebugToast(args: { enabled: boolean }) {
  if (args.enabled !== true) {
    lastFlowCanvasDebugToastSig = ''
    try {
      useGraphStore.getState().dismissUiToast(FLOW_CANVAS_DEBUG_TOAST_ID)
    } catch {
      void 0
    }
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
