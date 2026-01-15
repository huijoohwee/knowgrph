import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { schemaFromJsonLd } from '@/features/schema/schemaJsonLd'

export async function testMarkdownMermaidFrontmatterTreeMetadataDefaults() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(process.cwd(), 'src/__tests__/sandbox/md-mmd-template.md')
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

  const schema = schemaFromJsonLd(jsonld)
  const meta = schema.metadata as Record<string, unknown> | undefined
  if (!meta) {
    throw new Error('expected schema.metadata to be present')
  }
  const tree = (meta.tree || meta.mermaid) as Record<string, unknown> | undefined
  if (!tree) {
    throw new Error('expected metadata.tree or metadata.mermaid to be present')
  }

  const orientation = tree.orientation
  const separation = tree.separation

  if (orientation !== 'vertical') {
    throw new Error(`expected metadata.tree.orientation === "vertical", got ${String(orientation)}`)
  }
  if (separation !== 1.5) {
    throw new Error(`expected metadata.tree.separation === 1.5, got ${String(separation)}`)
  }

  const density = tree.mermaidDensity as Record<string, unknown> | undefined
  if (!density) {
    throw new Error('expected metadata.tree.mermaidDensity to be present')
  }
  const statementCount = density.statementCount
  if (typeof statementCount !== 'number' || !Number.isFinite(statementCount) || statementCount <= 0) {
    throw new Error(`expected positive mermaidDensity.statementCount, got ${String(statementCount)}`)
  }
  const densityLabel = String(density.density || '')
  if (!densityLabel) {
    throw new Error('expected non-empty mermaidDensity.density label')
  }
  if (densityLabel !== 'sparse') {
    throw new Error(`expected mermaidDensity.density === "sparse", got ${densityLabel}`)
  }

  await Promise.resolve()
}

export async function testMarkdownMermaidClassDefAppliesVisualStylesToNodes() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '---',
    'title: Mermaid classDef test',
    'mermaid: |',
    '  graph TD',
    '    A[Alpha] --> B[Beta]',
    '    classDef phaseStyle fill:#f4f4f4,stroke:#333,stroke-width:2px,color:#111;',
    '    class A phaseStyle',
    '---',
    '',
    '# Title',
  ].join('\n')

  const jsonld = buildMarkdownJsonLd('file://mermaid-classdef.md', markdown)
  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  const a = nodes.find(n => {
    const type = String((n as { type?: unknown }).type || '')
    if (type !== 'MermaidNode') return false
    const props = ((n as { properties?: unknown }).properties || {}) as Record<string, unknown>
    return String(props.nodeName || '') === 'A'
  }) as { properties?: unknown } | undefined

  if (!a) throw new Error('expected MermaidNode A to be present')
  const props = (a.properties || {}) as Record<string, unknown>

  if (props['visual:fill'] !== '#f4f4f4') {
    throw new Error(`expected visual:fill to match classDef, got ${String(props['visual:fill'])}`)
  }
  if (props['visual:stroke'] !== '#333') {
    throw new Error(`expected visual:stroke to match classDef, got ${String(props['visual:stroke'])}`)
  }
  if (props['visual:strokeWidth'] !== 2) {
    throw new Error(`expected visual:strokeWidth to match classDef, got ${String(props['visual:strokeWidth'])}`)
  }
  if (props['visual:color'] !== '#111') {
    throw new Error(`expected visual:color to match classDef, got ${String(props['visual:color'])}`)
  }

  await Promise.resolve()
}
