import type { GraphData } from '@/lib/graph/types'
import { exportGraphAsCenteredSvgMarkup } from '@/lib/graph/graphCenteredSvg'
import { defaultSchema } from '@/lib/graph/schema'

export function testGraphCenteredSvgPutsCentroidInViewCenter() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', x: 0, y: 0, properties: {} },
      { id: 'b', type: 'Entity', label: 'B', x: 100, y: 0, properties: {} },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} }],
  }

  const svg = exportGraphAsCenteredSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 1000,
    heightPx: 500,
    paddingPx: 40,
    includeXmlDeclaration: false,
  })
  if (!svg) throw new Error('expected svg markup')

  const m = svg.match(/viewBox="([^"]+)"/)
  if (!m) throw new Error('expected viewBox')
  const parts = String(m[1] || '').trim().split(/[ ,]+/).map(Number)
  if (parts.length !== 4) throw new Error(`expected 4 viewBox numbers, got ${String(m[1] || '')}`)
  const [x, y, w, h] = parts
  const cx = x + w / 2
  const cy = y + h / 2
  if (!(Math.abs(cx - 50) < 1e-6)) throw new Error(`expected center x ~= 50, got ${cx}`)
  if (!(Math.abs(cy - 0) < 1e-6)) throw new Error(`expected center y ~= 0, got ${cy}`)
  if (!svg.includes('>A<') || !svg.includes('>B<')) throw new Error('expected labels present')
}

export function testGraphCenteredSvgIncludesAnimationWhenEnabled() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', x: 0, y: 0, properties: {} },
      { id: 'b', type: 'Entity', label: 'B', x: 100, y: 0, properties: {} },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} }],
  }

  const svg = exportGraphAsCenteredSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 1000,
    heightPx: 500,
    paddingPx: 40,
    includeXmlDeclaration: false,
    animated: true,
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('<animate')) throw new Error('expected animate elements to be present')
}
