import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export async function testMarkdownTemplateVarsExtractFromBlockquotesAndTables() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = `---
graphId: md:test-template-vars
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

> Quote with {{title}} and {{script}}

| Key | Value |
| --- | --- |
| Title | {{title}} |
| Script | {{script}} |
`

  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []

  const templateVars = nodes.filter(n => {
    if (n.type !== 'InternalLink') return false
    const props = (n.properties || {}) as Record<string, unknown>
    return props.kind === 'templateVar' && (props.varName === 'title' || props.varName === 'script')
  })
  if (templateVars.length < 2) throw new Error('expected templateVar InternalLinks for title and script')

  const hasPointsToScript = edges.some(e => e.label === 'pointsTo' && e.target === 'NODE_SCRIPT')
  if (!hasPointsToScript) throw new Error('expected templateVar pointsTo edges into NODE_SCRIPT')

  await Promise.resolve()
}

