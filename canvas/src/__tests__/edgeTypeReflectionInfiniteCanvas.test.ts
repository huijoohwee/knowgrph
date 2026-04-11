import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testInfiniteCanvasEdgesAlwaysUsePathLayerForEdgeTypeReflection() {
  const linksPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'links.ts')
  const text = readFileSync(linksPath, 'utf8')
  if (!text.includes('function shouldUsePathForEdge')) {
    throw new Error('expected D3 links layer to define shouldUsePathForEdge helper')
  }
  if (!text.includes('if (readEdgeVisualPathD(e)) return true')) {
    throw new Error('expected D3 links layer to keep explicit visual:pathD support')
  }
  if (!text.includes('return true')) {
    throw new Error('expected D3 links layer to always use path edges so edge-type switches reflect without stale line/path rebuild mismatch')
  }
}

