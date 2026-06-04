import React from 'react'
import { drawInfiniteGrid } from '@/lib/canvas/infiniteGrid'
import { CANVAS_PASSIVE_OVERLAY_CLASS } from '@/lib/canvas/surface'
import { readRootCssStateKey, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { readCanvasGridStrokeFallbacks } from '@/lib/canvas/canvasGridPaint'

type ZoomTransform = { k: number; x: number; y: number }

const safeTransform = (t: unknown): ZoomTransform | null => {
  const any = t as { k?: unknown; x?: unknown; y?: unknown } | null
  const k = typeof any?.k === 'number' && Number.isFinite(any.k) ? any.k : null
  const x = typeof any?.x === 'number' && Number.isFinite(any.x) ? any.x : null
  const y = typeof any?.y === 'number' && Number.isFinite(any.y) ? any.y : null
  if (k == null || x == null || y == null) return null
  return { k: Math.max(0.001, k), x, y }
}

export function InfiniteGridCanvasOverlay(props: {
  enabled: boolean
  gridSize: number
  anchor?: 'gridLine' | 'cellCenter'
  lockToBaseStep?: boolean
  variant?: 'lines' | 'dots'
  majorEvery?: number
  dotRadiusPx?: number
  minorAlpha?: number
  majorAlpha?: number
  minorWidthPx?: number
  majorWidthPx?: number
  minorStroke?: string | null
  majorStroke?: string | null
  width: number
  height: number
  dpr: number
  getTransform: () => unknown
  getEventTarget?: () => EventTarget | null
  themeSignal?: string
  className?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const lastDrawKeyRef = React.useRef<string>('')
  const rafRef = React.useRef<number | null>(null)

  const enabled = props.enabled
  const gridSize = props.gridSize
  const anchor = props.anchor || 'cellCenter'
  const lockToBaseStep = props.lockToBaseStep === true
  const variant = props.variant || 'lines'
  const majorEvery = props.majorEvery
  const dotRadiusPx = props.dotRadiusPx
  const minorAlpha = props.minorAlpha
  const majorAlpha = props.majorAlpha
  const minorWidthPx = props.minorWidthPx
  const majorWidthPx = props.majorWidthPx
  const minorStrokeOverride = props.minorStroke
  const majorStrokeOverride = props.majorStroke
  const getTransform = props.getTransform
  const getEventTarget = props.getEventTarget

  const viewportW = Math.max(1, Math.floor(props.width || 1))
  const viewportH = Math.max(1, Math.floor(props.height || 1))
  const dpr = Math.max(1, Number.isFinite(props.dpr) ? props.dpr : 1)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nextW = Math.max(1, Math.floor(viewportW * dpr))
    const nextH = Math.max(1, Math.floor(viewportH * dpr))
    if (canvas.width !== nextW) canvas.width = nextW
    if (canvas.height !== nextH) canvas.height = nextH
  }, [viewportW, viewportH, dpr])

  const drawOnce = React.useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') || null
    if (!canvas || !ctx) return

    if (!enabled) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      lastDrawKeyRef.current = ''
      return
    }

    const t = safeTransform(getTransform())
    if (!t) return
    const cssKey = readRootCssStateKey()
    const drawKey = [
      `${viewportW}x${viewportH}@${dpr}`,
      `${t.k.toFixed(6)},${t.x.toFixed(2)},${t.y.toFixed(2)}`,
      gridSize,
      anchor,
      lockToBaseStep ? 1 : 0,
      variant,
      majorEvery ?? '',
      dotRadiusPx ?? '',
      minorAlpha ?? '',
      majorAlpha ?? '',
      minorWidthPx ?? '',
      majorWidthPx ?? '',
      minorStrokeOverride ?? '',
      majorStrokeOverride ?? '',
      cssKey,
    ].join('|')
    if (drawKey === lastDrawKeyRef.current) return
    lastDrawKeyRef.current = drawKey

    const fallbacks = readCanvasGridStrokeFallbacks()
    const minorStroke = (minorStrokeOverride && minorStrokeOverride.trim())
      ? minorStrokeOverride
      : (resolveCssVarWithKgFallback('--kg-canvas-grid-minor') || fallbacks.minor)
    const majorStroke = (majorStrokeOverride && majorStrokeOverride.trim())
      ? majorStrokeOverride
      : (resolveCssVarWithKgFallback('--kg-canvas-grid-major') || fallbacks.major)

    drawInfiniteGrid(ctx, {
      enabled: true,
      gridSize,
      anchor,
      lockToBaseStep,
      viewportW,
      viewportH,
      dpr,
      transform: t,
      paint: {
        minorStroke,
        majorStroke,
        minorAlpha,
        majorAlpha,
        minorWidthPx,
        majorWidthPx,
        variant,
        majorEvery,
        dotRadiusPx,
      },
    })
  }, [anchor, dpr, dotRadiusPx, enabled, getTransform, gridSize, lockToBaseStep, majorAlpha, majorEvery, majorStrokeOverride, majorWidthPx, minorAlpha, minorStrokeOverride, minorWidthPx, variant, viewportH, viewportW])

  const scheduleDraw = React.useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      drawOnce()
    })
  }, [drawOnce])

  React.useEffect(() => {
    scheduleDraw()
  }, [scheduleDraw, props.enabled, props.gridSize, props.themeSignal, viewportW, viewportH, dpr])

  React.useEffect(() => {
    if (!enabled) return
    const target = getEventTarget ? getEventTarget() : null
    if (!target || typeof (target as any).addEventListener !== 'function') return

    const handler = () => scheduleDraw()
    ;(target as any).addEventListener('wheel', handler, { passive: true })
    ;(target as any).addEventListener('pointerdown', handler, { passive: true })
    ;(target as any).addEventListener('pointermove', handler, { passive: true })
    ;(target as any).addEventListener('pointerup', handler, { passive: true })
    ;(target as any).addEventListener('touchstart', handler, { passive: true })
    ;(target as any).addEventListener('touchmove', handler, { passive: true })
    ;(target as any).addEventListener('touchend', handler, { passive: true })
    return () => {
      try { (target as any).removeEventListener('wheel', handler) } catch { void 0 }
      try { (target as any).removeEventListener('pointerdown', handler) } catch { void 0 }
      try { (target as any).removeEventListener('pointermove', handler) } catch { void 0 }
      try { (target as any).removeEventListener('pointerup', handler) } catch { void 0 }
      try { (target as any).removeEventListener('touchstart', handler) } catch { void 0 }
      try { (target as any).removeEventListener('touchmove', handler) } catch { void 0 }
      try { (target as any).removeEventListener('touchend', handler) } catch { void 0 }
    }
  }, [enabled, getEventTarget, scheduleDraw])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden={true}
      className={props.className || CANVAS_PASSIVE_OVERLAY_CLASS}
    />
  )
}
