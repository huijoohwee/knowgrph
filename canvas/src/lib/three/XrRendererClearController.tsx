import React from 'react'
import { useThree } from '@react-three/fiber'
import {
  readXrImmersiveSessionMode,
  resolveXrRendererClearAlpha,
  subscribeXrArPlacementRuntime,
} from '@/features/three/xrArPlacementRuntime'

export function XrRendererClearController({
  color,
  defaultAlpha,
  xrSurface,
}: {
  color: string
  defaultAlpha: number
  xrSurface: boolean
}) {
  const { gl } = useThree()
  const immersiveSessionMode = React.useSyncExternalStore(
    subscribeXrArPlacementRuntime,
    readXrImmersiveSessionMode,
    readXrImmersiveSessionMode,
  )
  const clearAlpha = resolveXrRendererClearAlpha(
    defaultAlpha,
    xrSurface ? immersiveSessionMode : 'none',
  )
  React.useEffect(() => {
    try {
      gl.setClearColor(color, clearAlpha)
    } catch {
      void 0
    }
  }, [clearAlpha, color, gl])
  return null
}
