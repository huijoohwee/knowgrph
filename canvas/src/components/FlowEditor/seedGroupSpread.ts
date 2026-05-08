import {
  computeBalancedSpreadLayout,
} from '@/lib/ui/overlayBalancedSpread'

export type WidgetSeedBounds = { minX: number; minY: number; maxX: number; maxY: number }

export function placeWidgetsCenteredInGroupBounds(args: {
  ids: string[]
  bounds: WidgetSeedBounds
  cellW: number
  cellH: number
  gapWorld: number
  snapWorld: (value: number) => number
}): Array<{ id: string; x: number; y: number }> {
  const ids = Array.isArray(args.ids) ? args.ids : []
  if (ids.length === 0) return []

  const minX = Number.isFinite(args.bounds?.minX) ? args.bounds.minX : 0
  const minY = Number.isFinite(args.bounds?.minY) ? args.bounds.minY : 0
  const maxX = Number.isFinite(args.bounds?.maxX) ? args.bounds.maxX : minX
  const maxY = Number.isFinite(args.bounds?.maxY) ? args.bounds.maxY : minY

  const boundW = Math.max(1, maxX - minX)
  const boundH = Math.max(1, maxY - minY)
  const cellW = Number.isFinite(args.cellW) ? Math.max(1, args.cellW) : 1
  const cellH = Number.isFinite(args.cellH) ? Math.max(1, args.cellH) : 1
  const gapWorld = Number.isFinite(args.gapWorld) ? Math.max(0, args.gapWorld) : 0
  const layout = computeBalancedSpreadLayout({
    count: ids.length,
    viewportW: boundW,
    viewportH: boundH,
    cellW,
    cellH,
    gapPx: gapWorld,
    zoomK: 1,
    marginLeftPx: 0,
    marginRightPx: 0,
    marginTopPx: 0,
    marginBottomPx: 0,
  })

  const out: Array<{ id: string; x: number; y: number }> = []
  for (let i = 0; i < ids.length; i += 1) {
    const cell = layout.cells[i]
    if (!cell) break
    out.push({
      id: ids[i]!,
      x: args.snapWorld(minX + cell.left),
      y: args.snapWorld(minY + cell.top),
    })
  }
  return out
}
