import { parseMermaidFrontmatter } from '@/features/parsers/markdownJsonLdMermaidParser'

export function testMermaidParserCapturesNodeShapes() {
  const nodes: Record<string, unknown>[] = []
  parseMermaidFrontmatter(
    `flowchart TB
      A{Decide} --> B{{Hex}} --> C((Circle)) --> D[Rect]
    `,
    {
      gid: 't',
      docId: 'doc:t',
      diagramScope: 'frontmatter',
      startIndex: 0,
      ensureNode: (n) => nodes.push(n),
      addRel: () => {},
      mkMeta: () => ({}),
    },
  )

  const byName = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const nodeName = typeof props.nodeName === 'string' ? props.nodeName : ''
    if (nodeName) byName.set(nodeName, n)
  }

  const shapeOf = (nodeName: string) => {
    const n = byName.get(nodeName)
    if (!n) return ''
    const props = (n.properties || {}) as Record<string, unknown>
    return typeof props['visual:shape'] === 'string' ? props['visual:shape'] : ''
  }

  if (shapeOf('A') !== 'diamond') throw new Error('expected rhombus node to map to visual:shape=diamond')
  if (shapeOf('B') !== 'hex') throw new Error('expected hexagon node to map to visual:shape=hex')
  if (shapeOf('C') !== 'circle') throw new Error('expected circle node to map to visual:shape=circle')
  if (shapeOf('D') !== 'rect') throw new Error('expected box node to map to visual:shape=rect')

  const canonicalShapeOf = (nodeName: string) => {
    const n = byName.get(nodeName)
    if (!n) return ''
    const props = (n.properties || {}) as Record<string, unknown>
    return typeof props['visual:shapeCanonical'] === 'string' ? props['visual:shapeCanonical'] : ''
  }

  const nestingDepthOf = (nodeName: string) => {
    const n = byName.get(nodeName)
    if (!n) return -1
    const props = (n.properties || {}) as Record<string, unknown>
    return typeof props['visual:nestingDepth'] === 'number' ? props['visual:nestingDepth'] : -1
  }

  const primitiveOf = (nodeName: string) => {
    const n = byName.get(nodeName)
    if (!n) return ''
    const props = (n.properties || {}) as Record<string, unknown>
    return typeof props['frontmatter:primitive'] === 'string' ? props['frontmatter:primitive'] : ''
  }
  if (primitiveOf('A') !== 'node') throw new Error('expected rhombus primitive=node')
  if (primitiveOf('B') !== 'edge') throw new Error('expected hexagon primitive=edge')
  if (primitiveOf('C') !== 'cluster') throw new Error('expected circle primitive=cluster')
  if (primitiveOf('D') !== 'node') throw new Error('expected box primitive=node')
  if (canonicalShapeOf('A') !== primitiveOf('A')) throw new Error('expected A canonical shape to match primitive')
  if (canonicalShapeOf('B') !== primitiveOf('B')) throw new Error('expected B canonical shape to match primitive')
  if (canonicalShapeOf('C') !== primitiveOf('C')) throw new Error('expected C canonical shape to match primitive')
  if (canonicalShapeOf('D') !== primitiveOf('D')) throw new Error('expected D canonical shape to match primitive')
  if (nestingDepthOf('A') !== 0 || nestingDepthOf('B') !== 0 || nestingDepthOf('C') !== 0 || nestingDepthOf('D') !== 0) {
    throw new Error('expected top-level Mermaid nodes to have canonical nesting depth 0')
  }
}
