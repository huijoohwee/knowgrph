import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export async function testMarkdownFlowInternalRefsResolveToFlowNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = `---
graphId: md:test-flow-internal-refs
nodes:
  - id: NODE_SCRIPT
    type: SourceStrings
    label: Script
    pos: { x: 0, y: 0 }
    outputs:
      - port: title_out
        type: STRING
      - port: script_out
        type: STRING
---

# Demo

- [[NODE_SCRIPT]] feeds {{title}} and {{script}}.

See also [[Other Note]].
`

  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`unexpected markdown parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []

  const scriptNode = nodes.find(n => n.id === 'NODE_SCRIPT')
  if (!scriptNode) throw new Error('expected flow node NODE_SCRIPT from frontmatter overlay')

  const wikiLinksToNode = nodes.filter(n => {
    if (n.type !== 'InternalLink') return false
    const props = (n.properties || {}) as Record<string, unknown>
    return props.kind === 'wikilink' && props.nodeId === 'NODE_SCRIPT'
  })
  if (wikiLinksToNode.length === 0) throw new Error('expected at least one wikilink InternalLink targeting NODE_SCRIPT')

  const templateVars = nodes.filter(n => {
    if (n.type !== 'InternalLink') return false
    const props = (n.properties || {}) as Record<string, unknown>
    return props.kind === 'templateVar' && (props.varName === 'title' || props.varName === 'script')
  })
  if (templateVars.length < 2) throw new Error('expected templateVar InternalLinks for title and script')

  const pointsToScript = templateVars.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return props.pointsTo === 'NODE_SCRIPT' || edges.some(e => e.label === 'pointsTo' && e.source === n.id && e.target === 'NODE_SCRIPT')
  })
  if (!pointsToScript) throw new Error('expected at least one templateVar to point to NODE_SCRIPT')

  const wikiDoc = nodes.find(n => n.type === 'WikiDocument' && ((n.properties || {}) as Record<string, unknown>).docKey === 'Other Note')
  if (!wikiDoc) throw new Error('expected WikiDocument placeholder node for Other Note')

  await Promise.resolve()
}
