import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { stopMotionControl } from '@/features/three/motionControlRuntime'

function stopMotionControlAfterXrUnmount() {
  queueMicrotask(() => {
    const state = useGraphStore.getState()
    if (state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr') return
    void stopMotionControl('Motion Control stopped when XR Mode closed.')
  })
}

export function useXrStageMotionControlCleanup(): void {
  React.useEffect(() => stopMotionControlAfterXrUnmount, [])
}
