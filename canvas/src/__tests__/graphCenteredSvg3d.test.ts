import type { GraphData } from '@/lib/graph/types'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { defaultSchema } from '@/lib/graph/schema'

export function testGraphCenteredSvg3dCentersAndAnimates() {
  const g: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'a', type: 'Entity', label: 'A', properties: { pos3d: [80, 0, 40] } },
      { id: 'b', type: 'Entity', label: 'B', properties: { pos3d: [-80, 0, -40] } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} }],
  }

  const svg = exportGraphAsCentered3dSvgMarkup({
    graphData: g,
    schema: defaultSchema,
    widthPx: 900,
    heightPx: 600,
    paddingPx: 60,
    includeXmlDeclaration: false,
    animated: true,
    frames: 12,
    durationSec: 4,
  })
  if (!svg) throw new Error('expected svg markup')
  if (!svg.includes('<script')) throw new Error('expected script animation')
  if (!svg.includes('data-kg-3d-payload=')) throw new Error('expected embedded 3d payload')
  if (!svg.includes('data-node-id="a"') || !svg.includes('data-node-id="b"')) throw new Error('expected node elements present')

  const m = svg.match(/viewBox="([^"]+)"/)
  if (!m) throw new Error('expected viewBox')
  const parts = String(m[1] || '').trim().split(/[ ,]+/).map(Number)
  if (parts.length !== 4) throw new Error('expected 4 viewBox numbers')
  const [x, y, w, h] = parts
  const cx = x + w / 2
  const cy = y + h / 2
  if (!(Math.abs(cx) < 1e-6)) throw new Error(`expected centered viewBox cx=0, got ${cx}`)
  if (!(Math.abs(cy) < 1e-6)) throw new Error(`expected centered viewBox cy=0, got ${cy}`)
}
