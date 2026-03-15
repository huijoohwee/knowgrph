import React from 'react'
import { drawInfiniteGrid } from '@/lib/canvas/infiniteGrid'
import { resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'
import { readCanvasGridStrokeFallbacks } from '@/lib/canvas/canvasGridPaint'

type ZoomTransform = { k: number; x: number; y: number }

const readRootCssKey = (): string => {
  if (typeof document === 'undefined') return ''
  const root = document.documentElement
  const theme = root.getAttribute('data-theme') || ''
  const className = root.className || ''
  const style = root.getAttribute('style') || ''
  return `${theme}|${className}|${style}`
}

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
  variant?: 'lines' | 'dots'
  majorEvery?: number
  dotRadiusPx?: number
  width: number
  height: number
  dpr: number
  getTransform: () => unknown
  getEventTarget?: () => EventTarget | null
  className?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const lastDrawKeyRef = React.useRef<string>('')
  const rafRef = React.useRef<number | null>(null)

  const enabled = props.enabled
  const gridSize = props.gridSize
  const variant = props.variant || 'lines'
  const majorEvery = props.majorEvery
  const dotRadiusPx = props.dotRadiusPx
  const getTransform = props.getTransform

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
    const cssKey = readRootCssKey()
    const drawKey = `${viewportW}x${viewportH}@${dpr}|${t.k.toFixed(6)},${t.x.toFixed(2)},${t.y.toFixed(2)}|${gridSize}|${variant}|${majorEvery ?? ''}|${dotRadiusPx ?? ''}|${cssKey}`
    if (drawKey === lastDrawKeyRef.current) return
    lastDrawKeyRef.current = drawKey

    const fallbacks = readCanvasGridStrokeFallbacks()
    const minorStroke = resolveCssVarWithKgFallback('--kg-canvas-grid-minor') || fallbacks.minor
    const majorStroke = resolveCssVarWithKgFallback('--kg-canvas-grid-major') || fallbacks.major

    drawInfiniteGrid(ctx, {
      enabled: true,
      gridSize,
      viewportW,
      viewportH,
      dpr,
      transform: t,
      paint: {
        minorStroke,
        majorStroke,
        variant,
        majorEvery,
        dotRadiusPx,
      },
    })
  }, [dpr, dotRadiusPx, enabled, getTransform, gridSize, majorEvery, variant, viewportH, viewportW])

  const scheduleDraw = React.useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      drawOnce()
    })
  }, [drawOnce])

  React.useEffect(() => {
    scheduleDraw()
  }, [scheduleDraw, props.enabled, props.gridSize, viewportW, viewportH, dpr])

  React.useEffect(() => {
    if (!props.enabled) return
    const target = props.getEventTarget ? props.getEventTarget() : null
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
  }, [props.enabled, props.getEventTarget, scheduleDraw])

  if (!props.enabled) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden={true}
      className={props.className || 'absolute inset-0 z-0 pointer-events-none'}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
