import * as d3 from 'd3'

import type { FlowHandleId, FlowNodeHandles } from '@/components/FlowCanvas/handles'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { computeConvexRing, type Point2d } from '@/lib/geometry/convexRing'
import { routeFlowEdgeOrtho, type Rect } from '@/components/FlowCanvas/edgeRouting'
import { computeGroupDepthStyle } from '@/lib/graph/groupDepthStyle'
import { estimateMaxCharsForWidthPx, truncateTextWithEllipsis } from '@/lib/ui/text/labelText'
import { getKgTokenFallback, getKgThemeFromDom, resolveCssVarWithKgFallback } from '@/lib/ui/tokens-ssot'

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
  groupIdsByNodeId?: Map<string, string[]>
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
  labelTopExtraPx: number
  cornerRadiusPx: number
  strokeWidthPx: number
  fillOpacity: number
  depthStyle: {
    enabled: boolean
    outerMaxBoostSteps: number
    outerStrokeWidthStepPx: number
    outerFillOpacityStep: number
  }
}

export type FlowNativePresentation = {
  portHandles: FlowNativePortHandlesPresentation
  groups: FlowNativeGroupsPresentation
  edges: {
    routing: {
      enabled: boolean
      mode: 'bezier' | 'ortho'
      obstacleAvoidance: boolean
      marginPx: number
      laneStepPx: number
      maxLanes: number
    }
    underlay: {
      enabled: boolean
      groupFadeAlpha: number
    }
  }
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
  positionsReady: boolean
  theme: FlowNativeTheme
  fontFamily: string
  cssKey: string
  presentation: FlowNativePresentation
  pendingRaf: number | null
  dirty: boolean
}

export const defaultFlowTheme = (): FlowNativeTheme => ({
  bg: getKgTokenFallback('--kg-canvas-bg', 'light'),
  nodeFill: getKgTokenFallback('--kg-surface-bg', 'light'),
  nodeStroke: getKgTokenFallback('--kg-canvas-node-stroke', 'light'),
  nodeStrokeSelected: getKgTokenFallback('--kg-canvas-accent', 'light'),
  text: getKgTokenFallback('--kg-text-primary', 'light'),
  edge: getKgTokenFallback('--kg-canvas-edge-stroke', 'light'),
  edgeSelected: getKgTokenFallback('--kg-canvas-accent', 'light'),
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

export const readFlowCssKey = (): string => {
  if (typeof document === 'undefined') return ''
  const root = document.documentElement
  const theme = root.getAttribute('data-theme') || ''
  const className = root.className || ''
  const style = root.getAttribute('style') || ''
  return `${theme}|${className}|${style}`
}

export const readFlowThemeFromCss = (): FlowNativeTheme => {
  try {
    if (typeof document === 'undefined') return defaultFlowTheme()
    const theme = getKgThemeFromDom()
    return {
      bg: resolveCssVarWithKgFallback('--kg-canvas-bg', theme),
      nodeFill: resolveCssVarWithKgFallback('--kg-surface-bg', theme),
      nodeStroke: resolveCssVarWithKgFallback('--kg-canvas-node-stroke', theme),
      nodeStrokeSelected: resolveCssVarWithKgFallback('--kg-canvas-accent', theme),
      text: resolveCssVarWithKgFallback('--kg-text-primary', theme),
      edge: resolveCssVarWithKgFallback('--kg-canvas-edge-stroke', theme),
      edgeSelected: resolveCssVarWithKgFallback('--kg-canvas-accent', theme),
    }
  } catch {
    return defaultFlowTheme()
  }
}

export const refreshFlowNativeCss = (rt: FlowNativeRuntime): void => {
  const nextKey = readFlowCssKey()
  if (nextKey && nextKey !== rt.cssKey) {
    rt.cssKey = nextKey
    rt.theme = readFlowThemeFromCss()
    rt.fontFamily = readFlowFontFamilyFromCss()
    rt.dirty = true
  }
}

let cachedCssVarKey = ''
let cachedCssVarValues: Map<string, string> | null = null

const resolveCssVarCached = (rt: FlowNativeRuntime, name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback
  if (!name) return fallback
  if (!rt.cssKey) return fallback

  if (rt.cssKey !== cachedCssVarKey) {
    cachedCssVarKey = rt.cssKey
    cachedCssVarValues = new Map()
  }
  const cache = cachedCssVarValues
  const cached = cache?.get(name)
  if (cached) return cached
  try {
    const styles = getComputedStyle(document.documentElement)
    const v = styles.getPropertyValue(name).trim()
    const resolved = v || fallback
    cache?.set(name, resolved)
    return resolved
  } catch {
    return fallback
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
  const cssKey = readFlowCssKey()
  return {
    canvas: args.canvas,
    ctx: args.ctx,
    viewportW: Math.max(1, Math.floor(args.viewportW)),
    viewportH: Math.max(1, Math.floor(args.viewportH)),
    dpr: Math.max(1, args.dpr),
    transform: args.initialTransform || d3.zoomIdentity,
    rankdir: args.rankdir,
    scene: null,
    positionsReady: false,
    theme: readFlowThemeFromCss(),
    fontFamily: readFlowFontFamilyFromCss(),
    cssKey,
    presentation: {
      portHandles: { enabled: false, placement: 'cardinal', sizePx: 4, offsetPx: 2, strokeWidthPx: 1.5 },
      groups: {
        enabled: false,
        shape: 'rect',
        paddingPx: 24,
        labelTopExtraPx: 0,
        cornerRadiusPx: 12,
        strokeWidthPx: 1.5,
        fillOpacity: 0.08,
        depthStyle: { enabled: true, outerMaxBoostSteps: 3, outerStrokeWidthStepPx: 0.55, outerFillOpacityStep: 0.035 },
      },
      edges: {
        routing: { enabled: true, mode: 'ortho', obstacleAvoidance: true, marginPx: 10, laneStepPx: 56, maxLanes: 10 },
        underlay: { enabled: true, groupFadeAlpha: 0.65 },
      },
    },
    pendingRaf: null,
    dirty: true,
  }
}

export const computeFlowGroupAabb = (args: {
  scene: FlowNativeScene
  group: GraphGroup
  paddingPx: number
  labelTopExtraPx: number
}): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  const memberIds = Array.isArray(args.group.memberNodeIds) ? args.group.memberNodeIds : []
  if (memberIds.length === 0) return null
  const padding = Math.max(0, args.paddingPx)
  const topExtra = Math.max(0, args.labelTopExtraPx)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let j = 0; j < memberIds.length; j += 1) {
    const id = String(memberIds[j] || '').trim()
    if (!id) continue
    const n = args.scene.nodeById.get(id)
    if (!n) continue
    const x0 = n.x - padding
    const y0 = n.y - padding
    const x1 = n.x + n.width + padding
    const y1 = n.y + n.height + padding
    minX = Math.min(minX, x0)
    minY = Math.min(minY, y0)
    maxX = Math.max(maxX, x1)
    maxY = Math.max(maxY, y1)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { minX, minY: minY - topExtra, maxX, maxY }
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

export const hitTestGroup = (rt: FlowNativeRuntime, p: { sx: number; sy: number }): string | null => {
  const cfg = rt.presentation.groups
  if (!cfg.enabled) return null
  const scene = rt.scene
  if (!scene?.groups || scene.groups.length === 0) return null
  const w = screenToWorld(rt, p)
  const padding = Math.max(0, cfg.paddingPx)
  const topExtra = Math.max(0, cfg.labelTopExtraPx)
  const groups = scene.groups
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i]
    const aabb = computeFlowGroupAabb({ scene, group: g, paddingPx: padding, labelTopExtraPx: topExtra })
    if (!aabb) continue
    if (w.x >= aabb.minX && w.x <= aabb.maxX && w.y >= aabb.minY && w.y <= aabb.maxY) return String(g.id || '')
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

const resolveColor = (rt: FlowNativeRuntime, value: string | null | undefined, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return fallback
  const m = v.match(/^var\((--[^)\s]+)\)$/)
  if (m) return resolveCssVarCached(rt, m[1], fallback)
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
  const fontSizePx = 12
  ctx.font = `${fontSizePx}px ${rt.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxChars = estimateMaxCharsForWidthPx(Math.max(0, n.width - 12), fontSizePx)
  const clipped = truncateTextWithEllipsis(label, maxChars)
  ctx.fillText(clipped, n.x + n.width / 2, n.y + n.height / 2)
}

const drawPortHandles = (rt: FlowNativeRuntime, n: FlowNativeNode) => {
  const cfg = rt.presentation.portHandles
  if (!cfg.enabled) return
  if (cfg.placement !== 'cardinal') return
  const ctx = rt.ctx
  const k = rt.transform.k || 1
  const rScreen = Math.max(4, cfg.sizePx)
  const offsetScreen = Math.max(0, cfg.offsetPx)
  const strokeWScreen = Math.max(1, cfg.strokeWidthPx)
  const r = rScreen / k
  const offset = offsetScreen / k
  const strokeW = strokeWScreen / k

  const fill = resolveCssVarCached(rt, '--kg-panel-bg', rt.theme.nodeFill)
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
    routingObstacles: Rect[] | null
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

  const edgesCfg = rt.presentation.edges
  const routingCfg = edgesCfg.routing
  const useOrtho = routingCfg.enabled && routingCfg.mode === 'ortho'
  const useObstacles = useOrtho && routingCfg.obstacleAvoidance
  const obstacles = useObstacles && args.routingObstacles ? args.routingObstacles : []
  const points = useOrtho
    ? routeFlowEdgeOrtho({
        rankdir,
        start: { x: sxx, y: syy },
        end: { x: txx, y: tyy },
        obstacles,
        marginPx: routingCfg.marginPx,
        laneStepPx: routingCfg.laneStepPx,
        maxLanes: routingCfg.maxLanes,
        ignorePoints: useObstacles ? [{ x: sxx, y: syy }, { x: txx, y: tyy }] : undefined,
      })
    : []

  ctx.beginPath()
  if (points.length >= 2) {
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
  } else {
    ctx.moveTo(sxx, syy)
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, txx, tyy)
  }
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'
  ctx.strokeStyle = args.selected ? rt.theme.edgeSelected : rt.theme.edge
  ctx.stroke()
}

const buildRoutingObstacles = (rt: FlowNativeRuntime, scene: FlowNativeScene): Rect[] => {
  const obstacles: Rect[] = []
  for (let i = 0; i < scene.nodes.length; i += 1) {
    const n = scene.nodes[i]
    obstacles.push({ x: n.x, y: n.y, w: n.width, h: n.height })
  }

  const gCfg = rt.presentation.groups
  if (!gCfg.enabled || !scene.groups || scene.groups.length === 0) return obstacles

  for (let i = 0; i < scene.groups.length; i += 1) {
    const g = scene.groups[i]
    const aabb = computeFlowGroupAabb({
      scene,
      group: g,
      paddingPx: gCfg.paddingPx,
      labelTopExtraPx: gCfg.labelTopExtraPx,
    })
    if (!aabb) continue
    const w = aabb.maxX - aabb.minX
    const h = aabb.maxY - aabb.minY
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) continue
    obstacles.push({ x: aabb.minX, y: aabb.minY, w, h })
  }

  return obstacles
}

const fadeEdgesUnderGeometry = (rt: FlowNativeRuntime) => {
  const ctx = rt.ctx
  const scene = rt.scene
  if (!scene) return

  const underlayCfg = rt.presentation.edges.underlay
  if (!underlayCfg.enabled) return

  ctx.save()
  ctx.fillStyle = rt.theme.bg

  const gCfg = rt.presentation.groups
  const padding = Math.max(0, gCfg.paddingPx)
  const topExtra = Math.max(0, gCfg.labelTopExtraPx)
  const radius = Math.max(0, gCfg.cornerRadiusPx)

  if (gCfg.enabled && scene.groups && scene.groups.length > 0) {
    const groups = scene.groups
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const aabb = computeFlowGroupAabb({ scene, group: g, paddingPx: padding, labelTopExtraPx: topExtra })
      if (!aabb) continue
      const w = Math.max(1, aabb.maxX - aabb.minX)
      const h = Math.max(1, aabb.maxY - aabb.minY)
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, underlayCfg.groupFadeAlpha))
      ctx.beginPath()
      if (gCfg.shape === 'rect') {
        roundRectPath(ctx, aabb.minX, aabb.minY, w, h, radius)
      } else {
        const memberIds = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
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
          geoPoints.push({ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 })
        }
        const ring = computeConvexRing(geoPoints)
        if (ring.length >= 3) {
          ctx.moveTo(ring[0].x, ring[0].y)
          for (let k = 1; k < ring.length; k += 1) ctx.lineTo(ring[k].x, ring[k].y)
          ctx.closePath()
        } else {
          roundRectPath(ctx, aabb.minX, aabb.minY, w, h, radius)
        }
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  ctx.restore()
}

const drawGroups = (rt: FlowNativeRuntime) => {
  const cfg = rt.presentation.groups
  if (!cfg.enabled) return
  const scene = rt.scene
  if (!scene?.groups || scene.groups.length === 0) return
  const ctx = rt.ctx

  const stroke = rt.theme.edge
  const fill = rt.theme.edge
  const baseStrokeWidth = Math.max(0, cfg.strokeWidthPx)
  const baseFillOpacity = Math.max(0, Math.min(1, cfg.fillOpacity))
  const padding = Math.max(0, cfg.paddingPx)
  const topExtra = Math.max(0, cfg.labelTopExtraPx)
  const radius = Math.max(0, cfg.cornerRadiusPx)
  const labelFill = resolveCssVarCached(rt, '--kg-text-secondary', rt.theme.text)

  const groups = scene.groups
  let maxDepth = 0
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
    maxDepth = Math.max(maxDepth, depth)
  }
  const depthCfg = cfg.depthStyle
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const memberIds = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    if (memberIds.length === 0) continue

    const aabb = computeFlowGroupAabb({ scene, group: g, paddingPx: padding, labelTopExtraPx: topExtra })
    if (!aabb) continue

    const minX = aabb.minX
    const minY = aabb.minY
    const maxX = aabb.maxX
    const maxY = aabb.maxY
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
      geoPoints.push({ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 })
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)

    const gStroke = resolveColor(rt, g.style?.stroke, stroke)
    const gFill = resolveColor(rt, g.style?.fill, fill)
    const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
    const depthStyle = computeGroupDepthStyle({
      depth,
      maxDepth,
      baseStrokeWidthPx: baseStrokeWidth,
      baseFillOpacity,
      config: depthCfg,
    })
    const gStrokeWidth =
      typeof g.style?.strokeWidth === 'number' && Number.isFinite(g.style.strokeWidth) ? Math.max(0, g.style.strokeWidth) : depthStyle.strokeWidthPx

    ctx.save()
    ctx.globalAlpha = depthStyle.fillOpacity
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
      const fontSizePx = 12
      ctx.font = `600 ${fontSizePx}px ${rt.fontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const maxChars = estimateMaxCharsForWidthPx(Math.max(0, w - 20), fontSizePx)
      ctx.fillText(truncateTextWithEllipsis(label, maxChars), minX + 10, minY + 8)
      ctx.restore()
    }
  }
}

export type FlowNativeDrawArgs = {
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  hideNodeIds?: string[]
  hidePortHandleNodeIds?: string[]
  renderEdges?: boolean
  renderGroups?: boolean
  renderNodes?: boolean
}

export const drawFlowNative = (rt: FlowNativeRuntime, args: FlowNativeDrawArgs) => {
  refreshFlowNativeCss(rt)
  if (!rt.dirty) return
  rt.dirty = false
  clearCanvas(rt)

  const ctx = rt.ctx
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = rt.theme.bg
  ctx.fillRect(0, 0, rt.canvas.width, rt.canvas.height)

  applyDprAndWorldTransform(rt)

  const scene = rt.scene
  if (!scene) return
  const selectedNodeIds = new Set<string>(args.selectedNodeIds || [])
  const selectedEdgeIds = new Set<string>(args.selectedEdgeIds || [])
  const hiddenNodeIds = new Set<string>(args.hideNodeIds || [])
  const hiddenPortHandleNodeIds = new Set<string>(args.hidePortHandleNodeIds || [])
  const renderEdges = args.renderEdges !== false
  const renderGroups = args.renderGroups !== false
  const renderNodes = args.renderNodes !== false

  if (renderEdges) {
    const routingCfg = rt.presentation.edges.routing
    const useOrtho = routingCfg.enabled && routingCfg.mode === 'ortho'
    const useObstacles = useOrtho && routingCfg.obstacleAvoidance
    const routingObstacles = useObstacles ? buildRoutingObstacles(rt, scene) : null

    for (let i = 0; i < scene.edges.length; i += 1) {
      const e = scene.edges[i]
      const s = scene.nodeById.get(e.source)
      const t = scene.nodeById.get(e.target)
      if (!s || !t) continue
      drawEdge(rt, e, { selected: selectedEdgeIds.has(e.id), source: s, target: t, routingObstacles })
    }

    fadeEdgesUnderGeometry(rt)
  }

  if (renderGroups) drawGroups(rt)

  if (renderNodes) {
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const n = scene.nodes[i]
      if (hiddenNodeIds.has(n.id)) {
        if (!hiddenPortHandleNodeIds.has(n.id)) drawPortHandles(rt, n)
        continue
      }
      drawNode(rt, n, { selected: selectedNodeIds.has(n.id) })
      if (!hiddenPortHandleNodeIds.has(n.id)) drawPortHandles(rt, n)
    }
  }
}

export const requestFlowNativeDraw = (
  rt: FlowNativeRuntime,
  args: FlowNativeDrawArgs,
) => {
  if (rt.pendingRaf != null) return
  rt.pendingRaf = requestAnimationFrame(() => {
    rt.pendingRaf = null
    drawFlowNative(rt, args)
  })
}
