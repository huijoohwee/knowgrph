export type MonacoRuntimeMode = 'monaco' | 'fallback' | 'deferred-touch'

export function resolveMonacoRuntimeMode(args: {
  monacoPlatformSupported: boolean
  isJsdom: boolean
  deferMonacoOnTouchViewport: boolean
  touchViewportActive: boolean
  touchViewportIntentActivated: boolean
}): MonacoRuntimeMode {
  if (!args.monacoPlatformSupported || args.isJsdom) return 'fallback'
  if (args.deferMonacoOnTouchViewport && args.touchViewportActive && !args.touchViewportIntentActivated) {
    return 'deferred-touch'
  }
  return 'monaco'
}
