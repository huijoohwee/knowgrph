import React from 'react'
import { cancelIdle, scheduleIdle } from '@/features/panels/utils/idle'

type DeferredCanvasStartupRuntimesModule = {
  SsotEventBridge: React.ComponentType
}

export function CanvasStartupSsotBridgeRuntime() {
  const [runtimeModule, setRuntimeModule] = React.useState<DeferredCanvasStartupRuntimesModule | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const handle = scheduleIdle(() => {
      void Promise.all([import('@/features/ssot/SsotEventBridge')])
        .then(([ssotModule]) => {
          if (cancelled) return
          setRuntimeModule({
            SsotEventBridge: ssotModule.SsotEventBridge,
          })
        })
        .catch(() => {
          if (cancelled) return
        })
    })

    return () => {
      cancelled = true
      try {
        cancelIdle(handle)
      } catch {
        void 0
      }
    }
  }, [])

  if (!runtimeModule) return null

  const SsotEventBridge = runtimeModule.SsotEventBridge
  return <SsotEventBridge />
}
