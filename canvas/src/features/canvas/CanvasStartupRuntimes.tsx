import React from 'react'
import { CanvasStartupDebugRuntime } from '@/features/canvas/CanvasStartupDebugRuntime'
import { CanvasStartupSsotBridgeRuntime } from '@/features/canvas/CanvasStartupSsotBridgeRuntime'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import { useSourceFilesBootstrapReady } from '@/features/source-files/sourceFilesBootstrapReadiness'
import { XrPhysicsRunReadyDemoRuntime } from '@/features/canvas/XrPhysicsRunReadyDemoRuntime'

export function CanvasStartupRuntimes() {
  const sourceFilesBootstrapReady = useSourceFilesBootstrapReady()
  return (
    <>
      <CanvasStartupDebugRuntime />
      <SourceFilesPersistenceBootstrap />
      <CanvasStartupSsotBridgeRuntime />
      {sourceFilesBootstrapReady ? <XrPhysicsRunReadyDemoRuntime /> : null}
    </>
  )
}
