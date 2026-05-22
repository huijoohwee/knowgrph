import React from 'react'
import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'

export function CanvasStartupDebugRuntime() {
  React.useEffect(() => {
    __canvasStartupDebug.runtimeMounted = true
    return () => {
      __canvasStartupDebug.runtimeMounted = false
    }
  }, [])

  return null
}
