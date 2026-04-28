import React from 'react'
import { cancelIdle, scheduleIdle } from '@/features/panels/utils/idle'
import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'

type DeferredCanvasStartupRuntimesModule = {
  SsotEventBridge: React.ComponentType
}

export function CanvasStartupRuntimes() {
  const [runtimeModule, setRuntimeModule] = React.useState<DeferredCanvasStartupRuntimesModule | null>(null)
  React.useEffect(() => {
    __canvasStartupDebug.runtimeMounted = true
    return () => {
      __canvasStartupDebug.runtimeMounted = false
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const handle = scheduleIdle(() => {
      void Promise.all([
        import('@/features/ssot/SsotEventBridge'),
      ])
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

  return (
    <>
      <SourceFilesPersistenceBootstrap />
      <SsotEventBridge />
    </>
  )
}
