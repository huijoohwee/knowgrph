import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { getKgThemeFromDom } from '@/lib/ui/tokens-ssot'
import { renderMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'

type MermaidTheme = 'light' | 'dark'

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

    const ellipse = g.querySelector('ellipse')
    if (ellipse) {
      const rx = coerceNumber(readAttr(ellipse, 'rx'))
      const ry = coerceNumber(readAttr(ellipse, 'ry'))
      if (!rx || !ry) continue
      const r = Math.min(rx, ry)
      nodes.push({ name, cx: t.x, cy: t.y, shape: 'circle', width: rx * 2, height: ry * 2, radius: r, order: i, imageUrl })
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
    p['visual:bounds'] = {
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      ...(c.labelX != null && c.labelY != null ? { labelX: c.labelX, labelY: c.labelY } : {}),
    }
    p['visual:zIndex'] = c.order
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

  return {
    ...graphData,
    context: 'frontmatter-mermaid',
    nodes: updatedNodes,
    edges: updatedEdges,
    metadata: {
      ...(graphData.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata) ? graphData.metadata : {}),
      layoutEngine: 'mermaid',
    } as never,
  }
}
