
import type { GraphNode } from '@/lib/graph/types'
import { applyAabbOverlapPush } from '@/lib/graph/collision/aabbPush'
import { SpatialIndex } from './spatialIndex'
import type { BoxItem } from './types'

export interface BoxIndices {
  x1: number
  x2: number
  x3: number
  x4: number
  x5: number

  y1: number
  y2: number
  y3: number
  y4: number
  y5: number
}

export interface CollisionGroupItem extends BoxItem {
  movableIdxs: number[]
  gap: number
  gapX?: number
  gapY?: number
}

interface ExpandedBoxItem extends BoxItem {
  original: CollisionGroupItem
}

export function computeBoxIndices(cx: number, cy: number, halfW: number, halfH: number, gap: number): BoxIndices {
  return {
    x1: cx - halfW - gap,
    x2: cx - halfW,
    x3: cx,
    x4: cx + halfW,
    x5: cx + halfW + gap,

    y1: cy - halfH - gap,
    y2: cy - halfH,
    y3: cy,
    y4: cy + halfH,
    y5: cy + halfH + gap,
  }
}

export function resolveGroupCollisions(args: {
  groups: CollisionGroupItem[]
  nodes: GraphNode[]
  strength: number
  touchEpsilon: number
  skipSameGroup?: boolean
  groupsShareAnyMember?: (a: CollisionGroupItem, b: CollisionGroupItem) => boolean
}) {
  const { groups, nodes, strength, touchEpsilon, groupsShareAnyMember } = args
  if (groups.length < 2) return

  const indexByItem = new Map<CollisionGroupItem, number>()
  for (let i = 0; i < groups.length; i += 1) indexByItem.set(groups[i]!, i)

  const expandedItems: ExpandedBoxItem[] = groups.map(g => {
    const gapX = typeof g.gapX === 'number' && Number.isFinite(g.gapX) ? Math.max(0, g.gapX) : Math.max(0, g.gap)
    const gapY = typeof g.gapY === 'number' && Number.isFinite(g.gapY) ? Math.max(0, g.gapY) : Math.max(0, g.gap)
    return {
      cx: g.cx,
      cy: g.cy,
      halfW: g.halfW + gapX,
      halfH: g.halfH + gapY,
      id: g.id,
      original: g
    }
  })

  const spatialIndex = new SpatialIndex(expandedItems)

  for (let i = 0; i < groups.length; i++) {
    const a = groups[i]
    const aIdx = i
    
    const aGapX = typeof a.gapX === 'number' && Number.isFinite(a.gapX) ? Math.max(0, a.gapX) : Math.max(0, a.gap)
    const aGapY = typeof a.gapY === 'number' && Number.isFinite(a.gapY) ? Math.max(0, a.gapY) : Math.max(0, a.gap)

    const aMinX = a.cx - a.halfW - aGapX
    const aMaxX = a.cx + a.halfW + aGapX
    const aMinY = a.cy - a.halfH - aGapY
    const aMaxY = a.cy + a.halfH + aGapY

    spatialIndex.query(aMinX, aMinY, aMaxX, aMaxY, (bWrapper) => {
      const b = bWrapper.original
      if (a === b) return
      const bIdx = indexByItem.get(b)
      if (bIdx == null || bIdx <= aIdx) return
      
      const aMovable = a.movableIdxs.length > 0
      const bMovable = b.movableIdxs.length > 0
      if (!aMovable && !bMovable) return

      if (groupsShareAnyMember && groupsShareAnyMember(a, b)) return

      const bGapX = typeof b.gapX === 'number' && Number.isFinite(b.gapX) ? Math.max(0, b.gapX) : Math.max(0, b.gap)
      const bGapY = typeof b.gapY === 'number' && Number.isFinite(b.gapY) ? Math.max(0, b.gapY) : Math.max(0, b.gap)
      
      const requiredGapX = Math.max(aGapX, bGapX)
      const requiredGapY = Math.max(aGapY, bGapY)
      
      const dx = a.cx - b.cx
      const dy = a.cy - b.cy
      const ox = a.halfW + b.halfW + requiredGapX - Math.abs(dx)
      const oy = a.halfH + b.halfH + requiredGapY - Math.abs(dy)
      const oxAdj = ox + touchEpsilon
      const oyAdj = oy + touchEpsilon

      if (oxAdj > 0 && oyAdj > 0) {
        applyAabbOverlapPush({
          nodes,
          aMovableIdxs: a.movableIdxs,
          bMovableIdxs: b.movableIdxs,
          dx,
          dy,
          ox: oxAdj,
          oy: oyAdj,
          k: strength,
        })
      }
    })
  }
}
