import * as d3 from 'd3'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { buildClosedPathD, computeConvexRing, type Point2d } from '@/lib/geometry/convexRing'
import { buildChevronPathD } from '@/components/GraphCanvas/layers/svgChevron'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'

export type GroupLayoutCacheEntry = {
  x: number
  y: number
  w: number
  h: number
  labelX: number
  labelY: number
  chevronCx: number
  chevronCy: number
  d: string | null
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const readExplicitBounds = (g: GraphGroup): GraphGroup['bounds'] | null => {
  const explicit = (g as unknown as { bounds?: unknown }).bounds
  if (!explicit || typeof explicit !== 'object' || Array.isArray(explicit)) return null
  const x = typeof (explicit as any).x === 'number' ? (explicit as any).x : Number.NaN
  const y = typeof (explicit as any).y === 'number' ? (explicit as any).y : Number.NaN
  const width = typeof (explicit as any).width === 'number' ? (explicit as any).width : Number.NaN
  const height = typeof (explicit as any).height === 'number' ? (explicit as any).height : Number.NaN
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const labelX = typeof (explicit as any).labelX === 'number' && Number.isFinite((explicit as any).labelX) ? (explicit as any).labelX : undefined
  const labelY = typeof (explicit as any).labelY === 'number' && Number.isFinite((explicit as any).labelY) ? (explicit as any).labelY : undefined
  return { x, y, width, height, ...(labelX != null ? { labelX } : {}), ...(labelY != null ? { labelY } : {}) }
}

export const createGroupsLayoutEngine = <T extends GraphGroup>(args: {
  shape: 'rect' | 'geo'
  schema: GraphSchema
  nodeById: Map<string, GraphNode>
  nodeHalfExtentsById: Map<string, { halfW: number; halfH: number }>
  padding: number
  nestedPaddingStep: number
  maxDepth: number
  labelPadding: number
  chevronSizePx: number
  chevronGapPx: number
  collapsedSet: Set<string>
  allowResize: boolean
  getGroupLabelText: (d: T) => { fontSize: number; labelWidthPx: number }
  rectSel: d3.Selection<SVGRectElement, T, SVGGElement, unknown>
  geoSel: d3.Selection<SVGPathElement, T, SVGGElement, unknown>
  labelSel: d3.Selection<SVGTextElement, T, SVGGElement, unknown>
  chevronSel: d3.Selection<SVGPathElement, T, SVGGElement, unknown>
  resizeHandleGroupSel: d3.Selection<SVGGElement, T, SVGGElement, unknown> | null
  hitRectSel?: d3.Selection<SVGRectElement, T, SVGGElement, unknown> | null
  hitGeoSel?: d3.Selection<SVGPathElement, T, SVGGElement, unknown> | null
}) => {
  const layoutCache = new Map<string, GroupLayoutCacheEntry>()

  const rectElById = new Map<string, SVGRectElement>()
  args.rectSel.each(function (d) {
    rectElById.set(String(d.id), this as unknown as SVGRectElement)
  })
  const geoElById = new Map<string, SVGPathElement>()
  args.geoSel.each(function (d) {
    geoElById.set(String(d.id), this as unknown as SVGPathElement)
  })
  const labelElById = new Map<string, SVGTextElement>()
  args.labelSel.each(function (d) {
    labelElById.set(String(d.id), this as unknown as SVGTextElement)
  })
  const chevronElById = new Map<string, SVGPathElement>()
  args.chevronSel.each(function (d) {
    chevronElById.set(String(d.id), this as unknown as SVGPathElement)
  })
  const resizeHandleElById = new Map<string, SVGGElement>()
  if (args.resizeHandleGroupSel) {
    args.resizeHandleGroupSel.each(function (d) {
      resizeHandleElById.set(String(d.id), this as unknown as SVGGElement)
    })
  }

  const hitRectElById = new Map<string, SVGRectElement>()
  if (args.hitRectSel) {
    args.hitRectSel.each(function (d) {
      hitRectElById.set(String(d.id), this as unknown as SVGRectElement)
    })
  }

  const hitGeoElById = new Map<string, SVGPathElement>()
  if (args.hitGeoSel) {
    args.hitGeoSel.each(function (d) {
      hitGeoElById.set(String(d.id), this as unknown as SVGPathElement)
    })
  }

  const computeBoundsAndLabel = (d: T): GroupLayoutCacheEntry => {
    const explicit = (d as unknown as { bounds?: unknown }).bounds
    if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
      const bx = typeof (explicit as any).x === 'number' ? (explicit as any).x : Number.NaN
      const by = typeof (explicit as any).y === 'number' ? (explicit as any).y : Number.NaN
      const bw = typeof (explicit as any).width === 'number' ? (explicit as any).width : Number.NaN
      const bh = typeof (explicit as any).height === 'number' ? (explicit as any).height : Number.NaN
      if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bw) && Number.isFinite(bh) && bw > 0 && bh > 0) {
        const labelText = args.getGroupLabelText(d)
        const fontSize = labelText.fontSize
        const labelXRaw = typeof (explicit as any).labelX === 'number' ? (explicit as any).labelX : Number.NaN
        const labelYRaw = typeof (explicit as any).labelY === 'number' ? (explicit as any).labelY : Number.NaN
        const labelY = Number.isFinite(labelYRaw) ? labelYRaw : by + args.labelPadding
        const labelX = Number.isFinite(labelXRaw) ? labelXRaw : bx + args.labelPadding + args.chevronSizePx + args.chevronGapPx
        const chevronCx = labelX - args.chevronGapPx - args.chevronSizePx * 0.5
        const chevronCy = labelY + fontSize * 0.55
        return { x: bx, y: by, w: bw, h: bh, labelX, labelY, chevronCx, chevronCy, d: null }
      }
    }

    const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
    const extraPad = args.nestedPaddingStep > 0 ? args.nestedPaddingStep * Math.max(0, args.maxDepth - depth) : 0
    const effectivePadding = args.padding + extraPad
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = 0
    const geoPoints: Point2d[] = []
    for (let i = 0; i < d.memberNodeIds.length; i += 1) {
      const id = String(d.memberNodeIds[i] || '').trim()
      if (!id) continue
      const n = args.nodeById.get(id)
      if (!n) continue
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      const ext = args.nodeHalfExtentsById.get(id) || getNodeAabbHalfExtentsWithLabel(n, args.schema)
      const halfW = ext.halfW
      const halfH = ext.halfH
      const x0 = n.x - halfW
      const x1 = n.x + halfW
      const y0 = n.y - halfH
      const y1 = n.y + halfH
      if (x0 < minX) minX = x0
      if (x1 > maxX) maxX = x1
      if (y0 < minY) minY = y0
      if (y1 > maxY) maxY = y1
      const px = halfW + effectivePadding
      const py = halfH + effectivePadding
      geoPoints.push({ x: n.x - px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y + py })
      geoPoints.push({ x: n.x - px, y: n.y + py })
      valid += 1
    }
    if (valid === 0 || minX === Infinity) {
      return { x: 0, y: 0, w: 0, h: 0, labelX: 0, labelY: 0, chevronCx: 0, chevronCy: 0, d: null }
    }

    const labelText = args.getGroupLabelText(d)
    const fontSize = labelText.fontSize
    const topPad = effectivePadding + args.labelPadding + fontSize * 1.25
    const x = minX - effectivePadding
    const y = minY - topPad
    const w0 = Math.max(1, maxX - minX + effectivePadding * 2)
    const h = Math.max(1, maxY - minY + effectivePadding + topPad)
    const chevronCx = x + args.labelPadding + args.chevronSizePx * 0.5
    const chevronCy = y + args.labelPadding + fontSize * 0.55
    const labelX = x + args.labelPadding + args.chevronSizePx + args.chevronGapPx
    const labelY = y + args.labelPadding
    const w = Math.max(w0, labelX - x + labelText.labelWidthPx + args.labelPadding)

    if (args.shape === 'geo') {
      const ring = computeConvexRing(geoPoints)
      const dPath = buildClosedPathD(ring)
      return { x, y, w, h, labelX, labelY, chevronCx, chevronCy, d: dPath }
    }
    return { x, y, w, h, labelX, labelY, chevronCx, chevronCy, d: null }
  }

  const applyComputedToGroup = (d: T, computed: GroupLayoutCacheEntry, selectedGroupId: string) => {
    const id = String(d.id || '').trim()
    if (!id) return
    layoutCache.set(id, computed)

    if (args.shape === 'rect') {
      const rect = rectElById.get(id) || null
      if (rect) {
        rect.setAttribute('x', String(computed.x))
        rect.setAttribute('y', String(computed.y))
        rect.setAttribute('width', String(computed.w))
        rect.setAttribute('height', String(computed.h))
      }
      const hitRect = hitRectElById.get(id) || null
      if (hitRect) {
        hitRect.setAttribute('x', String(computed.x))
        hitRect.setAttribute('y', String(computed.y))
        hitRect.setAttribute('width', String(computed.w))
        hitRect.setAttribute('height', String(computed.h))
      }
    } else {
      const path = geoElById.get(id) || null
      if (path) path.setAttribute('d', computed.d || '')
      const hitPath = hitGeoElById.get(id) || null
      if (hitPath) hitPath.setAttribute('d', computed.d || '')
    }

    const labelEl = labelElById.get(id) || null
    if (labelEl) {
      labelEl.setAttribute('x', String(computed.labelX))
      labelEl.setAttribute('y', String(computed.labelY))
    }

    const chevronEl = chevronElById.get(id) || null
    if (chevronEl) {
      const dir = args.collapsedSet.has(id) ? 'right' : 'down'
      chevronEl.setAttribute(
        'd',
        buildChevronPathD({ cx: computed.chevronCx, cy: computed.chevronCy, size: args.chevronSizePx, direction: dir }),
      )
    }

    const handleEl = resizeHandleElById.get(id) || null
    if (handleEl) {
      handleEl.setAttribute('transform', `translate(${computed.x + computed.w},${computed.y + computed.h})`)
      const canResize = args.allowResize && selectedGroupId === id
      if (canResize) {
        handleEl.style.removeProperty('display')
        try {
          handleEl.parentNode?.appendChild(handleEl)
        } catch {
          void 0
        }
      } else {
        handleEl.style.display = 'none'
      }
    }
  }

  return { layoutCache, computeBoundsAndLabel, applyComputedToGroup, readExplicitBounds }
}
