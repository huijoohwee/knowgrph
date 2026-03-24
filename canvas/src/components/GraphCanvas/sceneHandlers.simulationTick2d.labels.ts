import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import { estimateLabelCharWidthPx, pickEdgeLabelPlacement, type AabbRect } from '@/components/GraphCanvas/layout/utils'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { getEdgeEndpointFromPorts } from '@/components/GraphCanvas/portHandles'
import { aabbOverlaps, aabbOverlapsAny } from '@/lib/ui/labels/aabb'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'
import { computeGroupLabelRelaxTuning2d, type Physics2dTuning } from '@/lib/graph/physics2dTuning'

export type LabelRelaxState2d = {
  groupLabelNudgeById: Map<string, { dx: number; dy: number }>
  lastLabelRelaxMode: 'compact' | 'wrap'
  lastLabelRelaxTick: number
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export function renderLabels2d(args: {
  svgEl: SVGSVGElement
  nodes: GraphNode[]
  schema: GraphSchema
  tuning: Physics2dTuning
  tick: number
  simulationAlpha: number
  width: number
  height: number
  labelsSel: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>
  edgeLabelSel?: d3.Selection<SVGTextElement, GraphEdge, SVGGElement, unknown> | null
  resolveNode: (endpoint: unknown) => GraphNode | null
  portHandlesEnabled: boolean
  labelFontSize: number
  baseDxFallback: number
  baseDyFallback: number
  maxNodesForRelax: number
  maxNodeLabels: number
  getNodeMetrics: (n: GraphNode) => { width: number; height: number; r: number }
  state: LabelRelaxState2d
}): void {
  const {
    svgEl,
    nodes,
    schema,
    tuning,
    tick,
    simulationAlpha,
    width,
    height,
    labelsSel,
    edgeLabelSel,
    resolveNode,
    portHandlesEnabled,
    labelFontSize,
    baseDxFallback,
    baseDyFallback,
    maxNodesForRelax,
    maxNodeLabels,
    getNodeMetrics,
    state,
  } = args

  const t = d3.zoomTransform(svgEl)
  const labelMode = 'compact' as const
  const shouldRelaxLabels = (() => {
    if (maxNodesForRelax > 0 && nodes.length > maxNodesForRelax) return false
    if (maxNodesForRelax === 0) return false
    if (labelMode !== state.lastLabelRelaxMode) return true
    if (simulationAlpha > 0.22) return tick - state.lastLabelRelaxTick >= 10
    if (simulationAlpha > 0.08) return tick - state.lastLabelRelaxTick >= 28
    return tick - state.lastLabelRelaxTick >= 64
  })()

  const groupLabelBlockers: AabbRect[] = []
  const groupLabelEls = svgEl.querySelectorAll('text[data-kg-group-label="1"]')
  type GroupLabelParticle = {
    id: string
    baseX: number
    baseY: number
    x: number
    y: number
    vx: number
    vy: number
    halfW: number
    halfH: number
    dxMin: number
    dxMax: number
    dyMin: number
    dyMax: number
    el: SVGTextElement
  }
  const groupParticles: GroupLabelParticle[] = []
  for (let i = 0; i < groupLabelEls.length; i += 1) {
    const el = groupLabelEls[i] as SVGTextElement
    const groupId = String(el.getAttribute('data-kg-group-id') || '').trim()
    if (!groupId) continue
    const x0 = Number(el.getAttribute('x'))
    const y0 = Number(el.getAttribute('y'))
    if (!Number.isFinite(x0) || !Number.isFinite(y0)) continue
    const fontSize = (() => {
      const raw = el.style && el.style.fontSize ? el.style.fontSize : ''
      const n = raw ? Number.parseFloat(raw) : Number.NaN
      return Number.isFinite(n) ? Math.max(10, Math.min(32, n)) : schema.labelStyles?.fontSize ?? 12
    })()
    const text = String(el.textContent || '')
    const w = Math.max(4, text.length * estimateLabelCharWidthPx(fontSize))
    const h = Math.max(6, fontSize * 1.2)
    const halfW = w / 2
    const halfH = h / 2
    const n0 = state.groupLabelNudgeById.get(groupId) || { dx: 0, dy: 0 }
    el.setAttribute('dx', String(n0.dx))
    el.setAttribute('dy', String(n0.dy))
    const groupRect = svgEl.querySelector(
      `g[data-kg-group-id="${CSS.escape(groupId)}"] rect[data-kg-shape="group-rect"]`,
    ) as SVGRectElement | null
    const pad = Math.max(6, Math.min(16, fontSize * 0.7))
    const bounds = (() => {
      if (!groupRect) return null
      const gx = Number(groupRect.getAttribute('x'))
      const gy = Number(groupRect.getAttribute('y'))
      const gw = Number(groupRect.getAttribute('width'))
      const gh = Number(groupRect.getAttribute('height'))
      if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gw) || !Number.isFinite(gh)) return null
      return { gx, gy, gw, gh }
    })()
    const dxMin = bounds ? bounds.gx + pad - x0 : -48
    const dxMax = bounds ? bounds.gx + bounds.gw - pad - w - x0 : 48
    const dyMin = bounds ? bounds.gy + pad - y0 : -36
    const dyMax = bounds ? bounds.gy + Math.min(bounds.gh - pad, pad + Math.max(48, fontSize * 4)) - h - y0 : 36
    const dx = clamp(n0.dx, dxMin, dxMax)
    const dy = clamp(n0.dy, dyMin, dyMax)
    state.groupLabelNudgeById.set(groupId, { dx, dy })
    el.setAttribute('dx', String(dx))
    el.setAttribute('dy', String(dy))
    const baseCx = x0 + halfW
    const baseCy = y0 + halfH
    const cx = baseCx + dx
    const cy = baseCy + dy
    groupParticles.push({
      id: groupId,
      baseX: baseCx,
      baseY: baseCy,
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      halfW,
      halfH,
      dxMin,
      dxMax,
      dyMin,
      dyMax,
      el,
    })
  }

  if (shouldRelaxLabels && groupParticles.length > 1) {
    const groupLabelTuning = computeGroupLabelRelaxTuning2d({ nodeCount: nodes.length, labelMode, tuning })
    const collideGroups = (alpha: number) => {
      for (let i = 0; i < groupParticles.length; i += 1) {
        const a = groupParticles[i]
        for (let j = i + 1; j < groupParticles.length; j += 1) {
          const b = groupParticles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const ox = a.halfW + b.halfW - Math.abs(dx)
          const oy = a.halfH + b.halfH - Math.abs(dy)
          if (!(ox > 0 && oy > 0)) continue
          if (ox < oy) {
            const s = dx >= 0 ? 1 : -1
            const push = ox * groupLabelTuning.pushGain * alpha
            a.vx += push * s
            b.vx -= push * s
          } else {
            const s = dy >= 0 ? 1 : -1
            const push = oy * groupLabelTuning.pushGain * alpha
            a.vy += push * s
            b.vy -= push * s
          }
        }
      }
    }
    const pullToBase = (alpha: number) => {
      const strength = groupLabelTuning.pullGain * alpha
      for (let i = 0; i < groupParticles.length; i += 1) {
        const p = groupParticles[i]
        p.vx += (p.baseX - p.x) * strength
        p.vy += (p.baseY - p.y) * strength
      }
    }
    runRelaxSteps({
      nodes: groupParticles,
      steps: groupLabelTuning.steps,
      forces: [collideGroups, pullToBase],
      maxOps: 18_000,
      integrate: n => {
        integrateNodePositionWithVelocity(n, { damping: groupLabelTuning.integrateDamping, z: { mode: 'never' } })
        const dx = clamp(n.x - n.baseX, n.dxMin, n.dxMax)
        const dy = clamp(n.y - n.baseY, n.dyMin, n.dyMax)
        n.x = n.baseX + dx
        n.y = n.baseY + dy
        state.groupLabelNudgeById.set(n.id, { dx, dy })
        n.el.setAttribute('dx', String(dx))
        n.el.setAttribute('dy', String(dy))
      },
    })
  }

  for (let i = 0; i < groupParticles.length; i += 1) {
    const p = groupParticles[i]
    groupLabelBlockers.push({ x: p.x, y: p.y, halfW: p.halfW, halfH: p.halfH })
  }

  labelsSel.attr('x', (d: GraphNode) => (typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0)).attr(
    'y',
    (d: GraphNode) => (typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0),
  )
  const padPx = 8
  const bodyBlockers: Array<AabbRect & { id: string }> = []
  const farPad = 240
  const bodyFilterEnabled = nodes.length > 1200
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    if (!Number.isFinite(n.x as number) || !Number.isFinite(n.y as number)) continue
    if (bodyFilterEnabled) {
      const sx = t.applyX(n.x as number)
      const sy = t.applyY(n.y as number)
      if (!(sx > -farPad && sx < width + farPad && sy > -farPad && sy < height + farPad)) continue
    }
    const dims = getNodeMetrics(n)
    const hw = Math.max(4, dims.width / 2)
    const hh = Math.max(4, dims.height / 2)
    bodyBlockers.push({ id: String(n.id), x: n.x as number, y: n.y as number, halfW: hw + 2, halfH: hh + 2 })
  }

  const maxPlacedNodeLabels = (() => {
    const maxLabels = maxNodeLabels > 0 ? maxNodeLabels : 0
    if (maxLabels === 0) return 0
    if (labelMode === 'compact') return Math.max(0, Math.min(maxLabels, 180))
    return maxLabels
  })()

  const nodeLabelRects: AabbRect[] = []
  labelsSel.each(function (d: GraphNode) {
    const el = this as unknown as SVGTextElement

    const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : null
    const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : null
    if (x == null || y == null) {
      el.style.display = 'none'
      return
    }
    const nodeId = String((d as unknown as { id?: unknown }).id ?? '')
    el.style.display = ''

    const currentMode = (el.getAttribute('data-label-mode') as 'compact' | 'wrap' | null) ?? 'compact'
    if (currentMode !== 'compact') {
      const nextText = String(el.getAttribute('data-label-compact') || '')
      while (el.firstChild) el.removeChild(el.firstChild)
      el.textContent = nextText
      el.setAttribute('data-label-mode', 'compact')
      el.setAttribute('data-label-linecount', '1')
      el.setAttribute('data-label-maxlen', String(nextText.length))
    }

    const charCount = (() => {
      const raw = el.getAttribute('data-label-maxlen')
      const n = raw != null ? Number(raw) : Number.NaN
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
    })()
    const lineCount = (() => {
      const raw = el.getAttribute('data-label-linecount')
      const n = raw != null ? Number(raw) : Number.NaN
      return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
    })()
    const sx = t.applyX(x)
    const sy = t.applyY(y)
    const k =
      typeof (t as unknown as { k?: unknown }).k === 'number' &&
      Number.isFinite((t as unknown as { k: number }).k) &&
      (t as unknown as { k: number }).k > 0
        ? (t as unknown as { k: number }).k
        : 1
    const estWidthPx = Math.max(0, charCount) * labelFontSize * k * 0.6
    const baseDxAttr = el.getAttribute('data-base-dx')
    const baseDx = (() => {
      const parsed = baseDxAttr != null ? Number(baseDxAttr) : Number.NaN
      if (Number.isFinite(parsed)) return parsed
      return baseDxFallback
    })()
    const baseDyAttr = el.getAttribute('data-base-dy')
    const baseDy = (() => {
      const parsed = baseDyAttr != null ? Number(baseDyAttr) : Number.NaN
      if (Number.isFinite(parsed)) return parsed
      return baseDyFallback
    })()
    const isNearViewport = sx > -farPad && sx < width + farPad && sy > -farPad && sy < height + farPad
    if (!isNearViewport) {
      el.setAttribute('data-collide-hidden', '0')
      el.setAttribute('text-anchor', String(el.getAttribute('data-base-anchor') || 'middle'))
      el.setAttribute('dx', String(baseDx))
      el.setAttribute('dy', String(baseDy))
      return
    }
    const candidates: Array<{ anchor: 'start' | 'end' | 'middle'; dx: number }> = []

    const abs = Math.abs(baseDx)
    candidates.push({ anchor: 'start', dx: abs })
    candidates.push({ anchor: 'end', dx: -abs })
    candidates.push({ anchor: 'middle', dx: baseDx })

    let best = candidates[0]
    let bestOverflow = Number.POSITIVE_INFINITY
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i]
      const left =
        c.anchor === 'start'
          ? sx + c.dx * k
          : c.anchor === 'end'
            ? sx + c.dx * k - estWidthPx
            : sx + c.dx * k - estWidthPx / 2
      const right =
        c.anchor === 'start'
          ? left + estWidthPx
          : c.anchor === 'end'
            ? sx + c.dx * k
            : sx + c.dx * k + estWidthPx / 2
      const overflowLeft = Math.max(0, padPx - left)
      const overflowRight = Math.max(0, right - (width - padPx))
      const total = overflowLeft + overflowRight
      if (total < bestOverflow) {
        bestOverflow = total
        best = c
      }
    }
    const left0 =
      best.anchor === 'start'
        ? sx + best.dx * k
        : best.anchor === 'end'
          ? sx + best.dx * k - estWidthPx
          : sx + best.dx * k - estWidthPx / 2
    const right0 =
      best.anchor === 'start'
        ? left0 + estWidthPx
        : best.anchor === 'end'
          ? sx + best.dx * k
          : sx + best.dx * k + estWidthPx / 2
    const overflowLeft0 = Math.max(0, padPx - left0)
    const overflowRight0 = Math.max(0, right0 - (width - padPx))
    const shiftPxRaw = overflowLeft0 - overflowRight0
    const maxShiftPx = 96
    const shiftPx = Math.max(-maxShiftPx, Math.min(maxShiftPx, shiftPxRaw))
    const dxAdjusted = best.dx + (k > 0 ? shiftPx / k : 0)

    const estHalfHeightPx = Math.max(1, lineCount) * labelFontSize * k * 0.6
    const top = sy + baseDy * k - estHalfHeightPx
    const bottom = sy + baseDy * k + estHalfHeightPx
    const overflowTop = Math.max(0, padPx - top)
    const overflowBottom = Math.max(0, bottom - (height - padPx))
    const shiftYPxRaw = overflowTop - overflowBottom
    const shiftYPx = Math.max(-maxShiftPx, Math.min(maxShiftPx, shiftYPxRaw))
    const dyAdjusted = baseDy + (k > 0 ? shiftYPx / k : 0)

    const halfW = Math.max(2, (Math.max(0, charCount) * labelFontSize * 0.6) / 2)
    const halfH = Math.max(2, (Math.max(1, lineCount) * labelFontSize * 0.6) / 2)

    const yStep = Math.max(10, Math.min(28, labelFontSize * 1.45))
    const xStep = Math.max(12, Math.min(36, labelFontSize * 1.8))
    const placeCandidates: Array<{ anchor: 'start' | 'end' | 'middle'; dx: number; dy: number }> = [
      { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted },
      { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted - yStep },
      { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted + yStep },
      { anchor: best.anchor, dx: dxAdjusted + xStep, dy: dyAdjusted },
      { anchor: best.anchor, dx: dxAdjusted - xStep, dy: dyAdjusted },
      { anchor: 'middle', dx: 0, dy: dyAdjusted },
    ]

    if (maxPlacedNodeLabels > 0 && nodeLabelRects.length >= maxPlacedNodeLabels) {
      el.style.display = 'none'
      el.setAttribute('data-collide-hidden', '1')
      return
    }

    const overlapsBlockers = (rect: AabbRect) => {
      if (aabbOverlapsAny(rect, groupLabelBlockers)) return true
      for (let bi = 0; bi < bodyBlockers.length; bi += 1) {
        const b = bodyBlockers[bi]!
        if (b.id === nodeId) continue
        if (aabbOverlaps(rect, b)) return true
      }
      return false
    }

    let placedRect: AabbRect | null = null
    let placedAnchor: 'start' | 'end' | 'middle' = best.anchor
    let placedDx = dxAdjusted
    let placedDy = dyAdjusted
    for (let ci = 0; ci < placeCandidates.length; ci += 1) {
      const c = placeCandidates[ci]!
      const centerX = c.anchor === 'start' ? x + c.dx + halfW : c.anchor === 'end' ? x + c.dx - halfW : x + c.dx
      const centerY = y + c.dy
      const rect: AabbRect = { x: centerX, y: centerY, halfW, halfH }
      if (overlapsBlockers(rect)) continue
      if (aabbOverlapsAny(rect, nodeLabelRects)) continue
      placedRect = rect
      placedAnchor = c.anchor
      placedDx = c.dx
      placedDy = c.dy
      break
    }

    if (!placedRect) {
      el.style.display = 'none'
      el.setAttribute('data-collide-hidden', '1')
      return
    }
    el.style.display = ''
    el.setAttribute('data-collide-hidden', '0')
    el.setAttribute('text-anchor', placedAnchor)
    el.setAttribute('dx', String(placedDx))
    el.setAttribute('dy', String(placedDy))
    nodeLabelRects.push(placedRect)
  })

  if (shouldRelaxLabels) {
    state.lastLabelRelaxMode = labelMode
    state.lastLabelRelaxTick = tick
  }

  if (edgeLabelSel) {
    const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
    const hideEdgeLabels = hideBelow > 0 && d3.zoomTransform(svgEl).k < hideBelow
    if (hideEdgeLabels) {
      edgeLabelSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
    } else {
      edgeLabelSel.attr('data-zoom-lod-hidden', '0').style('display', null)
      const placedEdgeLabelRects: AabbRect[] = []
      const blockerRects = [...groupLabelBlockers, ...nodeLabelRects, ...bodyBlockers]
      edgeLabelSel.each(function (d: GraphEdge) {
        const el = this as unknown as SVGTextElement
        const edge = d as unknown as EdgeWithRuntime
        const edgeProps =
          edge.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
            ? (edge.properties as Record<string, unknown>)
            : null
        const lx = edgeProps && typeof edgeProps['visual:labelX'] === 'number' ? (edgeProps['visual:labelX'] as number) : Number.NaN
        const ly = edgeProps && typeof edgeProps['visual:labelY'] === 'number' ? (edgeProps['visual:labelY'] as number) : Number.NaN
        if (Number.isFinite(lx) && Number.isFinite(ly)) {
          const sx2 = t.applyX(lx)
          const sy2 = t.applyY(ly)
          const farPad = 240
          const isNearViewport = sx2 > -farPad && sx2 < width + farPad && sy2 > -farPad && sy2 < height + farPad
          if (!isNearViewport) {
            el.style.display = 'none'
            return
          }
          el.style.display = ''
          el.setAttribute('x', String(lx))
          el.setAttribute('y', String(ly))
          return
        }
        const srcNode = resolveNode(edge.source)
        const tgtNode = resolveNode(edge.target)
        if (!srcNode || !tgtNode) {
          el.style.display = 'none'
          return
        }
        const sx = typeof srcNode.x === 'number' && Number.isFinite(srcNode.x) ? srcNode.x : 0
        const sy = typeof srcNode.y === 'number' && Number.isFinite(srcNode.y) ? srcNode.y : 0
        const tx = typeof tgtNode.x === 'number' && Number.isFinite(tgtNode.x) ? tgtNode.x : 0
        const ty = typeof tgtNode.y === 'number' && Number.isFinite(tgtNode.y) ? tgtNode.y : 0
        const p1 = portHandlesEnabled ? getEdgeEndpointFromPorts({ from: srcNode, to: tgtNode, schema }) : { x: sx, y: sy }
        const p2 = portHandlesEnabled ? getEdgeEndpointFromPorts({ from: tgtNode, to: srcNode, schema }) : { x: tx, y: ty }
        const text = el.textContent ?? ''
        const srcExt = getNodeAabbHalfExtentsWithLabel(srcNode, schema)
        const tgtExt = getNodeAabbHalfExtentsWithLabel(tgtNode, schema)

        const placement = pickEdgeLabelPlacement({
          p1,
          p2,
          text: String(text || ''),
          fontSize: labelFontSize,
          srcRect: { x: sx, y: sy, halfW: srcExt.halfW, halfH: srcExt.halfH },
          tgtRect: { x: tx, y: ty, halfW: tgtExt.halfW, halfH: tgtExt.halfH },
          blockerRects,
          placedLabelRects: placedEdgeLabelRects,
        })

        if (!placement) {
          el.style.display = 'none'
          return
        }
        placedEdgeLabelRects.push(placement)

        const sx2 = t.applyX(placement.x)
        const sy2 = t.applyY(placement.y)
        const farPad = 240
        const isNearViewport = sx2 > -farPad && sx2 < width + farPad && sy2 > -farPad && sy2 < height + farPad
        if (!isNearViewport) {
          el.style.display = 'none'
          return
        }
        el.style.display = ''
        el.setAttribute('x', String(placement.x))
        el.setAttribute('y', String(placement.y))
      })
    }
  }
}

