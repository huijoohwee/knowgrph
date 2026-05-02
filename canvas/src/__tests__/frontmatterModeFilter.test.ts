import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export const testFrontmatterModeFiltersToFrontmatterMermaidOnly = () => {
  const markdown = readMarkdownSlideDemo()
  if (!markdown) return
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const frontmatterStart0 = lines.findIndex(l => String(l || '').trim() === '---')
  const frontmatterEnd0 = lines.findIndex((l, i) => i > frontmatterStart0 && String(l || '').trim() === '---')
  const mermaidKey0 =
    frontmatterStart0 >= 0 && frontmatterEnd0 > frontmatterStart0
      ? lines.findIndex((l, i) => i > frontmatterStart0 && i < frontmatterEnd0 && String(l || '').trim() === 'mermaid: |')
      : -1
  const allowedMermaidLineStart = mermaidKey0 >= 0 ? mermaidKey0 + 1 : 1
  const allowedMermaidLineEnd = frontmatterEnd0 >= 0 ? frontmatterEnd0 + 1 : allowedMermaidLineStart
  const mdPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'
  const jsonld = buildMarkdownJsonLd(mdPath, markdown)
  const graph = parseJsonLd(jsonld)
  const filtered = filterGraphToFrontmatterMermaid(graph)

  if (filtered.nodes.length === 0) {
    throw new Error('expected frontmatter filter to include Mermaid nodes')
  }

  const allowedTypes = new Set(['MermaidDiagram', 'MermaidNode', 'MermaidSubgraph'])
  let sawFrontmatterMermaid = false
  for (let i = 0; i < filtered.nodes.length; i += 1) {
    const n = filtered.nodes[i]
    if (!allowedTypes.has(String(n.type || ''))) {
      throw new Error(`unexpected node type in frontmatter mode: ${String(n.type || '')}`)
    }
    const m = n.metadata || {}
    const ls = typeof m.lineStart === 'number' ? m.lineStart : Number.NaN
    const le = typeof m.lineEnd === 'number' ? m.lineEnd : Number.NaN
    if (!Number.isFinite(ls) || !Number.isFinite(le)) {
      throw new Error(`expected node ${String(n.id)} to have lineStart/lineEnd metadata`)
    }
    if (String(n.type || '') === 'MermaidDiagram' || String(n.type || '') === 'MermaidNode' || String(n.type || '') === 'MermaidSubgraph') {
      sawFrontmatterMermaid = true
      if (ls < allowedMermaidLineStart || le > allowedMermaidLineEnd) {
        throw new Error(`expected mermaid node ${String(n.id)} to be within frontmatter mermaid line range`)
      }
    }
  }

  if (!sawFrontmatterMermaid) {
    throw new Error('expected at least one Mermaid node/subgraph/diagram in filtered graph')
  }
}

export const testLayerDerivationReusesSharedPropertyAndEndpointReaders = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'layerDerivation.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'")) {
    throw new Error('expected layerDerivation to reuse the shared edge endpoint reader upstream')
  }
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected layerDerivation to reuse the shared node property reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected layerDerivation to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const p = readNodeProperties(n)')) {
    throw new Error('expected frontmatter Mermaid node detection to reuse the shared node property reader')
  }
  if (!text.includes('const props = readNodeProperties(n)')) {
    throw new Error('expected layerDerivation parent and flow node reads to reuse the shared node property reader')
  }
  if (!text.includes('const src = readEdgeEndpointId(e.source)')) {
    throw new Error('expected frontmatter Mermaid edge filtering to reuse the shared edge endpoint reader')
  }
  if (!text.includes('const src = readEdgeEndpointId((e as { source?: unknown }).source)')) {
    throw new Error('expected frontmatter Flow edge filtering to reuse the shared edge endpoint reader')
  }
  if (text.includes('const normalizeEndpointId = (v: unknown): string => {')) {
    throw new Error('expected layerDerivation to stop defining a local endpoint normalization helper')
  }
  if (text.includes('function readEndpointId(v: unknown): string {')) {
    throw new Error('expected layerDerivation to stop defining a duplicate endpoint reader helper')
  }
  if (text.includes('const isRecord = (v: unknown): v is Record<string, unknown>')) {
    throw new Error('expected layerDerivation to stop defining a local plain-object guard')
  }
}
