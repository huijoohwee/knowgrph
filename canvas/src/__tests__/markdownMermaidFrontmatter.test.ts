import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function testMarkdownMermaidFrontmatterLabeledEdgeAndMentions() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(__dirname, 'sandbox/md-mmd-template.md')
  const markdown = readFileSync(path, 'utf8')

  const jsonld = buildMarkdownJsonLd(
    'file://md-mmd-template.md',
    markdown,
  )

  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []

  if (nodes.length === 0) {
    throw new Error('md-mmd-template produced no nodes')
  }

  const mermaidDiagramNodes = nodes.filter(n => {
    const type = String((n as { type?: unknown })?.type || (n as { ['@type']?: unknown })['@type'] || '')
    return type === 'MermaidDiagram'
  })

  if (mermaidDiagramNodes.length === 0) {
    throw new Error('expected a MermaidDiagram node from frontmatter mermaid block')
  }

  const semanticEdges = edges.filter(e => String((e as { label?: unknown }).label || '') === 'semanticRelation')
  if (semanticEdges.length > 0) {
    throw new Error('expected no semanticRelation edges derived from Mermaid frontmatter')
  }

  const entityNodes = nodes.filter(n => String((n as { type?: unknown }).type || (n as { ['@type']?: unknown })['@type'] || '') === 'Entity')
  const mermaidLinkedEntities = entityNodes.filter(n => {
    const props = (n as { properties?: unknown }).properties as Record<string, unknown> | undefined
    const inner = props && (props.properties as Record<string, unknown> | undefined)
    const fromMermaid = inner && inner.fromMermaidFrontmatter
    const hasMermaidKey = inner && inner.mermaidNodeKey
    return fromMermaid === true || typeof hasMermaidKey !== 'undefined'
  })

  if (mermaidLinkedEntities.length > 0) {
    throw new Error('expected no Entity nodes derived from Mermaid frontmatter')
  }

  const mentionNodes = nodes.filter(n => String((n as { type?: unknown }).type || (n as { ['@type']?: unknown })['@type'] || '') === 'Mention')
  const mermaidLinkedMentions = mentionNodes.filter(n => {
    const props = (n as { properties?: unknown }).properties as Record<string, unknown> | undefined
    const inner = props && (props.properties as Record<string, unknown> | undefined)
    const fromMermaid = inner && inner.fromMermaidFrontmatter
    const hasMermaidKey = inner && inner.mermaidNodeKey
    return fromMermaid === true || typeof hasMermaidKey !== 'undefined'
  })

  if (mermaidLinkedMentions.length > 0) {
    throw new Error('expected no Mention nodes derived from Mermaid frontmatter')
  }

  await Promise.resolve()
}
