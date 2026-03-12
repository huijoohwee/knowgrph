import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeRenderRadius, getThreeConfig } from '@/lib/graph/schema'
import { getEdgeBaseStroke, getNodeBaseFill } from '@/lib/graph/visualStyles'
import { computePositions3d } from '@/features/three/positions'
import { getEdgeStrokeWidth, getLayerOpacity, getVisualOpacity } from '@/components/GraphCanvas/helpers'

const SVG_NS = 'http://www.w3.org/2000/svg'

const clampFinite = (n: unknown, min: number, max: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : NaN
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

const escapeXml = (s: string): string => {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const readCssVar = (name: string, fallback: string): string => {
  try {
    if (typeof document === 'undefined') return fallback
    const el = document.documentElement
    const direct = String(el.style.getPropertyValue(name) || '').trim()
    if (direct) return direct
    const raw = String(getComputedStyle(el).getPropertyValue(name) || '').trim()
    return raw || fallback
  } catch {
    return fallback
  }
}

const resolveCssColor = (value: string, fallback: string): string => {
  let v = String(value || '').trim()
  if (!v) return fallback
  if (v.startsWith('--')) {
    v = readCssVar(v as `--${string}`, fallback || v)
  }
  for (let depth = 0; depth < 6; depth += 1) {
    const m = v.match(/^var\(\s*(--[^,\s\)]+)\s*(?:,\s*([^)]+)\s*)?\)$/i)
    if (!m) break
    const varName = String(m[1] || '').trim()
    const varFallback = String(m[2] || '').trim()
    const resolved = varName ? readCssVar(varName, varFallback || fallback || v) : ''
    const next = String(resolved || '').trim()
    if (!next || next === v) break
    v = next
  }
  if (v.startsWith('--')) {
    v = readCssVar(v as `--${string}`, fallback || v)
  }
  try {
    if (typeof document === 'undefined') return v
    const body = document.body
    if (!body) return v
    const el = document.createElement('span')
    el.style.color = v
    el.style.display = 'none'
    body.appendChild(el)
    const computed = String(getComputedStyle(el).color || '').trim()
    body.removeChild(el)
    return computed || v
  } catch {
    return v
  }
}

const estimateLabelWidthPx = (label: string, fontSizePx: number) => {
  const len = Math.max(0, String(label || '').length)
  return Math.max(0, Math.round(len * fontSizePx * 0.56))
}

type Vec3 = [number, number, number]

const rotateY = (p: Vec3, a: number): Vec3 => {
  const [x, y, z] = p
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

const rotateX = (p: Vec3, a: number): Vec3 => {
  const [x, y, z] = p
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x, y * c - z * s, y * s + z * c]
}

const projectPerspective = (p: Vec3, cameraZ: number): { x: number; y: number; k: number; z: number } => {
  const z = p[2]
  const denom = Math.max(1e-3, cameraZ - z)
  const k = cameraZ / denom
  return { x: p[0] * k, y: p[1] * k, k, z }
}

const parseRgba = (value: string): { color: string; alpha: number } | null => {
  const m = String(value || '').trim().match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  const a = Number(m[4])
  if (![r, g, b, a].every(Number.isFinite)) return null
  const rr = Math.max(0, Math.min(255, Math.floor(r)))
  const gg = Math.max(0, Math.min(255, Math.floor(g)))
  const bb = Math.max(0, Math.min(255, Math.floor(b)))
  const aa = Math.max(0, Math.min(1, a))
  return { color: `rgb(${rr}, ${gg}, ${bb})`, alpha: aa }
}

const parseHsla = (value: string): { color: string; alpha: number } | null => {
  const m = String(value || '').trim().match(/^hsla\(\s*([-0-9.]+)\s*(?:deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (!m) return null
  const h = Number(m[1])
  const s = Number(m[2])
  const l = Number(m[3])
  const a = Number(m[4])
  if (![h, s, l, a].every(Number.isFinite)) return null
  const hh = Math.round(h * 1000) / 1000
  const ss = Math.max(0, Math.min(100, Math.round(s * 1000) / 1000))
  const ll = Math.max(0, Math.min(100, Math.round(l * 1000) / 1000))
  const aa = Math.max(0, Math.min(1, a))
  return { color: `hsl(${hh}deg ${ss}% ${ll}%)`, alpha: aa }
}

const splitCssColorAlpha = (value: string): { color: string; alpha: number } => {
  const v = String(value || '').trim()
  const rgba = parseRgba(v)
  if (rgba) return rgba
  const hsla = parseHsla(v)
  if (hsla) return hsla
  return { color: v, alpha: 1 }
}

const computeCenteredViewBoxForAspect = (args: {
  halfW: number
  halfH: number
  outAspect: number
  padding: number
}): { x: number; y: number; w: number; h: number } => {
  const padding = Math.max(0, args.padding)
  const baseHalfW = Math.max(1, args.halfW + padding)
  const baseHalfH = Math.max(1, args.halfH + padding)

  const outAspect = Number.isFinite(args.outAspect) && args.outAspect > 0 ? args.outAspect : 16 / 9
  let halfW = baseHalfW
  let halfH = baseHalfH
  const boxAspect = halfW / halfH
  if (boxAspect < outAspect) {
    halfW = halfH * outAspect
  } else if (boxAspect > outAspect) {
    halfH = halfW / outAspect
  }
  const w = halfW * 2
  const h = halfH * 2
  return { x: -halfW, y: -halfH, w, h }
}

export function exportGraphAsCentered3dSvgMarkup(args: {
  graphData: GraphData
  schema: GraphSchema
  widthPx?: number
  heightPx?: number
  paddingPx?: number
  includeXmlDeclaration?: boolean
  animated?: boolean
  durationSec?: number
  frames?: number
  threeEdgeRenderer?: 'mesh' | 'shaderLine'
  exportAutoRotate?: boolean
  exportAutoRotateSpeed?: number
  exportMotionIntensityMultiplier?: number
  exportTiltXRad?: number
  exportCameraZ?: number
  exportDepthOpacityMin?: number
  exportDepthOpacityMax?: number
}): string | null {
  try {
    const graph = args.graphData
    const schema = args.schema
    const nodesRaw = Array.isArray(graph.nodes) ? (graph.nodes as GraphNode[]) : []
    const edgesRaw = Array.isArray(graph.edges) ? (graph.edges as GraphEdge[]) : []
    const nodes: GraphNode[] = nodesRaw.filter(n => n && String(n.id || '').trim())
    const edges: GraphEdge[] = edgesRaw.filter(e => e && String(e.source || '').trim() && String(e.target || '').trim())
    if (nodes.length === 0) return null

    const widthPx = Math.max(1, Math.floor(clampFinite(args.widthPx, 1, 16384) || 1280))
    const heightPx = Math.max(1, Math.floor(clampFinite(args.heightPx, 1, 16384) || 720))
    const paddingPx = clampFinite(args.paddingPx, 0, 2000) || 96
    const includeXmlDeclaration = args.includeXmlDeclaration !== false
    const animated = args.animated !== false
    const durationSec = clampFinite(args.durationSec, 1, 60) || 6
    const frames = Math.max(6, Math.min(60, Math.floor(clampFinite(args.frames, 1, 200) || 24)))
    const threeEdgeRenderer = args.threeEdgeRenderer === 'shaderLine' ? 'shaderLine' : 'mesh'

    const canvasBg = resolveCssColor(readCssVar('--kg-canvas-bg', 'white'), 'white')
    const labelFillResolved = resolveCssColor(
      readCssVar('--kg-canvas-label-fill', readCssVar('--kg-text-primary', 'rgba(0,0,0,0.86)')),
      'rgba(0,0,0,0.86)',
    )
    const nodeStrokeResolved = resolveCssColor(
      readCssVar('--kg-canvas-node-stroke', readCssVar('--kg-border', 'rgba(0,0,0,0.45)')),
      'rgba(0,0,0,0.45)',
    )
    const labelFillParsed = splitCssColorAlpha(labelFillResolved)
    const nodeStrokeParsed = splitCssColorAlpha(nodeStrokeResolved)

    const positions = computePositions3d(nodes, schema)
    const posById = new Map<string, Vec3>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const id = String(n.id || '').trim()
      const p = positions[id]
      if (!id || !p) continue
      posById.set(id, [p[0], p[1], p[2]])
    }
    if (posById.size === 0) return null

    let sumX = 0, sumY = 0, sumZ = 0, count = 0
    for (const p of posById.values()) {
      sumX += p[0]
      sumY += p[1]
      sumZ += p[2]
      count += 1
    }
    if (!(count > 0)) return null
    const cx = sumX / count
    const cy = sumY / count
    const cz = sumZ / count

    const fontSizePx = 12
    const labelPadY = 8
    const cameraZ = typeof args.exportCameraZ === 'number' && Number.isFinite(args.exportCameraZ)
      ? Math.max(80, Math.min(1200, args.exportCameraZ))
      : 220
    const tiltX = typeof args.exportTiltXRad === 'number' && Number.isFinite(args.exportTiltXRad)
      ? Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, args.exportTiltXRad))
      : 0

    let minZ = Infinity
    let maxZ = -Infinity
    for (const p of posById.values()) {
      if (p[2] < minZ) minZ = p[2]
      if (p[2] > maxZ) maxZ = p[2]
    }
    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
      minZ = -1
      maxZ = 1
    }
    const depthOpacity = (z: number) => {
      const span = Math.max(1e-6, maxZ - minZ)
      const t = Math.max(0, Math.min(1, (z - minZ) / span))
      const oMinRaw = typeof args.exportDepthOpacityMin === 'number' && Number.isFinite(args.exportDepthOpacityMin) ? args.exportDepthOpacityMin : 0.35
      const oMaxRaw = typeof args.exportDepthOpacityMax === 'number' && Number.isFinite(args.exportDepthOpacityMax) ? args.exportDepthOpacityMax : 1
      const oMin = Math.max(0, Math.min(1, oMinRaw))
      const oMax = Math.max(oMin, Math.min(1, oMaxRaw))
      return oMin + (oMax - oMin) * t
    }

    let maxAbsX = 1
    let maxAbsY = 1

    const threeCfg = getThreeConfig(schema)
    const motionRaw = threeCfg.nodeMotionIntensity
    const motionBase = typeof motionRaw === 'number' ? Math.max(0, Math.min(2, motionRaw)) : 1
    const motionMulRaw = typeof args.exportMotionIntensityMultiplier === 'number' && Number.isFinite(args.exportMotionIntensityMultiplier)
      ? args.exportMotionIntensityMultiplier
      : 1
    const motion = Math.max(0, Math.min(3, motionBase * Math.max(0, Math.min(3, motionMulRaw))))

    const amp = 0.2 * motion

    const autoRotateBase = !!threeCfg.cameraAutoRotate
    const autoRotate = autoRotateBase || args.exportAutoRotate === true
    const autoRotateSpeedBase = typeof threeCfg.cameraAutoRotateSpeed === 'number' ? threeCfg.cameraAutoRotateSpeed : 0.4
    const autoRotateSpeed = typeof args.exportAutoRotateSpeed === 'number' && Number.isFinite(args.exportAutoRotateSpeed)
      ? args.exportAutoRotateSpeed
      : autoRotateSpeedBase
    const omega = (Math.PI * 2 / 60) * (autoRotate ? (autoRotateSpeed || 0) : 0)

    const angleSamples = (() => {
      if (!animated || !autoRotate || omega === 0) return [0]
      const out: number[] = []
      for (let f = 0; f < frames; f += 1) {
        out.push((Math.PI * 2 * f) / frames)
      }
      out.push(out[0]!)
      return out
    })()

    const nodeById = (() => {
      const m = new Map<string, GraphNode>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n?.id || '').trim()
        if (!id) continue
        m.set(id, n)
      }
      return m
    })()

    for (let ai = 0; ai < angleSamples.length; ai += 1) {
      const angY = angleSamples[ai]!
      for (const [id, p0] of posById.entries()) {
        const t = 0
        const wobX = amp > 0 ? Math.sin(t * 0.2 + id.length) * amp : 0
        const wobY = amp > 0 ? Math.cos(t * 0.25 + id.length) * amp : 0
        const p: Vec3 = [p0[0] - cx + wobX, p0[1] - cy + wobY, p0[2] - cz]
        const ry = rotateY(p, angY)
        const rxy = rotateX(ry, tiltX)
        const pr = projectPerspective(rxy, cameraZ)
        const node = nodeById.get(id)
        const baseR = Math.max(4, node ? (getNodeRenderRadius(node, schema) || 10) : 10)
        const r = baseR * pr.k
        const label = String(node?.label || id)
        const labelW = estimateLabelWidthPx(label, fontSizePx)
        const left = pr.x - Math.max(r, labelW / 2)
        const right = pr.x + Math.max(r, labelW / 2)
        const top = pr.y - r - (fontSizePx + labelPadY)
        const bottom = pr.y + r
        maxAbsX = Math.max(maxAbsX, Math.abs(left), Math.abs(right))
        maxAbsY = Math.max(maxAbsY, Math.abs(top), Math.abs(bottom))
      }
    }

    const vb = computeCenteredViewBoxForAspect({ halfW: maxAbsX, halfH: maxAbsY, outAspect: widthPx / heightPx, padding: paddingPx })

    const fmt = (n: number) => {
      const v = Math.round(n * 100) / 100
      return Number.isFinite(v) ? String(v) : '0'
    }
    const fmtOp = (n: number) => {
      const v = Math.max(0, Math.min(1, Math.round(n * 1000) / 1000))
      return String(v)
    }

    const colorCache = new Map<string, { color: string; alpha: number }>()
    const resolveColorAlpha = (raw: string): { color: string; alpha: number } => {
      const key = String(raw || '').trim()
      if (!key) return { color: '', alpha: 1 }
      const cached = colorCache.get(key)
      if (cached) return cached
      const resolved = resolveCssColor(key, key)
      const parsed = splitCssColorAlpha(resolved)
      colorCache.set(key, parsed)
      return parsed
    }

    const nodeData = nodes.map(n => {
      const id = String(n.id || '').trim()
      const p = posById.get(id) || [0, 0, 0]
      const baseR = Math.max(4, getNodeRenderRadius(n, schema) || 10)
      const fillRaw = String(getNodeBaseFill(n, schema) || '')
      const fillParsed = resolveColorAlpha(fillRaw)
      const label = String(n.label || id)
      const layerOpacity = Math.max(0, Math.min(1, getLayerOpacity(n, schema) * getVisualOpacity(n)))
      return { id, p, baseR, fill: fillParsed.color, fillAlpha: fillParsed.alpha, label, layerOpacity }
    }).filter(x => x.id)

    const edgeData = edges.map(e => {
      const id = String(e.id || '').trim()
      const s = String(e.source || '').trim()
      const t = String(e.target || '').trim()
      const props = (e.properties || {}) as Record<string, unknown>
      const rawStroke = String(getEdgeBaseStroke(e, schema) || '')
      const strokeParsed = resolveColorAlpha(rawStroke)
      const baseWidth = (() => {
        const w = getEdgeStrokeWidth(e, schema)
        const clamped = Math.max(0.5, Math.min(5, w))
        return clamped
      })()
      const linkOpacityDefault = typeof threeCfg.linkOpacity === 'number' ? Math.max(0, Math.min(1, threeCfg.linkOpacity)) : 0.6
      const opacityByLabel: Record<string, number> = threeCfg.edgeOpacityByLabel || {}
      const cfgOpacity = typeof opacityByLabel[e.label] === 'number' ? Math.max(0, Math.min(1, opacityByLabel[e.label] as number)) : linkOpacityDefault
      const propOpacity = typeof props['opacity'] === 'number' ? Math.max(0, Math.min(1, props['opacity'] as number)) : null
      const baseOpacity = propOpacity == null ? cfgOpacity : propOpacity
      return { id, s, t, stroke: strokeParsed.color, baseWidth, baseOpacity, strokeAlpha: strokeParsed.alpha }
    }).filter(x => x.id && x.s && x.t)

    const projectAt = (id: string, p0: Vec3, angY: number, tSec: number) => {
      const wobX = amp > 0 ? Math.sin(tSec * 0.2 + id.length) * amp : 0
      const wobY = amp > 0 ? Math.cos(tSec * 0.25 + id.length) * amp : 0
      const p: Vec3 = [p0[0] - cx + wobX, p0[1] - cy + wobY, p0[2] - cz]
      const ry = rotateY(p, angY)
      const rxy = rotateX(ry, tiltX)
      return projectPerspective(rxy, cameraZ)
    }

    const nodeParts: string[] = []
    const nodeFrame0 = new Map<string, { x: number; y: number; k: number; z: number }>()
    for (let i = 0; i < nodeData.length; i += 1) {
      const nd = nodeData[i]!
      const pr = projectAt(nd.id, nd.p as Vec3, 0, 0)
      nodeFrame0.set(nd.id, pr)
      const r = nd.baseR * pr.k
      const op = depthOpacity(pr.z) * Math.max(0, Math.min(1, nd.layerOpacity))
      const fillOp = op * (typeof nd.fillAlpha === 'number' && Number.isFinite(nd.fillAlpha) ? Math.max(0, Math.min(1, nd.fillAlpha)) : 1)
      const strokeOp = op * Math.max(0, Math.min(1, nodeStrokeParsed.alpha))
      const textOp = op * Math.max(0, Math.min(1, labelFillParsed.alpha))
      nodeParts.push(
        `<g data-node-id="${escapeXml(nd.id)}">` +
          `<circle data-role="node-circle" cx="${fmt(pr.x)}" cy="${fmt(pr.y)}" r="${fmt(r)}" fill="${escapeXml(nd.fill)}" stroke="${escapeXml(nodeStrokeParsed.color)}" stroke-width="1" fill-opacity="${fmtOp(fillOp)}" stroke-opacity="${fmtOp(strokeOp)}"/>` +
          `<text data-role="node-label" x="${fmt(pr.x)}" y="${fmt(pr.y - r - labelPadY)}" font-size="${fontSizePx}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" text-anchor="middle" fill="${escapeXml(labelFillParsed.color)}" opacity="${fmtOp(textOp)}">${escapeXml(nd.label)}</text>` +
        `</g>`,
      )
    }

    const edgeParts: string[] = []
    for (let i = 0; i < edgeData.length; i += 1) {
      const ed = edgeData[i]!
      const ps = nodeFrame0.get(ed.s)
      const pt = nodeFrame0.get(ed.t)
      if (!ps || !pt) continue
      const op = Math.min(depthOpacity(ps.z), depthOpacity(pt.z)) * Math.max(0, Math.min(1, ed.baseOpacity)) * Math.max(0, Math.min(1, ed.strokeAlpha))
      const kAvg = (ps.k + pt.k) * 0.5
      const w = Math.max(0.25, ed.baseWidth * kAvg)
      edgeParts.push(
        `<line data-edge-id="${escapeXml(ed.id)}" data-source="${escapeXml(ed.s)}" data-target="${escapeXml(ed.t)}" x1="${fmt(ps.x)}" y1="${fmt(ps.y)}" x2="${fmt(pt.x)}" y2="${fmt(pt.y)}" stroke="${escapeXml(ed.stroke)}" stroke-width="${fmt(w)}" stroke-opacity="${fmtOp(op)}" stroke-linecap="round"/>`,
      )
    }

    const scriptPayload = escapeXml(
      JSON.stringify({
        cameraZ,
        tiltX,
        cx,
        cy,
        cz,
        minZ,
        maxZ,
        fontSizePx,
        labelPadY,
        animated,
        autoRotate,
        autoRotateSpeed,
        motion,
        nodeStrokeAlpha: nodeStrokeParsed.alpha,
        labelFillAlpha: labelFillParsed.alpha,
        nodes: nodeData.map(n => ({
          id: n.id,
          p: n.p,
          baseR: n.baseR,
          layerOpacity: n.layerOpacity,
          fillAlpha: typeof n.fillAlpha === 'number' && Number.isFinite(n.fillAlpha) ? n.fillAlpha : 1,
        })),
        edges: edgeData,
      }),
    )

    const script =
      `<script><![CDATA[` +
        `(function(){` +
          `var root=(document.currentScript&&document.currentScript.ownerSVGElement)||document.documentElement;` +
          `if(!root||String(root.nodeName||'').toLowerCase()!=='svg')return;` +
          `var payload=JSON.parse(root.getAttribute('data-kg-3d-payload')||'{}');` +
          `if(!payload||payload.animated!==true)return;` +
          `var nodes=Array.isArray(payload.nodes)?payload.nodes:[];` +
          `var edges=Array.isArray(payload.edges)?payload.edges:[];` +
          `var cameraZ=Number(payload.cameraZ)||220;` +
          `var tiltX=Number(payload.tiltX)||0;` +
          `var cx=Number(payload.cx)||0,cy=Number(payload.cy)||0,cz=Number(payload.cz)||0;` +
          `var minZ=Number(payload.minZ)||-1,maxZ=Number(payload.maxZ)||1;` +
          `var zSpan=Math.max(1e-6,maxZ-minZ);` +
          `var depthOpacity=function(z){var t=(Number(z)-minZ)/zSpan;if(!isFinite(t))t=0;t=Math.max(0,Math.min(1,t));return 0.35+0.65*t;};` +
          `var nodeStrokeAlpha=Number(payload.nodeStrokeAlpha);if(!isFinite(nodeStrokeAlpha))nodeStrokeAlpha=1;` +
          `var labelFillAlpha=Number(payload.labelFillAlpha);if(!isFinite(labelFillAlpha))labelFillAlpha=1;` +
          `var motionRaw=Number(payload.motion);var motion=(isFinite(motionRaw)?Math.max(0,Math.min(2,motionRaw)):1);` +
          `var amp=0.2*motion;` +
          `var autoRotate=payload.autoRotate===true;` +
          `var autoRotateSpeed=Number(payload.autoRotateSpeed);` +
          `if(!isFinite(autoRotateSpeed))autoRotateSpeed=0.4;` +
          `var omega=(Math.PI*2/60)*(autoRotate?autoRotateSpeed:0);` +
          `var labelPadY=Number(payload.labelPadY);if(!isFinite(labelPadY))labelPadY=8;` +
          `var nodeEls=new Map();` +
          `var nodeOffsetById=root.__kgNodeOffsetById||(root.__kgNodeOffsetById={});` +
          `var nodeGs=root.querySelectorAll('[data-node-id]');` +
          `for(var gi=0;gi<nodeGs.length;gi++){var g=nodeGs[gi];var gid=String(g.getAttribute('data-node-id')||'');if(!gid)continue;var c=g.querySelector('[data-role="node-circle"]');var t=g.querySelector('[data-role="node-label"]');if(c&&t)nodeEls.set(gid,{g:g,c:c,t:t});}` +
          `var edgeElById=new Map();` +
          `var edgeLs=root.querySelectorAll('[data-edge-id]');` +
          `for(var li=0;li<edgeLs.length;li++){var el=edgeLs[li];var eid=String(el.getAttribute('data-edge-id')||'');if(eid)edgeElById.set(eid,el);}` +
          `var edgeEls=[];` +
          `for(var j=0;j<edges.length;j++){var eid=String(edges[j].id||'');if(!eid)continue;var el=edgeElById.get(eid);if(!el)continue;edgeEls.push({id:eid,el:el,s:String(edges[j].s||edges[j].source||''),t:String(edges[j].t||edges[j].target||''),baseWidth:Number(edges[j].baseWidth)||1,baseOpacity:Number(edges[j].baseOpacity)||0.6,strokeAlpha:Number(edges[j].strokeAlpha)||1});}` +
          `var rotateY=function(x,y,z,a){var c=Math.cos(a),s=Math.sin(a);return [x*c+z*s,y,-x*s+z*c];};` +
          `var rotateX=function(x,y,z,a){var c=Math.cos(a),s=Math.sin(a);return [x,y*c-z*s,y*s+z*c];};` +
          `var project=function(x,y,z){var denom=Math.max(1e-3,cameraZ-z);var k=cameraZ/denom;return {x:x*k,y:y*k,k:k,z:z};};` +
          `var started=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();` +
          `var lastSortAt=0;` +
          `var tick=function(){` +
            `var now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();` +
            `var tSec=(now-started)/1000;` +
            `var ang=omega*tSec;` +
            `var projById=new Map();` +
            `var nodeOrder=[];` +
            `for(var i2=0;i2<nodes.length;i2++){` +
              `var nd=nodes[i2];var id=String(nd.id||'');if(!id)continue;` +
              `var p=nd.p||[0,0,0];` +
              `var wobX=amp>0?Math.sin(tSec*0.2+id.length)*amp:0;` +
              `var wobY=amp>0?Math.cos(tSec*0.25+id.length)*amp:0;` +
              `var x=(Number(p[0])||0)-cx+wobX;var y=(Number(p[1])||0)-cy+wobY;var z=(Number(p[2])||0)-cz;` +
              `var r1=rotateY(x,y,z,ang);var r2=rotateX(r1[0],r1[1],r1[2],tiltX);` +
              `var pr=project(r2[0],r2[1],r2[2]);` +
              `var off=nodeOffsetById[id];if(off){pr.x+=Number(off.x)||0;pr.y+=Number(off.y)||0;}` +
              `projById.set(id,pr);` +
              `nodeOrder.push({id:id,z:pr.z});` +
              `var el=nodeEls.get(id);if(!el)continue;` +
              `var baseR=Number(nd.baseR)||10;var r=baseR*pr.k;` +
              `var op=depthOpacity(pr.z)*(isFinite(nd.layerOpacity)?Math.max(0,Math.min(1,nd.layerOpacity)):1);` +
              `var fillAlpha=isFinite(nd.fillAlpha)?Math.max(0,Math.min(1,Number(nd.fillAlpha))):1;` +
              `el.c.setAttribute('cx',String(pr.x));el.c.setAttribute('cy',String(pr.y));el.c.setAttribute('r',String(r));` +
              `el.c.setAttribute('fill-opacity',String(op*fillAlpha));el.c.setAttribute('stroke-opacity',String(op*nodeStrokeAlpha));` +
              `el.t.setAttribute('x',String(pr.x));el.t.setAttribute('y',String(pr.y-r-labelPadY));el.t.setAttribute('opacity',String(op*labelFillAlpha));` +
            `}` +
            `var edgeOrder=[];` +
            `for(var e2=0;e2<edgeEls.length;e2++){` +
              `var ed=edgeEls[e2];var ps=projById.get(ed.s);var pt=projById.get(ed.t);` +
              `if(!ps||!pt)continue;` +
              `var opEdge=Math.min(depthOpacity(ps.z),depthOpacity(pt.z))*Math.max(0,Math.min(1,ed.baseOpacity))*Math.max(0,Math.min(1,Number(ed.strokeAlpha)||1));` +
              `var kAvg=(ps.k+pt.k)*0.5;` +
              `var w=Math.max(0.25,(ed.baseWidth||1)*kAvg);` +
              `ed.el.setAttribute('x1',String(ps.x));ed.el.setAttribute('y1',String(ps.y));ed.el.setAttribute('x2',String(pt.x));ed.el.setAttribute('y2',String(pt.y));` +
              `ed.el.setAttribute('stroke-opacity',String(opEdge));ed.el.setAttribute('stroke-width',String(w));` +
              `edgeOrder.push({id:ed.id,z:(ps.z+pt.z)*0.5,el:ed.el});` +
            `}` +
            `var nodesGroup=root.querySelector('[data-layer="nodes"]');` +
            `var edgesGroup=root.querySelector('[data-layer="edges"]');` +
            `if(nodesGroup&&edgesGroup){` +
              `if(now-lastSortAt>33){` +
                `lastSortAt=now;` +
                `nodeOrder.sort(function(a,b){return a.z-b.z;});` +
                `for(var si=0;si<nodeOrder.length;si++){var ne=nodeEls.get(nodeOrder[si].id);if(ne&&ne.g)nodesGroup.appendChild(ne.g);}` +
                `edgeOrder.sort(function(a,b){return a.z-b.z;});` +
                `for(var sj=0;sj<edgeOrder.length;sj++){edgesGroup.appendChild(edgeOrder[sj].el);}` +
              `}` +
            `}` +
            `requestAnimationFrame(tick);` +
          `};` +
          `requestAnimationFrame(tick);` +
        `})();` +
      `]]></script>`

    const svg =
      `<svg xmlns="${SVG_NS}" width="${widthPx}" height="${heightPx}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet" data-kg-3d-payload="${scriptPayload}">` +
        `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${escapeXml(canvasBg)}"/>` +
        `<g data-layer="edges">${edgeParts.join('')}</g>` +
        `<g data-layer="nodes">${nodeParts.join('')}</g>` +
        script +
      `</svg>`

    return includeXmlDeclaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n` : svg
  } catch {
    return null
  }
}
