import * as d3 from 'd3'
import { GraphNode, JSONValue } from '@/lib/graph/types'

export function createNodeAtScreen(
  svgEl: SVGSVGElement,
  screenX: number,
  screenY: number,
  addNode: (node: GraphNode) => void,
  opts?: { label?: string; type?: string; properties?: Record<string, JSONValue> }
) {
  const t = d3.zoomTransform(svgEl)
  const p = t.invert([screenX, screenY])
  const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
  const node: GraphNode = {
    id,
    label: opts?.label ?? 'Node',
    type: opts?.type ?? 'entity',
    x: p[0],
    y: p[1],
    fx: p[0],
    fy: p[1],
    properties: opts?.properties ?? {},
  }
  addNode(node)
  return id
}

export function createNodeAtCanvasPoint(
  addNode: (node: GraphNode) => void,
  x: number,
  y: number,
  opts?: { label?: string; type?: string; properties?: Record<string, JSONValue> }
) {
  const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
  const node: GraphNode = {
    id,
    label: opts?.label ?? 'Node',
    type: opts?.type ?? 'entity',
    x,
    y,
    fx: x,
    fy: y,
    properties: opts?.properties ?? {},
  }
  addNode(node)
  return id
}

export function adjustPointMinDistance(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  minDist = 120
) {
  const dx = targetX - startX
  const dy = targetY - startY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (!isFinite(dist) || dist === 0) {
    return { x: startX + minDist, y: startY }
  }
  if (dist >= minDist) return { x: targetX, y: targetY }
  const ux = dx / dist
  const uy = dy / dist
  return { x: startX + ux * minDist, y: startY + uy * minDist }
}
