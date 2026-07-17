import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'

export type XrViewportControlsTarget = {
  enabled: boolean
}

export function xrViewportDragTerminationMatchesPointer(
  event: { readonly pointerId?: unknown },
  activePointerId: number | null,
): boolean {
  return typeof event.pointerId !== 'number' || event.pointerId === activePointerId
}

export function bindXrViewportControlsOwnership(args: {
  controls: XrViewportControlsTarget
  baseEnabled: boolean
}): () => void {
  const sync = () => {
    args.controls.enabled = args.baseEnabled && !readXrMotionReferenceRuntime().viewportControlActive
  }
  const unsubscribe = subscribeXrMotionReferenceRuntime(sync)
  sync()
  return unsubscribe
}
