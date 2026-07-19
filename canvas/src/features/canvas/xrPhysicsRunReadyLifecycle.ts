import type {
  XrNativeControllerDemoMode,
  XrNativeControllerDemoSnapshot,
} from '@/features/three/xrNativeControllerDemoRuntime'

type RunReadyLifecycleSnapshot = Pick<XrNativeControllerDemoSnapshot, 'phase' | 'revision'>

export type XrPhysicsRunReadyLifecycleActions = Readonly<{
  developAndRun: () => unknown
  selectMode: (mode: XrNativeControllerDemoMode) => unknown
}>

export function ensureXrPhysicsRunReadyDemoRunning(
  runtime: RunReadyLifecycleSnapshot,
  actions: XrPhysicsRunReadyLifecycleActions,
): boolean {
  if (runtime.phase !== 'off' && runtime.phase !== 'ready') return false
  actions.selectMode('ball')
  actions.developAndRun()
  return true
}
