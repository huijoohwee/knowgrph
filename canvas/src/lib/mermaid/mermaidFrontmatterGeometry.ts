import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { getKgThemeFromDom } from '@/lib/ui/tokens-ssot'
import { renderMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'

type MermaidTheme = 'light' | 'dark'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const hash01 = (id: string): number => {
  let h = 2166136261
  const s = String(id || '')
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

type MermaidNodeGeometry = {
  name: string
  cx: number
  cy: number
  shape: 'rect' | 'circle'
  width: number
  height: number
  radius: number | null
  order: number
  imageUrl: string | null
}

type MermaidEdgeGeometry = {
  key: string
  sourceName: string
  targetName: string
  pathD: string
  arrowD: string | null
  labelX: number | null
  labelY: number | null
  order: number
  tx: number
  ty: number
}

type MermaidClusterGeometry = {
  name: string
  x: number
  y: number
  width: number
  height: number
  labelX: number | null
  labelY: number | null
  order: number
}

const parseTranslate = (raw: string | null): { x: number; y: number } | null => {
  const s = String(raw || '').trim()
  if (!s) return null
  const m = /translate\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(?:,|\s)\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/i.exec(s)
  if (!m) return null
  const x = Number(m[1])
  const y = Number(m[2])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

const readAttr = (el: Element, key: string): string => {
  const v = el.getAttribute(key)
  return typeof v === 'string' ? v : ''
}

const coerceNumber = (v: string): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeName = (raw: string): string => String(raw || '').trim()

const pathMaxAbsNumber = (d: string): number => {
  const s = String(d || '')
  if (!s) return 0
  const m = s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (!m || m.length === 0) return 0
  let best = 0
  for (let i = 0; i < m.length; i += 1) {
    const n = Number(m[i])
    if (!Number.isFinite(n)) continue
    const a = Math.abs(n)
    if (a > best) best = a
  }
  return best
}

const pathFirstMoveAbsMax = (d: string): number => {
  const s = String(d || '').trim()
  if (!s) return 0
  const m = /^\s*M\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,?\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i.exec(s)
  if (!m) return 0
  const x = Number(m[1])
  const y = Number(m[2])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0
  return Math.max(Math.abs(x), Math.abs(y))
}

const extractNodeName = (g: Element): string => {
  const dataId = normalizeName(readAttr(g, 'data-id'))
  if (dataId) return dataId
  const id = normalizeName(readAttr(g, 'id'))
  if (!id) return ''
  const m1 = /^flowchart-(.+?)(?:-\d+)?$/.exec(id)
  if (m1) return normalizeName(m1[1])
  const m2 = /^graph-(.+?)(?:-\d+)?$/.exec(id)
  if (m2) return normalizeName(m2[1])
  return id
}

const extractClusterName = (g: Element): string => {
  const dataId = normalizeName(readAttr(g, 'data-id'))
  if (dataId) return dataId
  const id = normalizeName(readAttr(g, 'id'))
  if (!id) return ''
  const m1 = /^cluster-(.+)$/.exec(id)
  if (m1) return normalizeName(m1[1])
  return id
}

const extractEdgeSrcTgt = (g: Element): { source: string; target: string } | null => {
  const dataId = normalizeName(readAttr(g, 'data-id'))
  const id = dataId || normalizeName(readAttr(g, 'id'))
  if (!id) return null
  const direct = /^L-([A-Za-z0-9_.-]+)-([A-Za-z0-9_.-]+)(?:-\d+)?$/.exec(id)
  if (direct) return { source: normalizeName(direct[1]), target: normalizeName(direct[2]) }
  const stripped = id.replace(/-\d+$/g, '')
  if (!stripped.startsWith('L-')) return null
  const rest = stripped.slice(2)
  const parts = rest.split('-').filter(Boolean)
  if (parts.length < 2) return null
  const target = parts[parts.length - 1]!
  const source = parts.slice(0, parts.length - 1).join('-')
  if (!source || !target) return null
  return { source: normalizeName(source), target: normalizeName(target) }
  return null
}

const parseMermaidSvgGeometry = (svgMarkup: string): {
  nodes: MermaidNodeGeometry[]
  edges: MermaidEdgeGeometry[]
  clusters: MermaidClusterGeometry[]
} => {
  const svg = String(svgMarkup || '').trim()
  if (!svg) return { nodes: [], edges: [], clusters: [] }
  if (typeof DOMParser === 'undefined') return { nodes: [], edges: [], clusters: [] }
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (!root) return { nodes: [], edges: [], clusters: [] }

  const nodes: MermaidNodeGeometry[] = []
  const nodeEls = Array.from(root.querySelectorAll('g.node'))
  for (let i = 0; i < nodeEls.length; i += 1) {
    const g = nodeEls[i]!
    const name = extractNodeName(g)
    if (!name) continue
    const t = parseTranslate(readAttr(g, 'transform'))
    if (!t) continue

    const imageUrl = (() => {
      const img = g.querySelector('image')
      if (!img) return null
      const href =
        String(img.getAttribute('href') || img.getAttribute('xlink:href') || '').trim()
      return href ? href : null
    })()

    const rect = g.querySelector('rect')
    if (rect) {
      const w = coerceNumber(readAttr(rect, 'width'))
      const h = coerceNumber(readAttr(rect, 'height'))
      if (!w || !h) continue
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'rect', width: w, height: h, radius: null, order: i, imageUrl })
      continue
    }

    const circle = g.querySelector('circle')
    if (circle) {
      const r = coerceNumber(readAttr(circle, 'r'))
      if (!r) continue
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'circle', width: r * 2, height: r * 2, radius: r, order: i, imageUrl })
      continue
    }

    const ellipse = g.querySelector('ellipse')
    if (ellipse) {
      const rx = coerceNumber(readAttr(ellipse, 'rx'))
      const ry = coerceNumber(readAttr(ellipse, 'ry'))
      if (!rx || !ry) continue
      const r = Math.min(rx, ry)
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'circle', width: rx * 2, height: ry * 2, radius: r, order: i, imageUrl })
      continue
    }

    const polygon = g.querySelector('polygon')
    if (polygon) {
      const pts = String(readAttr(polygon, 'points') || '').trim()
      if (!pts) continue
      const nums = pts.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []
      if (nums.length < 4) continue
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (let ni = 0; ni + 1 < nums.length; ni += 2) {
        const x = Number(nums[ni])
        const y = Number(nums[ni + 1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
      const w = Math.max(0, maxX - minX)
      const h = Math.max(0, maxY - minY)
      if (!w || !h) continue
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'rect', width: w, height: h, radius: null, order: i, imageUrl })
      continue
    }

    const foreignObject = g.querySelector('foreignObject')
    if (foreignObject) {
      const w = coerceNumber(readAttr(foreignObject, 'width'))
      const h = coerceNumber(readAttr(foreignObject, 'height'))
      if (w && h) {
        nodes.push({ name, cx: t.x, cy: t.y, shape: 'rect', width: w, height: h, radius: null, order: i, imageUrl })
        continue
      }
    }

    const path = g.querySelector('path')
    if (path) {
      const d = String(readAttr(path, 'd') || '').trim()
      if (!d) continue
      const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []
      if (nums.length < 4) continue
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (let ni = 0; ni + 1 < nums.length; ni += 2) {
        const x = Number(nums[ni])
        const y = Number(nums[ni + 1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue
      const w = Math.max(0, maxX - minX)
      const h = Math.max(0, maxY - minY)
      if (!w || !h) continue
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'rect', width: w, height: h, radius: null, order: i, imageUrl })
      continue
    }
  }

  const edges: MermaidEdgeGeometry[] = []
  const edgeEls = Array.from(root.querySelectorAll('g.edgePath'))
  for (let i = 0; i < edgeEls.length; i += 1) {
    const g = edgeEls[i]!
    const st = extractEdgeSrcTgt(g)
    if (!st) continue
    const tt = parseTranslate(readAttr(g, 'transform'))
    let tx = tt ? tt.x : 0
    let ty = tt ? tt.y : 0
    const path = g.querySelector('path.path, path')
    const pathD = path ? normalizeName(readAttr(path, 'd')) : ''
    if (!pathD) continue
    const tMag = Math.max(Math.abs(tx), Math.abs(ty))
    const dMag = pathMaxAbsNumber(pathD)
    const headMag = pathFirstMoveAbsMax(pathD)
    const shouldApplyTranslate =
      tMag > 30 &&
      ((headMag > 0 && headMag < Math.max(60, tMag * 0.35)) || (dMag > 0 && dMag < Math.max(200, tMag * 0.6)))
    if (!shouldApplyTranslate) {
      tx = 0
      ty = 0
    }
    const arrow = g.querySelector('path.arrowheadPath')
    const arrowD = arrow ? normalizeName(readAttr(arrow, 'd')) : ''
    const key = `${st.source}|${st.target}|${i}`
    edges.push({
      key,
      sourceName: st.source,
      targetName: st.target,
      pathD,
      arrowD: arrowD || null,
      labelX: null,
      labelY: null,
      order: i,
      tx,
      ty,
    })
  }

  const labelEls = Array.from(root.querySelectorAll('g.edgeLabel'))
  for (let i = 0; i < labelEls.length; i += 1) {
    const g = labelEls[i]!
    const st = extractEdgeSrcTgt(g)
    if (!st) continue
    const t = parseTranslate(readAttr(g, 'transform'))
    if (!t) continue
    for (let j = 0; j < edges.length; j += 1) {
      const e = edges[j]!
      if (e.sourceName === st.source && e.targetName === st.target && e.labelX == null && e.labelY == null) {
        e.labelX = t.x
        e.labelY = t.y
        break
      }
    }
  }

  const clusters: MermaidClusterGeometry[] = []
  const clusterEls = Array.from(root.querySelectorAll('g.cluster'))
  for (let i = 0; i < clusterEls.length; i += 1) {
    const g = clusterEls[i]!
    const name = extractClusterName(g)
    if (!name) continue
    const rect = (() => {
      const rects = Array.from(g.querySelectorAll('rect'))
      if (rects.length === 0) return null
      let best: SVGRectElement | null = null
      let bestArea = -Infinity
      for (let ri = 0; ri < rects.length; ri += 1) {
        const r = rects[ri]!
        const w = coerceNumber(readAttr(r, 'width'))
        const h = coerceNumber(readAttr(r, 'height'))
        if (!w || !h) continue
        const area = w * h
        if (area > bestArea) {
          bestArea = area
          best = r
        }
      }
      return best
    })()
    if (!rect) continue
    const w = coerceNumber(readAttr(rect, 'width'))
    const h = coerceNumber(readAttr(rect, 'height'))
    const x = coerceNumber(readAttr(rect, 'x'))
    const y = coerceNumber(readAttr(rect, 'y'))
    if (w == null || h == null || x == null || y == null) continue
    const t = parseTranslate(readAttr(g, 'transform'))
    const baseX = t ? t.x + x : x
    const baseY = t ? t.y + y : y

    let labelX: number | null = null
    let labelY: number | null = null
    const labelGroup = g.querySelector('g.label')
    const lt = labelGroup ? parseTranslate(readAttr(labelGroup, 'transform')) : null
    if (lt) {
      labelX = lt.x
      labelY = lt.y
    }
    clusters.push({ name, x: baseX, y: baseY, width: w, height: h, labelX, labelY, order: i })
  }

  return { nodes, edges, clusters }
}

const readRecordProps = (n: GraphNode): Record<string, unknown> | null => {
  const p = (n as unknown as { properties?: unknown }).properties
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  return p as Record<string, unknown>
}

const isFrontmatterMermaidDiagram = (n: GraphNode): boolean => {
  if (String(n.type || '') !== 'MermaidDiagram') return false
  const props = readRecordProps(n)
  if (!props) return false
  if (props.isMermaidFrontmatter === true) return true
  return String(props.mermaidScope || '') === 'frontmatter'
}

export function applyMermaidFrontmatterContextLayoutToGraphData(graphData: GraphData): GraphData {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  if (nodes.length === 0) return graphData

  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (id && n && !nodeById.has(id)) nodeById.set(id, n)
  }

  const outgoing = (label: string) => {
    const out = new Map<string, string[]>()
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      if (!e) continue
      if (String(e.label || '') !== label) continue
      const src = String(e.source || '').trim()
      const tgt = String(e.target || '').trim()
      if (!src || !tgt) continue
      const arr = out.get(src)
      if (arr) arr.push(tgt)
      else out.set(src, [tgt])
    }
    return out
  }

  const pointsTo = outgoing('pointsTo')
  const hasBlock = outgoing('hasBlock')
  const hasItem = outgoing('hasItem')
  const hasInternalLink = outgoing('hasInternalLink')
  const linksTo = outgoing('linksTo')
  const embedsImage = outgoing('embedsImage')
  const embedsMedia = outgoing('embedsMedia')

  const nextNodes: GraphNode[] = nodes.map(n => ({ ...n, properties: { ...(n.properties || {}) } }))
  const nextById = new Map<string, GraphNode>()
  for (let i = 0; i < nextNodes.length; i += 1) {
    const n = nextNodes[i]
    const id = String(n?.id || '').trim()
    if (id && n) nextById.set(id, n)
  }

  const setPos = (id: string, x: number, y: number) => {
    const n = nextById.get(id)
    if (!n) return
    if (isFiniteNumber(n.x) && isFiniteNumber(n.y)) return
    n.x = x
    n.y = y
    n.fx = x
    n.fy = y
    n.vx = 0
    n.vy = 0
  }

  const setZ = (id: string, z: number) => {
    const n = nextById.get(id)
    if (!n) return
    const props = (n.properties || {}) as Record<string, unknown>
    if (props['visual:zIndexMode'] !== 'absolute') props['visual:zIndexMode'] = 'absolute'
    props['visual:zIndex'] = Math.floor(z)
    n.properties = props as never
  }

  const sizeOf = (id: string): { w: number; h: number } => {
    const n = nextById.get(id)
    if (!n) return { w: 180, h: 60 }
    const props = (n.properties || {}) as Record<string, unknown>
    const vw = props['visual:width']
    const vh = props['visual:height']
    const w = typeof vw === 'number' && Number.isFinite(vw) && vw > 0 ? vw : undefined
    const h = typeof vh === 'number' && Number.isFinite(vh) && vh > 0 ? vh : undefined
    if (w && h) return { w, h }
    const type = String(n.type || '')
    if (type === 'Table') return { w: 520, h: 320 }
    if (type === 'CodeBlock') return { w: 520, h: 260 }
    if (type === 'WebpageElement') return { w: 560, h: 360 }
    if (type === 'Image') return { w: 420, h: 260 }
    if (type === 'Section') return { w: 360, h: 56 }
    if (type === 'Anchor') return { w: 280, h: 42 }
    if (type === 'InternalLink') return { w: 300, h: 52 }
    if (type === 'Link') return { w: 300, h: 52 }
    if (type === 'List') return { w: 340, h: 64 }
    if (type === 'ListItem') return { w: 360, h: 64 }
    return { w: 420, h: 92 }
  }

  const basePosById = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < nextNodes.length; i += 1) {
    const n = nextNodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (isFiniteNumber(n.x) && isFiniteNumber(n.y)) basePosById.set(id, { x: n.x, y: n.y })
  }

  const anchorPosByNodeId = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < nextNodes.length; i += 1) {
    const src = nextNodes[i]
    if (!src) continue
    if (String(src.type || '') !== 'MermaidNode') continue
    const sid = String(src.id || '').trim()
    const sp = basePosById.get(sid)
    if (!sp) continue
    const tgts = pointsTo.get(sid) || []
    for (let j = 0; j < tgts.length; j += 1) {
      const tid = String(tgts[j] || '').trim()
      const t = nodeById.get(tid)
      if (!t || String(t.type || '') !== 'Anchor') continue
      if (!anchorPosByNodeId.has(tid)) anchorPosByNodeId.set(tid, sp)
    }
  }

  const anchorIdByNodeId = new Map<string, string>()
  for (let i = 0; i < nextNodes.length; i += 1) {
    const n = nextNodes[i]
    if (!n || String(n.type || '') !== 'Anchor') continue
    const id = String(n.id || '').trim()
    const props = (n.properties || {}) as Record<string, unknown>
    const anchorId = typeof props.anchorId === 'string' ? String(props.anchorId || '').trim() : ''
    if (id && anchorId) anchorIdByNodeId.set(id, anchorId)
  }

  const anchorNodeIdByAnchorId = new Map<string, string>()
  anchorIdByNodeId.forEach((anchorId, nodeId) => {
    if (!anchorNodeIdByAnchorId.has(anchorId)) anchorNodeIdByAnchorId.set(anchorId, nodeId)
  })

  const mermaidBounds = (() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasAny = false

    for (let i = 0; i < nextNodes.length; i += 1) {
      const n = nextNodes[i]
      if (!n) continue
      const t = String(n.type || '')
      if (t === 'MermaidNode') {
        const id = String(n.id || '').trim()
        if (!id) continue
        if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
        const s = sizeOf(id)
        minX = Math.min(minX, n.x - s.w / 2)
        maxX = Math.max(maxX, n.x + s.w / 2)
        minY = Math.min(minY, n.y - s.h / 2)
        maxY = Math.max(maxY, n.y + s.h / 2)
        hasAny = true
        continue
      }
      if (t === 'MermaidSubgraph') {
        const props = (n.properties || {}) as Record<string, unknown>
        const b = props['visual:bounds']
        if (!b || typeof b !== 'object' || Array.isArray(b)) continue
        const bx = typeof (b as any).x === 'number' ? (b as any).x : Number.NaN
        const by = typeof (b as any).y === 'number' ? (b as any).y : Number.NaN
        const bw = typeof (b as any).width === 'number' ? (b as any).width : Number.NaN
        const bh = typeof (b as any).height === 'number' ? (b as any).height : Number.NaN
        if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bw) || !Number.isFinite(bh)) continue
        minX = Math.min(minX, bx)
        minY = Math.min(minY, by)
        maxX = Math.max(maxX, bx + bw)
        maxY = Math.max(maxY, by + bh)
        hasAny = true
      }
    }
    if (!hasAny) return null
    return { minX, minY, maxX, maxY }
  })()

  const laneX = mermaidBounds ? mermaidBounds.maxX + 420 : 820

  anchorPosByNodeId.forEach((p, anchorNodeId) => {
    const dx = (hash01(anchorNodeId) - 0.5) * 12
    const dy = (hash01(anchorNodeId + ':y') - 0.5) * 10
    setPos(anchorNodeId, laneX + dx, p.y + dy)
    const baseZ = (() => {
      for (const [srcId, targets] of pointsTo.entries()) {
        if (!targets.includes(anchorNodeId)) continue
        const src = nextById.get(srcId)
        if (!src) continue
        const props = (src.properties || {}) as Record<string, unknown>
        const z = props['visual:zIndex']
        if (typeof z === 'number' && Number.isFinite(z)) return z
      }
      return 100
    })()
    setZ(anchorNodeId, baseZ + 6)
  })

  const anchorLaneNodeIds = Array.from(anchorPosByNodeId.keys()).sort((a, b) => {
    const na = nextById.get(a)
    const nb = nextById.get(b)
    const ya = na && isFiniteNumber(na.y) ? na.y : 0
    const yb = nb && isFiniteNumber(nb.y) ? nb.y : 0
    if (ya !== yb) return ya - yb
    return a.localeCompare(b)
  })
  let lastY: number | null = null
  for (let i = 0; i < anchorLaneNodeIds.length; i += 1) {
    const id = anchorLaneNodeIds[i]!
    const n = nextById.get(id)
    if (!n || !isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
    const s = sizeOf(id)
    const minGap = Math.max(54, s.h + 14)
    if (lastY != null && n.y < lastY + minGap) {
      const y = lastY + minGap
      setPos(id, n.x, y)
    }
    const nn = nextById.get(id)
    if (nn && isFiniteNumber(nn.y)) lastY = nn.y
  }

  for (let i = 0; i < nextNodes.length; i += 1) {
    const sec = nextNodes[i]
    if (!sec || String(sec.type || '') !== 'Section') continue
    const secId = String(sec.id || '').trim()
    if (!secId) continue
    const props = (sec.properties || {}) as Record<string, unknown>
    const anchorId = typeof props.anchor === 'string' ? String(props.anchor || '').trim() : ''
    if (!anchorId) continue
    const anchorNodeId = anchorNodeIdByAnchorId.get(anchorId)
    if (!anchorNodeId) continue
    const anchorPos = nextById.get(anchorNodeId)
    if (!anchorPos || !isFiniteNumber(anchorPos.x) || !isFiniteNumber(anchorPos.y)) continue
    const secSize = sizeOf(secId)
    const ancSize = sizeOf(anchorNodeId)
    const dy = -(ancSize.h / 2 + secSize.h / 2 + 22)
    setPos(secId, anchorPos.x, anchorPos.y + dy)
    setZ(secId, 800)
  }

  const blockOrderKey = (id: string): number => {
    const n = nextById.get(id)
    if (!n) return Number.POSITIVE_INFINITY
    const meta = n.metadata as unknown
    const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null
    const lineStart = m && typeof m.lineStart === 'number' && Number.isFinite(m.lineStart) ? Math.floor(m.lineStart) : null
    if (lineStart != null) return lineStart
    const props = (n.properties || {}) as Record<string, unknown>
    const order = typeof props.order === 'number' && Number.isFinite(props.order) ? Math.floor(props.order) : null
    return order != null ? order : Number.POSITIVE_INFINITY
  }

  const isPanelRelevantParagraph = (n: GraphNode) => {
    const props = (n.properties || {}) as Record<string, unknown>
    if (props.calloutType === true) return true
    const text = typeof props.text === 'string' ? props.text.trim() : ''
    if (text.startsWith('>')) return true
    if (typeof props.media_kind === 'string' && String(props.media_kind || '').trim()) return true
    if (typeof props.mediaKind === 'string' && String(props.mediaKind || '').trim()) return true
    if (typeof props.iframe_url === 'string' && String(props.iframe_url || '').trim()) return true
    if (typeof props.iframeUrl === 'string' && String(props.iframeUrl || '').trim()) return true
    if (typeof props.media_url === 'string' && String(props.media_url || '').trim()) return true
    if (typeof props.mediaUrl === 'string' && String(props.mediaUrl || '').trim()) return true
    if (typeof props.image === 'string' && String(props.image || '').trim()) return true
    if (typeof props.imageUrl === 'string' && String(props.imageUrl || '').trim()) return true
    if (typeof props.image_url === 'string' && String(props.image_url || '').trim()) return true
    if (typeof props.video === 'string' && String(props.video || '').trim()) return true
    if (typeof props.videoUrl === 'string' && String(props.videoUrl || '').trim()) return true
    if (typeof props.video_url === 'string' && String(props.video_url || '').trim()) return true
    return false
  }

  const positionAttachmentNodes = (parentId: string, baseX: number, baseY: number) => {
    const offs = (childId: string, idx: number, dxBase: number) => {
      const dx = dxBase + 24 + (hash01(childId) - 0.5) * 16
      const dy = (idx - 1) * 24 + (hash01(childId + ':y') - 0.5) * 10
      return { x: baseX + dx, y: baseY + dy }
    }

    const internals = hasInternalLink.get(parentId) || []
    for (let i = 0; i < internals.length; i += 1) {
      const id = String(internals[i] || '').trim()
      if (!id) continue
      const p = offs(id, i, 160)
      setPos(id, p.x, p.y)
      setZ(id, 1100)
      const targets = pointsTo.get(id) || []
      for (let j = 0; j < targets.length; j += 1) {
        const tid = String(targets[j] || '').trim()
        if (!tid) continue
        if (String(nodeById.get(tid)?.type || '') === 'Anchor') {
          const tp = offs(tid, j, 220)
          setPos(tid, tp.x, tp.y)
          setZ(tid, 1000)
        }
      }
    }

    const linkIds = linksTo.get(parentId) || []
    for (let i = 0; i < linkIds.length; i += 1) {
      const id = String(linkIds[i] || '').trim()
      if (!id) continue
      const p = offs(id, i, 190)
      setPos(id, p.x, p.y)
      setZ(id, 1100)
    }

    const imgIds = embedsImage.get(parentId) || []
    for (let i = 0; i < imgIds.length; i += 1) {
      const id = String(imgIds[i] || '').trim()
      if (!id) continue
      const p = offs(id, i, 230)
      setPos(id, p.x, p.y)
      setZ(id, 1200)
    }

    const mediaIds = embedsMedia.get(parentId) || []
    for (let i = 0; i < mediaIds.length; i += 1) {
      const id = String(mediaIds[i] || '').trim()
      if (!id) continue
      const p = offs(id, i, 230)
      setPos(id, p.x, p.y)
      setZ(id, 1200)
    }
  }

  const positionBlocksForSection = (sectionId: string) => {
    const sec = nextById.get(sectionId)
    if (!sec || !isFiniteNumber(sec.x) || !isFiniteNumber(sec.y)) return
    const blocks = (hasBlock.get(sectionId) || []).map(x => String(x || '').trim()).filter(Boolean)
    blocks.sort((a, b) => {
      const ka = blockOrderKey(a)
      const kb = blockOrderKey(b)
      if (ka !== kb) return ka - kb
      return a.localeCompare(b)
    })
    const secSize = sizeOf(sectionId)
    let cursorY = sec.y + secSize.h / 2 + 42
    const baseX = sec.x + 340
    let z = 900
    for (let i = 0; i < blocks.length; i += 1) {
      const bid = blocks[i]!
      const b = nextById.get(bid)
      if (!b) continue
      const type = String(b.type || '')
      if (type === 'Paragraph') {
        const hasContext =
          (hasInternalLink.get(bid) || []).length > 0 ||
          (linksTo.get(bid) || []).length > 0 ||
          (embedsImage.get(bid) || []).length > 0 ||
          (embedsMedia.get(bid) || []).length > 0
        if (!hasContext && !isPanelRelevantParagraph(b)) continue
      }
      if (type === 'List') {
        const itemIds = (hasItem.get(bid) || []).map(x => String(x || '').trim()).filter(Boolean)
        itemIds.sort((a, b) => {
          const ka = blockOrderKey(a)
          const kb = blockOrderKey(b)
          if (ka !== kb) return ka - kb
          return a.localeCompare(b)
        })
        let includedAny = false
        for (let j = 0; j < itemIds.length; j += 1) {
          const iid = itemIds[j]!
          const hasContext =
            (hasInternalLink.get(iid) || []).length > 0 ||
            (linksTo.get(iid) || []).length > 0 ||
            (embedsImage.get(iid) || []).length > 0 ||
            (embedsMedia.get(iid) || []).length > 0
          if (!hasContext) continue
          const s = sizeOf(iid)
          const by = cursorY + s.h / 2
          setPos(iid, baseX, by)
          setZ(iid, z)
          positionAttachmentNodes(iid, baseX, by)
          includedAny = true
          cursorY = by + s.h / 2 + 30
          z += 1
        }
        if (includedAny) {
          const s = sizeOf(bid)
          const by = sec.y + 76
          setPos(bid, sec.x + 220, by)
          setZ(bid, z)
          positionAttachmentNodes(bid, sec.x + 220, by)
          z += 1
        }
        continue
      }

      const s = sizeOf(bid)
      const by = cursorY + s.h / 2
      setPos(bid, baseX, by)
      setZ(bid, z)
      positionAttachmentNodes(bid, baseX, by)
      cursorY = by + s.h / 2 + 30
      z += 1
    }
  }

  for (let i = 0; i < nextNodes.length; i += 1) {
    const n = nextNodes[i]
    if (!n || String(n.type || '') !== 'Section') continue
    const sid = String(n.id || '').trim()
    if (!sid) continue
    positionBlocksForSection(sid)
  }

  const maybeMermaid = nextNodes.filter(n => String(n.type || '') === 'MermaidNode')
  for (let i = 0; i < maybeMermaid.length; i += 1) {
    const n = maybeMermaid[i]!
    const id = String(n.id || '').trim()
    if (!id) continue
    if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
    positionAttachmentNodes(id, n.x, n.y)
  }

  return { ...graphData, nodes: nextNodes }
}

const readFrontmatterMermaidCode = (graphData: GraphData): string => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    if (!isFrontmatterMermaidDiagram(n)) continue
    const props = readRecordProps(n)
    const code = props && typeof props.code === 'string' ? String(props.code || '').trim() : ''
    if (code) return code
  }
  return ''
}

export async function applyMermaidFrontmatterGeometryToGraphData(
  graphData: GraphData,
  args?: { theme?: MermaidTheme; codeOverride?: string },
): Promise<GraphData> {
  const code = (args?.codeOverride || readFrontmatterMermaidCode(graphData)).trim()
  if (!code) return graphData
  if (typeof window === 'undefined' || typeof document === 'undefined') return graphData

  const theme = args?.theme === 'dark' || args?.theme === 'light' ? args.theme : (getKgThemeFromDom() as MermaidTheme)
  const rendered = await renderMermaidSvgCached({ code, theme: theme === 'dark' ? 'dark' : 'light' })
  const geom = parseMermaidSvgGeometry(rendered.svg)
  if (geom.nodes.length === 0 && geom.edges.length === 0 && geom.clusters.length === 0) return graphData

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []

  const mermaidNodeIdByName = new Map<string, string>()
  const mermaidSubgraphIdByName = new Map<string, string>()
  const nodePropsById = new Map<string, Record<string, unknown>>()

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n.id || '')
    const props = readRecordProps(n)
    if (props) nodePropsById.set(id, props)
    if (String(n.type || '') === 'MermaidNode') {
      const name = typeof props?.nodeName === 'string' ? String(props.nodeName || '').trim() : ''
      if (name) mermaidNodeIdByName.set(name, id)
    }
    if (String(n.type || '') === 'MermaidSubgraph') {
      const name = typeof props?.subgraphName === 'string' ? String(props.subgraphName || '').trim() : ''
      if (name) mermaidSubgraphIdByName.set(name, id)
    }
  }

  const edgeBuckets = new Map<string, GraphEdge[]>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]!
    if (String(e.label || '') !== 'pointsTo') continue
    const srcId = String(e.source || '')
    const tgtId = String(e.target || '')
    if (!srcId || !tgtId) continue
    const srcProps = nodePropsById.get(srcId)
    const tgtProps = nodePropsById.get(tgtId)
    const srcName = typeof srcProps?.nodeName === 'string' ? String(srcProps.nodeName || '').trim() : ''
    const tgtName = typeof tgtProps?.nodeName === 'string' ? String(tgtProps.nodeName || '').trim() : ''
    if (!srcName || !tgtName) continue
    const k = `${srcName}|${tgtName}`
    const arr = edgeBuckets.get(k)
    if (arr) arr.push(e)
    else edgeBuckets.set(k, [e])
  }

  const updatedNodes: GraphNode[] = nodes.map(n => {
    const id = String(n.id || '')
    const props = readRecordProps(n)
    if (!id || !props) return n
    if (String(n.type || '') !== 'MermaidNode' && String(n.type || '') !== 'MermaidSubgraph') return n
    return { ...n, properties: { ...props } as never }
  })

  const updatedEdges: GraphEdge[] = edges.map(e => {
    const props = (e as unknown as { properties?: unknown }).properties
    if (!props || typeof props !== 'object' || Array.isArray(props)) return e
    return { ...e, properties: { ...(props as Record<string, unknown>) } as never }
  })

  const nodeIndexById = new Map<string, number>()
  for (let i = 0; i < updatedNodes.length; i += 1) nodeIndexById.set(String(updatedNodes[i]!.id || ''), i)

  for (let i = 0; i < geom.nodes.length; i += 1) {
    const g = geom.nodes[i]!
    const id = mermaidNodeIdByName.get(g.name)
    if (!id) continue
    const idx = nodeIndexById.get(id)
    if (idx == null) continue
    const n = updatedNodes[idx]!
    const p = readRecordProps(n) as Record<string, unknown>
    p['visual:width'] = g.width
    p['visual:height'] = g.height
    p['visual:shape'] = g.shape
    p['visual:zIndex'] = g.order
    p['visual:zIndexMode'] = 'absolute'
    if (g.shape === 'circle' && g.radius != null) p['visual:radius'] = g.radius
    if (g.imageUrl) {
      p.media_url = g.imageUrl
      p.media_kind = (() => {
        const lower = g.imageUrl.toLowerCase()
        if (lower.endsWith('.svg')) return 'svg'
        return 'image'
      })()
    }
    updatedNodes[idx] = {
      ...n,
      x: g.cx,
      y: g.cy,
      fx: g.cx,
      fy: g.cy,
      properties: p as never,
    }
  }

  for (let i = 0; i < geom.clusters.length; i += 1) {
    const c = geom.clusters[i]!
    const id = mermaidSubgraphIdByName.get(c.name)
    if (!id) continue
    const idx = nodeIndexById.get(id)
    if (idx == null) continue
    const n = updatedNodes[idx]!
    const p = readRecordProps(n) as Record<string, unknown>
    const inset = 2
    const x = c.x + inset
    const y = c.y + inset
    const w = Math.max(0, c.width - inset * 2)
    const h = Math.max(0, c.height - inset * 2)
    p['visual:bounds'] = {
      x,
      y,
      width: w,
      height: h,
      ...(c.labelX != null && c.labelY != null ? { labelX: c.labelX, labelY: c.labelY } : {}),
    }
    updatedNodes[idx] = { ...n, properties: p as never }
  }

  const setEdgeVisual = (edgeIdx: number, eg: MermaidEdgeGeometry) => {
    const cur = updatedEdges[edgeIdx] as unknown as { properties?: Record<string, unknown> }
    const props = cur.properties && typeof cur.properties === 'object' && !Array.isArray(cur.properties) ? cur.properties : {}
    props['visual:pathD'] = eg.pathD
    if (eg.arrowD) props['visual:arrowD'] = eg.arrowD
    props['visual:zIndex'] = eg.order
    if (eg.tx || eg.ty) {
      props['visual:pathTx'] = eg.tx
      props['visual:pathTy'] = eg.ty
    }
    if (eg.labelX != null && eg.labelY != null) {
      props['visual:labelX'] = eg.labelX
      props['visual:labelY'] = eg.labelY
    }
    updatedEdges[edgeIdx] = { ...updatedEdges[edgeIdx], properties: props as never }
  }

  const unmatchedGeomEdges: MermaidEdgeGeometry[] = []
  for (let i = 0; i < geom.edges.length; i += 1) {
    const eg = geom.edges[i]!
    const bucketKey = `${eg.sourceName}|${eg.targetName}`
    const bucket = edgeBuckets.get(bucketKey)
    if (!bucket || bucket.length === 0) {
      unmatchedGeomEdges.push(eg)
      continue
    }
    const e = bucket.shift()!
    const edgeId = String(e.id || '')
    if (!edgeId) {
      unmatchedGeomEdges.push(eg)
      continue
    }
    const edgeIdx = updatedEdges.findIndex(x => String(x.id || '') === edgeId)
    if (edgeIdx < 0) {
      unmatchedGeomEdges.push(eg)
      continue
    }
    setEdgeVisual(edgeIdx, eg)
  }

  if (unmatchedGeomEdges.length > 0) {
    const candidateEdgeIdxs: number[] = []
    for (let i = 0; i < updatedEdges.length; i += 1) {
      const e = updatedEdges[i]!
      if (String(e.label || '') !== 'pointsTo') continue
      const props = (e as unknown as { properties?: unknown }).properties
      const hasPath =
        props && typeof props === 'object' && !Array.isArray(props) && typeof (props as Record<string, unknown>)['visual:pathD'] === 'string' && String((props as any)['visual:pathD'] || '').trim()
          ? true
          : false
      if (hasPath) continue
      candidateEdgeIdxs.push(i)
    }
    for (let i = 0; i < unmatchedGeomEdges.length && i < candidateEdgeIdxs.length; i += 1) {
      setEdgeVisual(candidateEdgeIdxs[i]!, unmatchedGeomEdges[i]!)
    }
  }

  const graphWithGeom = {
    ...graphData,
    context: 'frontmatter-mermaid',
    nodes: updatedNodes,
    edges: updatedEdges,
    metadata: {
      ...(graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata) ? graphData.metadata : {}),
      layoutEngine: 'mermaid',
    } as never,
  }

  return applyMermaidFrontmatterContextLayoutToGraphData(graphWithGeom)
}
