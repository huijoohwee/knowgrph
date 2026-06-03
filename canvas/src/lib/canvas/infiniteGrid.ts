import { screenToWorld, type ViewportTransform } from '@/lib/zoom/viewport'

export type InfiniteGridPaint = {
  minorStroke: string
  majorStroke: string
  minorAlpha: number
  majorAlpha: number
  minorWidthPx: number
  majorWidthPx: number
  majorEvery: number
  minMinorStepPx: number
  minMajorStepPx: number
  variant: 'lines' | 'dots'
  dotRadiusPx: number
}

export const defaultInfiniteGridPaint = (): InfiniteGridPaint => {
  return {
    minorStroke: 'var(--kg-canvas-grid-minor)',
    majorStroke: 'var(--kg-canvas-grid-major)',
    minorAlpha: 0.16,
    majorAlpha: 0.34,
    minorWidthPx: 1,
    majorWidthPx: 1.25,
    majorEvery: 5,
    minMinorStepPx: 8,
    minMajorStepPx: 32,
    variant: 'lines',
    dotRadiusPx: 1.25,
  }
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const mergePaint = (base: InfiniteGridPaint, patch: Partial<InfiniteGridPaint> | null | undefined): InfiniteGridPaint => {
  if (!patch) return base
  const next: InfiniteGridPaint = { ...base }
  const entries = Object.entries(patch) as [keyof InfiniteGridPaint, unknown][]
  for (const [k, v] of entries) {
    if (v === undefined) continue
    ;(next as any)[k] = v
  }
  return next
}

export const drawInfiniteGridInWorldContext = (ctx: CanvasRenderingContext2D, args: {
  enabled: boolean
  gridSize: number
  viewportW: number
  viewportH: number
  dpr: number
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'>
  paint?: Partial<InfiniteGridPaint>
  anchor?: 'gridLine' | 'cellCenter'
  lockToBaseStep?: boolean
}) => {
  if (!args.enabled) return
  const viewportW = Math.max(1, Math.floor(isFiniteNumber(args.viewportW) ? args.viewportW : 1))
  const viewportH = Math.max(1, Math.floor(isFiniteNumber(args.viewportH) ? args.viewportH : 1))
  const dpr = Math.max(1, isFiniteNumber(args.dpr) ? args.dpr : 1)
  const k = Math.max(0.001, isFiniteNumber(args.transform?.k) ? args.transform.k : 1)
  const x = isFiniteNumber(args.transform?.x) ? args.transform.x : 0
  const y = isFiniteNumber(args.transform?.y) ? args.transform.y : 0

  const baseSize = Math.max(1, Math.floor(isFiniteNumber(args.gridSize) ? args.gridSize : 1))
  const p = mergePaint(defaultInfiniteGridPaint(), args.paint)

  const majorEvery = Math.max(2, Math.floor(p.majorEvery || 5))

  const pickMinorWorldStep = (): number => {
    let step = baseSize
    const minPx = Math.max(2, p.minMinorStepPx)
    if (step * k >= minPx) return step
    const multipliers = [2, 5, 10]
    let i = 0
    while (step * k < minPx && step < 1_000_000) {
      step *= multipliers[i % multipliers.length]
      i += 1
    }
    return step
  }

  const pickLockedMinorWorldStep = (): number => {
    let step = baseSize
    const minPx = Math.max(2, p.minMinorStepPx)
    while (step * k < minPx && step < 1_000_000) {
      step *= majorEvery
    }
    return step
  }

  const minorStep = args.lockToBaseStep === true ? pickLockedMinorWorldStep() : pickMinorWorldStep()
  const majorStep = minorStep * majorEvery

  const minW = screenToWorld({ transform: { k, x, y }, sx: 0, sy: 0 })
  const maxW = screenToWorld({ transform: { k, x, y }, sx: viewportW, sy: viewportH })
  const minX = Math.min(minW.x, maxW.x)
  const maxX = Math.max(minW.x, maxW.x)
  const minY = Math.min(minW.y, maxW.y)
  const maxY = Math.max(minW.y, maxW.y)

  const minorWidthWorld = Math.max(0.1, (Math.max(0.5, p.minorWidthPx) / (dpr * k)))
  const majorWidthWorld = Math.max(0.1, (Math.max(0.5, p.majorWidthPx) / (dpr * k)))

  const shouldDrawMinor = minorStep * k >= Math.max(2, p.minMinorStepPx)
  const shouldDrawMajor = majorStep * k >= Math.max(6, p.minMajorStepPx)

  const dotRadiusWorld = Math.max(0.05, Math.max(0.5, p.dotRadiusPx) / (dpr * k))
  const anchor = args.anchor === 'cellCenter' ? 'cellCenter' : 'gridLine'

  const drawLines = (step: number, stroke: string, alpha: number, widthWorld: number) => {
    const startX = Math.floor(minX / step) * step
    const endX = Math.ceil(maxX / step) * step
    const startY = Math.floor(minY / step) * step
    const endY = Math.ceil(maxY / step) * step
    const maxLines = 2_500
    const countX = Math.max(0, Math.floor((endX - startX) / step) + 1)
    const countY = Math.max(0, Math.floor((endY - startY) / step) + 1)
    if (countX + countY > maxLines) return

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * Math.max(0, Math.min(1, alpha))))
    ctx.strokeStyle = stroke
    ctx.lineWidth = widthWorld
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'

    ctx.beginPath()
    for (let gx = startX; gx <= endX + 1e-6; gx += step) {
      ctx.moveTo(gx, minY)
      ctx.lineTo(gx, maxY)
    }
    for (let gy = startY; gy <= endY + 1e-6; gy += step) {
      ctx.moveTo(minX, gy)
      ctx.lineTo(maxX, gy)
    }
    ctx.stroke()
    ctx.restore()
  }

  const drawDots = (step: number, fill: string, alpha: number, rWorld: number) => {
    const offset = anchor === 'cellCenter' ? step * 0.5 : 0
    const startX = Math.floor((minX - offset) / step) * step + offset
    const endX = Math.ceil((maxX - offset) / step) * step + offset
    const startY = Math.floor((minY - offset) / step) * step + offset
    const endY = Math.ceil((maxY - offset) / step) * step + offset
    const maxDots = 18_000
    const countX = Math.max(0, Math.floor((endX - startX) / step) + 1)
    const countY = Math.max(0, Math.floor((endY - startY) / step) + 1)
    if (countX * countY > maxDots) return

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * Math.max(0, Math.min(1, alpha))))
    ctx.fillStyle = fill
    ctx.beginPath()
    for (let gy = startY; gy <= endY + 1e-6; gy += step) {
      for (let gx = startX; gx <= endX + 1e-6; gx += step) {
        ctx.moveTo(gx + rWorld, gy)
        ctx.arc(gx, gy, rWorld, 0, Math.PI * 2)
      }
    }
    ctx.fill()
    ctx.restore()
  }

  if (p.variant === 'dots') {
    if (shouldDrawMinor) drawDots(minorStep, p.minorStroke, p.minorAlpha, dotRadiusWorld)
    if (shouldDrawMajor) drawDots(majorStep, p.majorStroke, p.majorAlpha, Math.max(dotRadiusWorld, dotRadiusWorld * 1.35))
    return
  }

  if (shouldDrawMinor) drawLines(minorStep, p.minorStroke, p.minorAlpha, minorWidthWorld)
  if (shouldDrawMajor) drawLines(majorStep, p.majorStroke, p.majorAlpha, majorWidthWorld)
}

export const drawInfiniteGrid = (ctx: CanvasRenderingContext2D, args: {
  enabled: boolean
  gridSize: number
  viewportW: number
  viewportH: number
  dpr: number
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'>
  paint?: Partial<InfiniteGridPaint>
  anchor?: 'gridLine' | 'cellCenter'
  lockToBaseStep?: boolean
}) => {
  if (!args.enabled) return
  const viewportW = Math.max(1, Math.floor(isFiniteNumber(args.viewportW) ? args.viewportW : 1))
  const viewportH = Math.max(1, Math.floor(isFiniteNumber(args.viewportH) ? args.viewportH : 1))
  const dpr = Math.max(1, isFiniteNumber(args.dpr) ? args.dpr : 1)
  const k = Math.max(0.001, isFiniteNumber(args.transform?.k) ? args.transform.k : 1)
  const x = isFiniteNumber(args.transform?.x) ? args.transform.x : 0
  const y = isFiniteNumber(args.transform?.y) ? args.transform.y : 0

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, Math.max(1, Math.floor(viewportW * dpr)), Math.max(1, Math.floor(viewportH * dpr)))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.translate(x, y)
  ctx.scale(k, k)
  drawInfiniteGridInWorldContext(ctx, {
    enabled: true,
    gridSize: args.gridSize,
    viewportW,
    viewportH,
    dpr,
    transform: { k, x, y },
    paint: args.paint,
    anchor: args.anchor,
    lockToBaseStep: args.lockToBaseStep,
  })
  ctx.restore()
}
