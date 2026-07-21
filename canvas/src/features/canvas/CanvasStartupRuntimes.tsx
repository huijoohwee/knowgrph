import React from 'react'
import { CanvasStartupDebugRuntime } from '@/features/canvas/CanvasStartupDebugRuntime'
import { CanvasStartupSsotBridgeRuntime } from '@/features/canvas/CanvasStartupSsotBridgeRuntime'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import { XrPhysicsRunReadyDemoRuntime } from '@/features/canvas/XrPhysicsRunReadyDemoRuntime'

export function CanvasStartupRuntimes() {
  return (
    <>
      <CanvasStartupDebugRuntime />
      <SourceFilesPersistenceBootstrap />
      <CanvasStartupSsotBridgeRuntime />
      <XrPhysicsRunReadyDemoRuntime />
    </>
  )
}
