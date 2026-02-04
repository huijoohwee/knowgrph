
import { PackedRTree } from './PackedRTree.js'
import { applyAabbOverlapPush } from './aabbPush.js'
export { PackedRTree, applyAabbOverlapPush }
import type { BoxItem, MovableNode } from './types.js'

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
  
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export interface CollisionGroupItem extends BoxItem {
  movableIdxs: number[]
  gap: number
  gapX?: number
  gapY?: number
  gapZ?: number
}

interface ExpandedBoxItem extends BoxItem {
  original: CollisionGroupItem
}

export function computeBoxIndices(
  cx: number, cy: number, cz: number,
  halfW: number, halfH: number, halfD: number,
  gap: number,
  gapX?: number,
  gapY?: number,
  gapZ?: number
): BoxIndices {
  const gX = typeof gapX === 'number' && Number.isFinite(gapX) ? Math.max(0, gapX) : Math.max(0, gap)
  const gY = typeof gapY === 'number' && Number.isFinite(gapY) ? Math.max(0, gapY) : Math.max(0, gap)
  const gZ = typeof gapZ === 'number' && Number.isFinite(gapZ) ? Math.max(0, gapZ) : Math.max(0, gap)
  return {
    x1: cx - halfW - gX,
    x2: cx - halfW,
    x3: cx,
    x4: cx + halfW,
    x5: cx + halfW + gX,

    y1: cy - halfH - gY,
    y2: cy - halfH,
    y3: cy,
    y4: cy + halfH,
    y5: cy + halfH + gY,
    
    z1: cz - halfD - gZ,
    z2: cz - halfD,
    z3: cz,
    z4: cz + halfD,
    z5: cz + halfD + gZ,
  }
}

export function resolveGroupCollisions(args: {
  groups: CollisionGroupItem[]
  nodes: MovableNode[]
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
    const gapZ = typeof g.gapZ === 'number' && Number.isFinite(g.gapZ) ? Math.max(0, g.gapZ) : Math.max(0, g.gap)
    
    return {
      cx: g.cx,
      cy: g.cy,
      cz: g.cz,
      halfW: g.halfW + gapX,
      halfH: g.halfH + gapY,
      halfD: (g.halfD ?? 0) + gapZ,
      id: g.id,
      original: g
    }
  })

  // Use our new PackedRTree (3D aware)
  const spatialIndex = new PackedRTree(expandedItems)

  for (let i = 0; i < groups.length; i++) {
    const a = groups[i]
    const aIdx = i
    
    const aGapX = typeof a.gapX === 'number' && Number.isFinite(a.gapX) ? Math.max(0, a.gapX) : Math.max(0, a.gap)
    const aGapY = typeof a.gapY === 'number' && Number.isFinite(a.gapY) ? Math.max(0, a.gapY) : Math.max(0, a.gap)
    const aGapZ = typeof a.gapZ === 'number' && Number.isFinite(a.gapZ) ? Math.max(0, a.gapZ) : Math.max(0, a.gap)

    const aMinX = a.cx - a.halfW - aGapX
    const aMaxX = a.cx + a.halfW + aGapX
    const aMinY = a.cy - a.halfH - aGapY
    const aMaxY = a.cy + a.halfH + aGapY
    const aMinZ = (a.cz ?? 0) - (a.halfD ?? 0) - aGapZ
    const aMaxZ = (a.cz ?? 0) + (a.halfD ?? 0) + aGapZ

    spatialIndex.query(aMinX, aMinY, aMinZ, aMaxX, aMaxY, aMaxZ, (bWrapper) => {
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
      const bGapZ = typeof b.gapZ === 'number' && Number.isFinite(b.gapZ) ? Math.max(0, b.gapZ) : Math.max(0, b.gap)
      
      const requiredGapX = aGapX + bGapX
      const requiredGapY = aGapY + bGapY
      const requiredGapZ = aGapZ + bGapZ
      
      const dx = a.cx - b.cx
      const dy = a.cy - b.cy
      const dz = (a.cz ?? 0) - (b.cz ?? 0)
      
      const ox = a.halfW + b.halfW + requiredGapX - Math.abs(dx)
      const oy = a.halfH + b.halfH + requiredGapY - Math.abs(dy)
      const oz = (a.halfD ?? 0) + (b.halfD ?? 0) + requiredGapZ - Math.abs(dz)
      
      const oxAdj = ox + touchEpsilon
      const oyAdj = oy + touchEpsilon
      const ozAdj = oz + touchEpsilon

      // For 2D-only objects (halfD=0, cz=0), oz might be just requiredGapZ?
      // If halfD is 0, we effectively have infinite depth? Or 0 depth?
      // If we assume 2D objects have 0 depth but live on same Z plane, then collision happens if Z matches.
      // But if we want strictly 2D behavior when Z is not used, we should pass Infinity for oz.
      
      const useZ = (a.halfD !== undefined && a.halfD > 0) || (b.halfD !== undefined && b.halfD > 0) || (a.cz !== undefined && a.cz !== 0) || (b.cz !== undefined && b.cz !== 0)
      
      if (oxAdj > 0 && oyAdj > 0 && (!useZ || ozAdj > 0)) {
        applyAabbOverlapPush({
          nodes,
          aMovableIdxs: a.movableIdxs,
          bMovableIdxs: b.movableIdxs,
          dx,
          dy,
          dz,
          ox: oxAdj,
          oy: oyAdj,
          oz: useZ ? ozAdj : Infinity, // If not using Z, treat as infinite overlap (always collides on Z)
          k: strength,
        })
      }
    })
  }
}
