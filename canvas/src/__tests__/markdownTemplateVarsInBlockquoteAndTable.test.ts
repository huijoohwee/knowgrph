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

export async function testMarkdownTemplateVarDeclarationAndFallbackResolution() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = `---
graphId: md:test-template-vars-resolution
venue: Singapore
date: 2026-02-23
authors:
  - A. Author 1
---

{{place:airport}}
I go to {{place}} in {{venue}} on {{date}} by {{authors.0}}.
Fallback key: {{city|venue}}
Fallback literal: {{unknown|defaultCity}}
`

  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')

  const nodes = res.graphData.nodes || []
  const templateVars = nodes.filter(n => {
    if (n.type !== 'InternalLink') return false
    const props = (n.properties || {}) as Record<string, unknown>
    return props.kind === 'templateVar'
  })
  if (templateVars.length < 6) throw new Error('expected templateVar InternalLinks for declaration/ref/frontmatter/fallback cases')

  const findVar = (name: string, op?: string) =>
    templateVars.find(n => {
      const props = (n.properties || {}) as Record<string, unknown>
      if (props.varName !== name) return false
      if (!op) return true
      return props.templateOp === op
    })

  const placeDef = findVar('place', 'def')
  if (!placeDef) throw new Error('expected {{place:airport}} to emit templateOp=def node')
  const placeDefProps = (placeDef.properties || {}) as Record<string, unknown>
  if (placeDefProps.value !== 'airport' || placeDefProps.valueSource !== 'inline') {
    throw new Error('expected {{place:airport}} to resolve inline declaration value')
  }

  const venueRef = findVar('venue')
  if (!venueRef) throw new Error('expected {{venue}} template var')
  const venueProps = (venueRef.properties || {}) as Record<string, unknown>
  if (venueProps.value !== 'Singapore' || venueProps.valueSource !== 'frontmatter') {
    throw new Error('expected {{venue}} to resolve from frontmatter')
  }

  const authorRef = findVar('authors.0')
  if (!authorRef) throw new Error('expected {{authors.0}} template var')
  const authorProps = (authorRef.properties || {}) as Record<string, unknown>
  if (authorProps.value !== 'A. Author 1' || authorProps.valueSource !== 'frontmatter') {
    throw new Error('expected {{authors.0}} to resolve frontmatter dotted array path')
  }

  const cityFallback = findVar('city')
  if (!cityFallback) throw new Error('expected {{city|venue}} template var')
  const cityProps = (cityFallback.properties || {}) as Record<string, unknown>
  if (cityProps.value !== 'Singapore' || cityProps.valueSource !== 'fallback' || cityProps.fallbackKey !== 'venue') {
    throw new Error('expected {{city|venue}} to resolve via fallback key')
  }

  const unknownFallback = findVar('unknown')
  if (!unknownFallback) throw new Error('expected {{unknown|defaultCity}} template var')
  const unknownProps = (unknownFallback.properties || {}) as Record<string, unknown>
  if (unknownProps.value !== 'defaultCity' || unknownProps.valueSource !== 'fallback') {
    throw new Error('expected {{unknown|defaultCity}} to resolve literal fallback')
  }

  await Promise.resolve()
}
