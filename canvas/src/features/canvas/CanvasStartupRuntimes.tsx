import React from 'react'
import { cancelIdle, scheduleIdle } from '@/features/panels/utils/idle'

type DeferredCanvasStartupRuntimesModule = {
  SourceFilesPersistenceBootstrap: React.ComponentType
  SsotEventBridge: React.ComponentType
}

export function CanvasStartupRuntimes() {
  const [runtimeModule, setRuntimeModule] = React.useState<DeferredCanvasStartupRuntimesModule | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const handle = scheduleIdle(() => {
      void Promise.all([
        import('@/features/source-files/SourceFilesPersistenceBootstrap'),
        import('@/features/ssot/SsotEventBridge'),
      ])
        .then(([sourceFilesModule, ssotModule]) => {
          if (cancelled) return
          setRuntimeModule({
            SourceFilesPersistenceBootstrap: sourceFilesModule.SourceFilesPersistenceBootstrap,
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

  const SourceFilesPersistenceBootstrap = runtimeModule.SourceFilesPersistenceBootstrap
  const SsotEventBridge = runtimeModule.SsotEventBridge

  return (
    <>
      <SourceFilesPersistenceBootstrap />
      <SsotEventBridge />
    </>
  )
}
