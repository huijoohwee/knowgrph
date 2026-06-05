import React from 'react'
import { InfiniteGridCanvasOverlay } from '@/components/InfiniteGridCanvasOverlay'
import type { CanvasGridRenderConfig } from '@/lib/canvas/canvasGridConfig'

export type CanvasGridOverlaySurfaceProps = {
  canvasGrid: CanvasGridRenderConfig | null | undefined
  width: number
  height: number
  dpr: number
  getTransform: () => unknown
  getEventTarget?: () => EventTarget | null
  themeSignal?: string
  surfaceId?: string
  className?: string
}

export function CanvasGridOverlaySurface(props: CanvasGridOverlaySurfaceProps) {
  const { canvasGrid } = props
  if (canvasGrid?.enabled !== true) return null
  const gridSizeX = canvasGrid.sizeX || canvasGrid.size || 10
  const gridSizeY = canvasGrid.sizeY || canvasGrid.sizeX || canvasGrid.size || 10

  return (
    <section
      className={props.className || 'absolute inset-0 z-0 overflow-hidden pointer-events-none'}
      data-kg-canvas-grid-overlay-surface={props.surfaceId || 'canvas'}
      data-kg-canvas-grid-anchor={canvasGrid.anchor}
      data-kg-canvas-grid-size-x={String(gridSizeX)}
      data-kg-canvas-grid-size-y={String(gridSizeY)}
      aria-hidden="true"
    >
      <InfiniteGridCanvasOverlay
        enabled
        gridSize={gridSizeX}
        gridSizeY={gridSizeY}
        anchor={canvasGrid.anchor}
        lockToBaseStep={canvasGrid.lockToBaseStep}
        variant={canvasGrid.variant}
        majorEvery={canvasGrid.majorEvery}
        dotRadiusPx={canvasGrid.dotRadiusPx}
        minorAlpha={canvasGrid.minorAlpha}
        majorAlpha={canvasGrid.majorAlpha}
        minorWidthPx={canvasGrid.minorWidthPx}
        majorWidthPx={canvasGrid.majorWidthPx}
        minorStroke={canvasGrid.minorStroke}
        majorStroke={canvasGrid.majorStroke}
        width={props.width}
        height={props.height}
        dpr={props.dpr}
        getTransform={props.getTransform}
        getEventTarget={props.getEventTarget}
        themeSignal={props.themeSignal}
      />
    </section>
  )
}
