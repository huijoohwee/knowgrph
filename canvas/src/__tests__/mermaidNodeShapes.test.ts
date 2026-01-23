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
}
