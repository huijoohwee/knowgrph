import * as d3 from 'd3'

import type { FlowHandleId, FlowNodeHandles } from '@/components/FlowCanvas/handles'
import { resolveCssVar } from '@/lib/ui/theme-tokens'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { computeConvexRing, type Point2d } from '@/lib/geometry/convexRing'

export type FlowNativeNodeShape = 'circle' | 'rect' | 'diamond' | 'hex'

export type FlowNativeNode = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  shape: FlowNativeNodeShape
  handles: FlowNodeHandles
  inHandleTopPctById: Partial<Record<FlowHandleId, number>>
  outHandleTopPctById: Partial<Record<FlowHandleId, number>>
}

export type FlowNativeEdge = {
  id: string
  source: string
  target: string
  inHandleId: FlowHandleId
  outHandleId: FlowHandleId
}

export type FlowNativeScene = {
  nodes: FlowNativeNode[]
  edges: FlowNativeEdge[]
  nodeById: Map<string, FlowNativeNode>
  groups?: GraphGroup[]
}

export type FlowNativePortHandlesPresentation = {
  enabled: boolean
  placement: 'cardinal'
  sizePx: number
  offsetPx: number
  strokeWidthPx: number
}

export type FlowNativeGroupsPresentation = {
  enabled: boolean
  shape: 'rect' | 'geo'
  paddingPx: number
  cornerRadiusPx: number
  strokeWidthPx: number
  fillOpacity: number
}

export type FlowNativePresentation = {
  portHandles: FlowNativePortHandlesPresentation
  groups: FlowNativeGroupsPresentation
}

export type FlowNativeTheme = {
  bg: string
  nodeFill: string
  nodeStroke: string
  nodeStrokeSelected: string
  text: string
  edge: string
  edgeSelected: string
}

export type FlowNativeRuntime = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  viewportW: number
  viewportH: number
  dpr: number
  transform: d3.ZoomTransform
  rankdir: 'TB' | 'LR'
  scene: FlowNativeScene | null
  theme: FlowNativeTheme
  fontFamily: string
  presentation: FlowNativePresentation
  pendingRaf: number | null
  dirty: boolean
}

export const defaultFlowTheme = (): FlowNativeTheme => ({
  bg: '#ffffff',
  nodeFill: '#ffffff',
  nodeStroke: '#9ca3af',
  nodeStrokeSelected: '#2563eb',
  text: '#111827',
  edge: '#9ca3af',
  edgeSelected: '#2563eb',
})

export const readFlowFontFamilyFromCss = (): string => {
  const fallback = '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif'
  if (typeof document === 'undefined') return fallback
  try {
    const raw = String(getComputedStyle(document.documentElement).fontFamily || '').trim()
    return raw || fallback
  } catch {
    return fallback
  }
}

export const readFlowThemeFromCss = (): FlowNativeTheme => {
  try {
    return {
      bg: resolveCssVar('--kg-canvas-bg', defaultFlowTheme().bg),
      nodeFill: resolveCssVar('--kg-surface-bg', defaultFlowTheme().nodeFill),
      nodeStroke: resolveCssVar('--kg-canvas-node-stroke', defaultFlowTheme().nodeStroke),
      nodeStrokeSelected: resolveCssVar('--kg-canvas-accent', defaultFlowTheme().nodeStrokeSelected),
      text: resolveCssVar('--kg-text-primary', defaultFlowTheme().text),
      edge: resolveCssVar('--kg-canvas-edge-stroke', defaultFlowTheme().edge),
      edgeSelected: resolveCssVar('--kg-canvas-accent', defaultFlowTheme().edgeSelected),
    }
  } catch {
    return defaultFlowTheme()
  }
}

export const clampScale = (k: number, args: { minK: number; maxK: number }) => {
  const minK = Number.isFinite(args.minK) ? args.minK : 0.05
  const maxK = Number.isFinite(args.maxK) ? args.maxK : 20
  return Math.max(minK, Math.min(maxK, k))
}

export const createFlowNativeRuntime = (args: {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  viewportW: number
  viewportH: number
  dpr: number
  rankdir: 'TB' | 'LR'
  initialTransform?: d3.ZoomTransform
}): FlowNativeRuntime => {
  return {
    canvas: args.canvas,
    ctx: args.ctx,
    viewportW: Math.max(1, Math.floor(args.viewportW)),
    viewportH: Math.max(1, Math.floor(args.viewportH)),
    dpr: Math.max(1, args.dpr),
    transform: args.initialTransform || d3.zoomIdentity,
    rankdir: args.rankdir,
    scene: null,
    theme: readFlowThemeFromCss(),
    fontFamily: readFlowFontFamilyFromCss(),
    presentation: {
      portHandles: { enabled: false, placement: 'cardinal', sizePx: 4, offsetPx: 2, strokeWidthPx: 1.5 },
      groups: { enabled: false, shape: 'rect', paddingPx: 24, cornerRadiusPx: 12, strokeWidthPx: 1.5, fillOpacity: 0.08 },
    },
    pendingRaf: null,
    dirty: true,
  }
}

export const setFlowNativePresentation = (rt: FlowNativeRuntime, p: FlowNativePresentation) => {
  rt.presentation = p
  rt.dirty = true
}

export const setFlowNativeViewport = (rt: FlowNativeRuntime, args: { viewportW: number; viewportH: number; dpr: number }) => {
  rt.viewportW = Math.max(1, Math.floor(args.viewportW))
  rt.viewportH = Math.max(1, Math.floor(args.viewportH))
  rt.dpr = Math.max(1, args.dpr)
}

export const setFlowNativeRankdir = (rt: FlowNativeRuntime, rankdir: 'TB' | 'LR') => {
  rt.rankdir = rankdir
}

export const setFlowNativeTransform = (rt: FlowNativeRuntime, t: d3.ZoomTransform) => {
  rt.transform = t
  rt.dirty = true
}

export const setFlowNativeScene = (rt: FlowNativeRuntime, scene: FlowNativeScene | null) => {
  rt.scene = scene
  rt.dirty = true
}

export const screenToWorld = (rt: FlowNativeRuntime, p: { sx: number; sy: number }) => {
  const k = rt.transform.k || 1
  const wx = (p.sx - rt.transform.x) / k
  const wy = (p.sy - rt.transform.y) / k
  return { x: wx, y: wy }
}

export const hitTestNode = (rt: FlowNativeRuntime, p: { sx: number; sy: number }): string | null => {
  const scene = rt.scene
  if (!scene) return null
  const w = screenToWorld(rt, p)
  for (let i = scene.nodes.length - 1; i >= 0; i -= 1) {
    const n = scene.nodes[i]
    if (w.x >= n.x && w.x <= n.x + n.width && w.y >= n.y && w.y <= n.y + n.height) return n.id
  }
  return null
}

const clearCanvas = (rt: FlowNativeRuntime) => {
  const ctx = rt.ctx
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, rt.canvas.width, rt.canvas.height)
}

const applyDprAndWorldTransform = (rt: FlowNativeRuntime) => {
  const ctx = rt.ctx
  const dpr = rt.dpr
  const t = rt.transform
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.translate(t.x, t.y)
  ctx.scale(t.k, t.k)
}

const resolveColor = (value: string | null | undefined, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return fallback
  const m = v.match(/^var\((--[^)\s]+)\)$/)
  if (m) return resolveCssVar(m[1], fallback)
  return v
}

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(Math.floor(r), Math.floor(Math.min(w, h) / 2)))
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    ;(ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, rr)
    return
  }
  const r0 = rr
  ctx.moveTo(x + r0, y)
  ctx.lineTo(x + w - r0, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r0)
  ctx.lineTo(x + w, y + h - r0)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r0, y + h)
  ctx.lineTo(x + r0, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r0)
  ctx.lineTo(x, y + r0)
  ctx.quadraticCurveTo(x, y, x + r0, y)
}

const drawNode = (rt: FlowNativeRuntime, n: FlowNativeNode, args: { selected: boolean }) => {
  const ctx = rt.ctx
  ctx.beginPath()
  if (n.shape === 'circle') {
    const r = Math.max(1, Math.min(n.width, n.height) / 2)
    ctx.arc(n.x + n.width / 2, n.y + n.height / 2, r, 0, Math.PI * 2)
  } else if (n.shape === 'diamond') {
    const cx = n.x + n.width / 2
    const cy = n.y + n.height / 2
    ctx.moveTo(cx, n.y)
    ctx.lineTo(n.x + n.width, cy)
    ctx.lineTo(cx, n.y + n.height)
    ctx.lineTo(n.x, cy)
    ctx.closePath()
  } else if (n.shape === 'hex') {
    const cx = n.x + n.width / 2
    const cy = n.y + n.height / 2
    const rx = n.width / 2
    const ry = n.height / 2
    const k = 0.58
    ctx.moveTo(cx - rx * k, n.y)
    ctx.lineTo(cx + rx * k, n.y)
    ctx.lineTo(n.x + n.width, cy)
    ctx.lineTo(cx + rx * k, n.y + n.height)
    ctx.lineTo(cx - rx * k, n.y + n.height)
    ctx.lineTo(n.x, cy)
    ctx.closePath()
  } else {
    ctx.rect(n.x, n.y, n.width, n.height)
  }
  ctx.fillStyle = rt.theme.nodeFill
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = args.selected ? rt.theme.nodeStrokeSelected : rt.theme.nodeStroke
  ctx.stroke()

  const label = String(n.label || '').trim()
  if (!label) return
  ctx.fillStyle = rt.theme.text
  ctx.font = `12px ${rt.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const clipped = label.length > 64 ? `${label.slice(0, 61)}…` : label
  ctx.fillText(clipped, n.x + n.width / 2, n.y + n.height / 2)
}

const drawPortHandles = (rt: FlowNativeRuntime, n: FlowNativeNode) => {
  const cfg = rt.presentation.portHandles
  if (!cfg.enabled) return
  if (cfg.placement !== 'cardinal') return
  const ctx = rt.ctx
  const r = Math.max(1, cfg.sizePx)
  const offset = Math.max(0, cfg.offsetPx)
  const strokeW = Math.max(0, cfg.strokeWidthPx)

  const fill = resolveCssVar('--kg-panel-bg', rt.theme.nodeFill)
  const stroke = rt.theme.nodeStrokeSelected

  const axisFor = (pct: number, length: number) => (Math.max(0, Math.min(100, pct)) / 100) * length
  const inHandles = n.handles?.in || []
  const outHandles = n.handles?.out || []

  const drawCircle = (x: number, y: number) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = strokeW
    ctx.strokeStyle = stroke
    ctx.stroke()
  }

  if (rt.rankdir === 'LR') {
    for (let i = 0; i < inHandles.length; i += 1) {
      const pct = n.inHandleTopPctById[inHandles[i].id] ?? 50
      const y = n.y + axisFor(pct, n.height)
      drawCircle(n.x - offset, y)
    }
    for (let i = 0; i < outHandles.length; i += 1) {
      const pct = n.outHandleTopPctById[outHandles[i].id] ?? 50
      const y = n.y + axisFor(pct, n.height)
      drawCircle(n.x + n.width + offset, y)
    }
    return
  }

  for (let i = 0; i < inHandles.length; i += 1) {
    const pct = n.inHandleTopPctById[inHandles[i].id] ?? 50
    const x = n.x + axisFor(pct, n.width)
    drawCircle(x, n.y - offset)
  }
  for (let i = 0; i < outHandles.length; i += 1) {
    const pct = n.outHandleTopPctById[outHandles[i].id] ?? 50
    const x = n.x + axisFor(pct, n.width)
    drawCircle(x, n.y + n.height + offset)
  }
}

const drawEdge = (
  rt: FlowNativeRuntime,
  e: FlowNativeEdge,
  args: {
    selected: boolean
    source: FlowNativeNode
    target: FlowNativeNode
  },
) => {
  const ctx = rt.ctx
  const rankdir = rt.rankdir
  const s = args.source
  const t = args.target
  const portHandlesEnabled = rt.presentation.portHandles.enabled
  const sPct = portHandlesEnabled ? ((s.outHandleTopPctById[e.outHandleId] ?? 50) as number) : 50
  const tPct = portHandlesEnabled ? ((t.inHandleTopPctById[e.inHandleId] ?? 50) as number) : 50
  const sAxis = Math.max(0, Math.min(100, sPct)) / 100
  const tAxis = Math.max(0, Math.min(100, tPct)) / 100

  const sxx = rankdir === 'LR' ? s.x + s.width : s.x + sAxis * s.width
  const txx = rankdir === 'LR' ? t.x : t.x + tAxis * t.width
  const syy = rankdir === 'LR' ? s.y + sAxis * s.height : s.y + s.height
  const tyy = rankdir === 'LR' ? t.y + tAxis * t.height : t.y

  const dx = txx - sxx
  const dy = tyy - syy
  const c = 0.5
  const c1x = rankdir === 'LR' ? sxx + dx * c : sxx
  const c1y = rankdir === 'LR' ? syy : syy + dy * c
  const c2x = rankdir === 'LR' ? txx - dx * c : txx
  const c2y = rankdir === 'LR' ? tyy : tyy - dy * c

  ctx.beginPath()
  ctx.moveTo(sxx, syy)
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, txx, tyy)
  ctx.lineWidth = 1
  ctx.strokeStyle = args.selected ? rt.theme.edgeSelected : rt.theme.edge
  ctx.stroke()
}

const drawGroups = (rt: FlowNativeRuntime) => {
  const cfg = rt.presentation.groups
  if (!cfg.enabled) return
  const scene = rt.scene
  if (!scene?.groups || scene.groups.length === 0) return
  const ctx = rt.ctx

  const stroke = rt.theme.edge
  const fill = rt.theme.edge
  const strokeWidth = Math.max(0, cfg.strokeWidthPx)
  const fillOpacity = Math.max(0, Math.min(1, cfg.fillOpacity))
  const padding = Math.max(0, cfg.paddingPx)
  const radius = Math.max(0, cfg.cornerRadiusPx)
  const labelFill = resolveCssVar('--kg-text-secondary', rt.theme.text)

  const groups = scene.groups
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const memberIds = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    if (memberIds.length === 0) continue

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const geoPoints: Point2d[] = []

    for (let j = 0; j < memberIds.length; j += 1) {
      const id = String(memberIds[j] || '').trim()
      if (!id) continue
      const n = scene.nodeById.get(id)
      if (!n) continue
      const x0 = n.x - padding
      const y0 = n.y - padding
      const x1 = n.x + n.width + padding
      const y1 = n.y + n.height + padding
      minX = Math.min(minX, x0)
      minY = Math.min(minY, y0)
      maxX = Math.max(maxX, x1)
      maxY = Math.max(maxY, y1)
      geoPoints.push({ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 })
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)

    const gStroke = resolveColor(g.style?.stroke, stroke)
    const gFill = resolveColor(g.style?.fill, fill)
    const gStrokeWidth = typeof g.style?.strokeWidth === 'number' && Number.isFinite(g.style.strokeWidth) ? Math.max(0, g.style.strokeWidth) : strokeWidth

    ctx.save()
    ctx.globalAlpha = fillOpacity
    ctx.fillStyle = gFill
    ctx.strokeStyle = gStroke
    ctx.lineWidth = gStrokeWidth

    if (cfg.shape === 'geo' && geoPoints.length >= 3) {
      const ring = computeConvexRing(geoPoints)
      if (ring.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(ring[0].x, ring[0].y)
        for (let k = 1; k < ring.length; k += 1) ctx.lineTo(ring[k].x, ring[k].y)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.stroke()
      }
    } else {
      ctx.beginPath()
      roundRectPath(ctx, minX, minY, w, h, radius)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
    }

    ctx.restore()

    const label = String(g.label || '').trim()
    if (label) {
      ctx.save()
      ctx.fillStyle = labelFill
      ctx.font = `600 12px ${rt.fontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(label.length > 48 ? `${label.slice(0, 45)}…` : label, minX + 10, minY + 8)
      ctx.restore()
    }
  }
}

export const drawFlowNative = (rt: FlowNativeRuntime, args: { selectedNodeIds: string[]; selectedEdgeIds: string[] }) => {
  if (!rt.dirty) return
  rt.dirty = false
  clearCanvas(rt)

  const ctx = rt.ctx
  rt.theme = readFlowThemeFromCss()
  rt.fontFamily = readFlowFontFamilyFromCss()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = rt.theme.bg
  ctx.fillRect(0, 0, rt.canvas.width, rt.canvas.height)

  applyDprAndWorldTransform(rt)

  const scene = rt.scene
  if (!scene) return
  const selectedNodeIds = new Set<string>(args.selectedNodeIds || [])
  const selectedEdgeIds = new Set<string>(args.selectedEdgeIds || [])

  drawGroups(rt)

  for (let i = 0; i < scene.edges.length; i += 1) {
    const e = scene.edges[i]
    const s = scene.nodeById.get(e.source)
    const t = scene.nodeById.get(e.target)
    if (!s || !t) continue
    drawEdge(rt, e, { selected: selectedEdgeIds.has(e.id), source: s, target: t })
  }

  for (let i = 0; i < scene.nodes.length; i += 1) {
    const n = scene.nodes[i]
    drawNode(rt, n, { selected: selectedNodeIds.has(n.id) })
    drawPortHandles(rt, n)
  }
}

export const requestFlowNativeDraw = (rt: FlowNativeRuntime, args: { selectedNodeIds: string[]; selectedEdgeIds: string[] }) => {
  if (rt.pendingRaf != null) return
  rt.pendingRaf = requestAnimationFrame(() => {
    rt.pendingRaf = null
    drawFlowNative(rt, args)
  })
}
