import type { GraphData } from '@/lib/graph/types'
import { extractNodePosByIdFromSvgMarkup } from '@/lib/graph/svgNodePos'

type Point = { x: number; y: number }

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function ensureSvgHasEdgeGeometry(args: {
  svgMarkup: string
  graphData: GraphData
  nodePosById?: Record<string, Point> | null
}): string {
  const src = String(args.svgMarkup || '').trim()
  if (!src) return src
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return src

  try {
    const doc = new DOMParser().parseFromString(src.replace(/^<\?xml[^>]*>\s*/i, ''), 'image/svg+xml')
    const svg = doc.querySelector('svg') as unknown as SVGSVGElement | null
    if (!svg) return src

    const linksRoot = svg.querySelector('[data-kg-layer="links"]')
    if (!linksRoot) return src
    if (linksRoot.querySelector('line,path,polyline')) return src

    const nodes = Array.isArray((args.graphData as any)?.nodes) ? ((args.graphData as any).nodes as any[]) : []
    const edges = Array.isArray((args.graphData as any)?.edges) ? ((args.graphData as any).edges as any[]) : []
    if (edges.length === 0) return src

    const nodeIdSet = new Set<string>()
    const nodeIdBySuffix: Record<string, string> = {}
    for (let i = 0; i < nodes.length; i += 1) {
      const rawId = String(nodes[i]?.id || '').trim()
      if (!rawId) continue
      nodeIdSet.add(rawId)
      const suffix = rawId.split('::').pop() || ''
      if (suffix && !nodeIdBySuffix[suffix]) nodeIdBySuffix[suffix] = rawId
    }
    const normalizeNodeId = (raw: string): string => {
      const id = String(raw || '').trim()
      if (!id) return ''
      if (nodeIdSet.has(id)) return id
      const suffix = id.split('::').pop() || ''
      return suffix && nodeIdBySuffix[suffix] ? nodeIdBySuffix[suffix]! : id
    }

    const svgPos = extractNodePosByIdFromSvgMarkup(src)
    const posById: Record<string, Point> = {
      ...svgPos,
      ...(args.nodePosById || {}),
    }

    const ns = svg.namespaceURI || 'http://www.w3.org/2000/svg'
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const edgeId = String(e?.id || '').trim() || `e${i}`
      const s0 = String(e?.sourceId || e?.source || '').trim()
      const t0 = String(e?.targetId || e?.target || '').trim()
      const s = normalizeNodeId(s0)
      const t = normalizeNodeId(t0)
      if (!edgeId || !s || !t) continue

      const ps = posById[s]
      const pt = posById[t]
      if (!ps || !pt) continue
      if (!isFiniteNum(ps.x) || !isFiniteNum(ps.y) || !isFiniteNum(pt.x) || !isFiniteNum(pt.y)) continue

      const line = doc.createElementNS(ns, 'line')
      line.setAttribute('data-edge-id', edgeId)
      line.setAttribute('data-source-id', s)
      line.setAttribute('data-target-id', t)
      line.setAttribute('x1', String(ps.x))
      line.setAttribute('y1', String(ps.y))
      line.setAttribute('x2', String(pt.x))
      line.setAttribute('y2', String(pt.y))
      line.setAttribute('stroke', 'var(--kg-canvas-edge-stroke)')
      line.setAttribute('stroke-opacity', '1')
      line.setAttribute('stroke-width', '2')
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('fill', 'none')
      linksRoot.appendChild(line)
    }

    const out = new XMLSerializer().serializeToString(svg)
    const trimmed = String(out || '').trim()
    return trimmed || src
  } catch {
    return src
  }
}

