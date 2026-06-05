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
  gridSizeY?: number
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

  const baseSizeX = Math.max(1, Math.floor(isFiniteNumber(args.gridSize) ? args.gridSize : 1))
  const baseSizeY = Math.max(1, Math.floor(isFiniteNumber(args.gridSizeY) ? args.gridSizeY : baseSizeX))
  const p = mergePaint(defaultInfiniteGridPaint(), args.paint)

  const majorEvery = Math.max(2, Math.floor(p.majorEvery || 5))

  const pickMinorWorldStep = (baseSize: number): number => {
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

  const pickLockedMinorWorldStep = (baseSize: number): number => {
    let step = baseSize
    const minPx = Math.max(2, p.minMinorStepPx)
    while (step * k < minPx && step < 1_000_000) {
      step *= majorEvery
    }
    return step
  }

  const minorStepX = args.lockToBaseStep === true ? pickLockedMinorWorldStep(baseSizeX) : pickMinorWorldStep(baseSizeX)
  const minorStepY = args.lockToBaseStep === true ? pickLockedMinorWorldStep(baseSizeY) : pickMinorWorldStep(baseSizeY)
  const majorStepX = minorStepX * majorEvery
  const majorStepY = minorStepY * majorEvery

  const minW = screenToWorld({ transform: { k, x, y }, sx: 0, sy: 0 })
  const maxW = screenToWorld({ transform: { k, x, y }, sx: viewportW, sy: viewportH })
  const minX = Math.min(minW.x, maxW.x)
  const maxX = Math.max(minW.x, maxW.x)
  const minY = Math.min(minW.y, maxW.y)
  const maxY = Math.max(minW.y, maxW.y)

  const minorWidthWorld = Math.max(0.1, (Math.max(0.5, p.minorWidthPx) / (dpr * k)))
  const majorWidthWorld = Math.max(0.1, (Math.max(0.5, p.majorWidthPx) / (dpr * k)))

  const shouldDrawMinorX = minorStepX * k >= Math.max(2, p.minMinorStepPx)
  const shouldDrawMinorY = minorStepY * k >= Math.max(2, p.minMinorStepPx)
  const shouldDrawMajorX = majorStepX * k >= Math.max(6, p.minMajorStepPx)
  const shouldDrawMajorY = majorStepY * k >= Math.max(6, p.minMajorStepPx)

  const dotRadiusWorld = Math.max(0.05, Math.max(0.5, p.dotRadiusPx) / (dpr * k))
  const anchor = args.anchor === 'cellCenter' ? 'cellCenter' : 'gridLine'

  const drawLines = (stepX: number, stepY: number, drawX: boolean, drawY: boolean, stroke: string, alpha: number, widthWorld: number) => {
    const offsetX = anchor === 'cellCenter' ? stepX * 0.5 : 0
    const offsetY = anchor === 'cellCenter' ? stepY * 0.5 : 0
    const startX = Math.floor((minX - offsetX) / stepX) * stepX + offsetX
    const endX = Math.ceil((maxX - offsetX) / stepX) * stepX + offsetX
    const startY = Math.floor((minY - offsetY) / stepY) * stepY + offsetY
    const endY = Math.ceil((maxY - offsetY) / stepY) * stepY + offsetY
    const maxLines = 2_500
    const countX = drawX ? Math.max(0, Math.floor((endX - startX) / stepX) + 1) : 0
    const countY = drawY ? Math.max(0, Math.floor((endY - startY) / stepY) + 1) : 0
    if (countX + countY > maxLines) return

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * Math.max(0, Math.min(1, alpha))))
    ctx.strokeStyle = stroke
    ctx.lineWidth = widthWorld
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'

    ctx.beginPath()
    if (drawX) {
      for (let gx = startX; gx <= endX + 1e-6; gx += stepX) {
        ctx.moveTo(gx, minY)
        ctx.lineTo(gx, maxY)
      }
    }
    if (drawY) {
      for (let gy = startY; gy <= endY + 1e-6; gy += stepY) {
        ctx.moveTo(minX, gy)
        ctx.lineTo(maxX, gy)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  const drawDots = (stepX: number, stepY: number, fill: string, alpha: number, rWorld: number) => {
    const offsetX = anchor === 'cellCenter' ? stepX * 0.5 : 0
    const offsetY = anchor === 'cellCenter' ? stepY * 0.5 : 0
    const startX = Math.floor((minX - offsetX) / stepX) * stepX + offsetX
    const endX = Math.ceil((maxX - offsetX) / stepX) * stepX + offsetX
    const startY = Math.floor((minY - offsetY) / stepY) * stepY + offsetY
    const endY = Math.ceil((maxY - offsetY) / stepY) * stepY + offsetY
    const maxDots = 18_000
    const countX = Math.max(0, Math.floor((endX - startX) / stepX) + 1)
    const countY = Math.max(0, Math.floor((endY - startY) / stepY) + 1)
    if (countX * countY > maxDots) return

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * Math.max(0, Math.min(1, alpha))))
    ctx.fillStyle = fill
    ctx.beginPath()
    for (let gy = startY; gy <= endY + 1e-6; gy += stepY) {
      for (let gx = startX; gx <= endX + 1e-6; gx += stepX) {
        ctx.moveTo(gx + rWorld, gy)
        ctx.arc(gx, gy, rWorld, 0, Math.PI * 2)
      }
    }
    ctx.fill()
    ctx.restore()
  }

  if (p.variant === 'dots') {
    if (shouldDrawMinorX && shouldDrawMinorY) drawDots(minorStepX, minorStepY, p.minorStroke, p.minorAlpha, dotRadiusWorld)
    if (shouldDrawMajorX && shouldDrawMajorY) drawDots(majorStepX, majorStepY, p.majorStroke, p.majorAlpha, Math.max(dotRadiusWorld, dotRadiusWorld * 1.35))
    return
  }

  if (shouldDrawMinorX || shouldDrawMinorY) drawLines(minorStepX, minorStepY, shouldDrawMinorX, shouldDrawMinorY, p.minorStroke, p.minorAlpha, minorWidthWorld)
  if (shouldDrawMajorX || shouldDrawMajorY) drawLines(majorStepX, majorStepY, shouldDrawMajorX, shouldDrawMajorY, p.majorStroke, p.majorAlpha, majorWidthWorld)
}

export const drawInfiniteGrid = (ctx: CanvasRenderingContext2D, args: {
  enabled: boolean
  gridSize: number
  gridSizeY?: number
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
    gridSizeY: args.gridSizeY,
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
