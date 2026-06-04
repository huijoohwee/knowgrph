import type { CSSProperties } from 'react'

export const buildNonBlockingPortalLayerStyle = (zIndex: number): CSSProperties => ({
  position: 'fixed',
  inset: 0,
  zIndex,
  pointerEvents: 'none',
  isolation: 'isolate',
})

export const withInteractivePortalContentStyle = (style: CSSProperties): CSSProperties => ({
  ...style,
  pointerEvents: 'auto',
})
