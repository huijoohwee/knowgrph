import type { FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'

const FLOW_AUTO_MIN_SCALE = new WeakMap<FlowNativeRuntime, number>()

export function getFlowAutoMinScale(rt: FlowNativeRuntime): number | null {
  const v = FLOW_AUTO_MIN_SCALE.get(rt)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function setFlowAutoMinScale(rt: FlowNativeRuntime, minK: number | null): void {
  if (typeof minK !== 'number' || !Number.isFinite(minK)) {
    FLOW_AUTO_MIN_SCALE.delete(rt)
    return
  }
  FLOW_AUTO_MIN_SCALE.set(rt, minK)
}

