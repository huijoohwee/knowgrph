import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'
import { computeBalancedSpreadBaseGapPx, computeBalancedSpreadSpacingPx, computeBalancedSpreadViewportMargins } from '@/lib/ui/overlayBalancedSpread'
import { isFrontmatterCollectiveNode } from '@/lib/flowEditor/frontmatterCollectiveLayout'

export function isFrontmatterManagedOverlayNode(graphMetaKind: string | null | undefined, node: unknown): boolean {
  return String(graphMetaKind || '').trim() === 'frontmatter-flow' || isFrontmatterCollectiveNode(node)
}

export function resolveFrontmatterBalancedFallbackPos(args: {
  enabled: boolean
  openWidgetNodeCount: number
  stackIndex?: number
  viewportW: number
  viewportH: number
  scaled: { width: number; height: number }
  zoomK: number
}): { left: number; top: number } | null {
  if (!args.enabled) return null
  const count = Math.max(1, Math.floor(args.openWidgetNodeCount || 1))
  const idx = Math.max(0, Math.min(count - 1, Math.floor(Number(args.stackIndex) || 0)))
  const margins = computeBalancedSpreadViewportMargins({ viewportW: args.viewportW, viewportH: args.viewportH, preset: 'widgetFrontmatter', minLeftPx: 20, minRightPx: 20, minTopPx: 64, minBottomPx: 24 })
  const gapPx = computeBalancedSpreadSpacingPx({
    baseGapPx: computeBalancedSpreadBaseGapPx({ viewportW: args.viewportW, viewportH: args.viewportH, preset: 'widgetFrontmatter', margins }),
    zoomK: args.zoomK,
    count,
    preset: 'widgetFrontmatter',
  })
  const placed = placeWidgetsCenteredInGroupBounds({
    ids: Array.from({ length: count }, (_, index) => String(index)),
    bounds: { minX: 0, minY: 0, maxX: args.viewportW, maxY: args.viewportH },
    cellW: args.scaled.width + gapPx,
    cellH: args.scaled.height + gapPx,
    gapWorld: gapPx,
    snapWorld: value => value,
  })
  const cell = placed[Math.min(idx, placed.length - 1)] || null
  return cell ? { left: cell.x, top: cell.y } : null
}
