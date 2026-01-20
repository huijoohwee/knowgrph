import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import { applyMermaidSeedLayout } from '@/components/GraphCanvas/layout/mermaidSeed'

export const testMermaidSeedLayoutSpreadsGroupsAndCenters = () => {
  const schema = defaultSchema
  const mkNode = (id: string, topParentId: string): GraphNode => ({
    id,
    label: id,
    type: 'MermaidNode',
    properties: { 'visual:topParentId': topParentId },
  })

  const nodes: GraphNode[] = [
    {
      id: 'mermaid:demo:frontmatter',
      label: 'Frontmatter Mermaid Diagram',
      type: 'MermaidDiagram',
      properties: { code: 'graph TB\nA-->B', mermaidScope: 'frontmatter', isMermaidFrontmatter: true },
    },
    mkNode('S1_A', 'S1'),
    mkNode('S1_B', 'S1'),
    mkNode('S1_Port', 'S1'),
    mkNode('S2_In', 'S2'),
    mkNode('S2_Proc', 'S2'),
    mkNode('S2_Out', 'S2'),
    mkNode('S3_In', 'S3'),
    mkNode('S3_Proc', 'S3'),
    mkNode('S3_Out', 'S3'),
    mkNode('S4_In', 'S4'),
    mkNode('S4_D1', 'S4'),
    mkNode('S4_D2', 'S4'),
  ]

  const e = (src: string, tgt: string): GraphEdge => ({ id: `${src}->${tgt}`, source: src, target: tgt, label: 'pointsTo', properties: {} })
  const edges: GraphEdge[] = [
    e('S1_A', 'S1_Port'),
    e('S1_B', 'S1_Port'),
    e('S1_Port', 'S2_In'),
    e('S1_Port', 'S3_In'),
    e('S2_In', 'S2_Proc'),
    e('S2_Proc', 'S2_Out'),
    e('S3_In', 'S3_Proc'),
    e('S3_Proc', 'S3_Out'),
    e('S2_Out', 'S4_In'),
    e('S3_Out', 'S4_In'),
    e('S4_In', 'S4_D1'),
    e('S4_In', 'S4_D2'),
  ]

  applyMermaidSeedLayout({ nodes, edges, width: 1920, height: 1080, schema })

  const byGroup = new Map<string, GraphNode[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (n.type !== 'MermaidNode') continue
    const gid = String((n.properties || {})['visual:topParentId'] || '')
    const arr = byGroup.get(gid) || []
    arr.push(n)
    byGroup.set(gid, arr)
  }

  const meanY = (gid: string): number => {
    const arr = byGroup.get(gid) || []
    let sum = 0
    for (let i = 0; i < arr.length; i += 1) {
      const y = arr[i].y
      if (typeof y !== 'number' || !Number.isFinite(y)) throw new Error(`expected finite y for ${arr[i].id}`)
      sum += y
    }
    return sum / Math.max(1, arr.length)
  }

  const y1 = meanY('S1')
  const y2 = meanY('S2')
  const y3 = meanY('S3')
  const y4 = meanY('S4')
  if (!(y1 < y2 && y1 < y3 && y2 < y4 && y3 < y4)) {
    throw new Error('expected S1 near top and S4 near bottom for graph TB')
  }

  let sumX = 0
  let sumY = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (n.type !== 'MermaidNode') continue
    if (typeof n.x !== 'number' || !Number.isFinite(n.x) || typeof n.y !== 'number' || !Number.isFinite(n.y)) {
      throw new Error(`expected positioned MermaidNode ${n.id}`)
    }
    sumX += n.x
    sumY += n.y
    count += 1
  }
  const cx = sumX / Math.max(1, count)
  const cy = sumY / Math.max(1, count)
  if (Math.abs(cx - 960) > 6 || Math.abs(cy - 540) > 6) {
    throw new Error('expected Mermaid centroid to be near canvas center')
  }
}

