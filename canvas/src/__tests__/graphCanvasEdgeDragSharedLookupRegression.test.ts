import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasEdgeDragReusesCallerLookup() {
  const dragText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'drag.ts'),
    'utf8',
  )
  const linksText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'links.ts'),
    'utf8',
  )

  if (
    !dragText.includes("import { buildCanonicalNodeLookup, getCanonicalNodeLookupValue } from '@/lib/graph/canonicalNodeIds'")
    || !dragText.includes('const canonicalNodeLookup = nodeById && nodeById.size > 0 ? buildCanonicalNodeLookup(nodeById.entries()) : null')
    || !dragText.includes('sourceNode = sId ? getCanonicalNodeLookupValue(canonicalNodeLookup, sId) || undefined : undefined')
    || !dragText.includes('targetNode = tId ? getCanonicalNodeLookupValue(canonicalNodeLookup, tId) || undefined : undefined')
    || dragText.includes('const nodes = simulation.nodes()')
    || dragText.includes('sourceNode = nodes.find(')
    || dragText.includes('targetNode = nodes.find(')
  ) {
    throw new Error('expected GraphCanvas edge drag behavior to reuse the caller-owned node lookup instead of rescanning simulation nodes')
  }

  if (!linksText.includes('const drag = edgeDragBehavior(simulation, schema, nodeById);')) {
    throw new Error('expected links hit layer to pass the shared display node lookup into edge drag behavior')
  }
}
