import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils'
import { applyMermaidLayout } from '@/components/GraphCanvas/layout/mermaid'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function testMermaidLayoutDoesNotFailOnMarkdownSlideDemo() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const mdPath = resolve(__dirname, 'demo/markdown-slide-demo.md')
  const markdown = readFileSync(mdPath, 'utf8')

  const jsonld = buildMarkdownJsonLd('file://markdown-slide-demo.md', markdown)
  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const scoped = filterGraphToFrontmatterMermaid(res.graphData, 'markdown-slide-demo.md')
  if (!scoped) throw new Error('frontmatter filter returned null')

  const nodes = scoped.nodes || []
  const edgesForSim = normalizeEdgesForSim(nodes, scoped.edges || [])

  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'mermaid' as const,
    },
  }

  const originalError = console.error
  const errors: string[] = []
  console.error = (...args: unknown[]) => {
    errors.push(args.map(a => String(a)).join(' '))
    originalError(...args)
  }
  try {
    applyMermaidLayout(nodes, edgesForSim, 1200, 800, schema)
  } finally {
    console.error = originalError
  }

  const hadDagreFailure = errors.some(e => e.includes('Mermaid Layout: Dagre layout failed'))
  if (hadDagreFailure) throw new Error('expected mermaid layout not to fail for markdown-slide-demo')

  await Promise.resolve()
}

export async function testMermaidComplexSubgraphEdges() {
  // Mock graph with edges connecting to subgraphs (which causes Dagre network-simplex to crash if not handled)
  const nodes: GraphNode[] = [
    { id: 'Start', type: 'MermaidNode', label: 'Start', properties: {} },
    { id: 'Container', type: 'MermaidSubgraph', label: 'Container', properties: { subgraphName: 'Container' } },
    { id: 'Inside', type: 'MermaidNode', label: 'Inside', properties: { mermaidSubgraphName: 'Container' } },
    { id: 'End', type: 'MermaidNode', label: 'End', properties: {} },
  ]
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'Start', target: 'Container', label: 'pointsTo', properties: {} },
    { id: 'e2', source: 'Container', target: 'End', label: 'pointsTo', properties: {} },
  ]

  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'mermaid' as const,
    },
  }

  // Should not throw
  applyMermaidLayout(nodes, edges, 1000, 1000, schema)
  
  // Verify edges have points
  const e1 = edges.find(e => e.id === 'e1')
  const e2 = edges.find(e => e.id === 'e2')
  
  if (!e1?.properties?.['visual:points']) throw new Error('Edge to subgraph missing points')
  if (!e2?.properties?.['visual:points']) throw new Error('Edge from subgraph missing points')

  await Promise.resolve()
}

export async function testMermaidExternalMarkdownDemoFits1920x1080() {
  const mdPathRaw = typeof process !== 'undefined' ? process.env.KG_DEMO_MARKDOWN_PATH : null
  const mdPath = typeof mdPathRaw === 'string' ? mdPathRaw.trim() : ''
  if (!mdPath) {
    await Promise.resolve()
    return
  }

  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = readFileSync(mdPath, 'utf8')
  const baseName = mdPath.replace(/\\/g, '/').split('/').pop() || 'external.md'

  const jsonld = buildMarkdownJsonLd(`file://${baseName}`, markdown)
  const res = applyParser(toParserId('jsonld'), {
    name: 'doc.jsonld',
    text: JSON.stringify(jsonld),
  })
  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const scoped = filterGraphToFrontmatterMermaid(res.graphData, baseName)
  if (!scoped) throw new Error('frontmatter filter returned null')

  const nodes = scoped.nodes || []
  const edgesForSim = normalizeEdgesForSim(nodes, scoped.edges || [])

  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'mermaid' as const,
    },
  }

  applyMermaidLayout(nodes, edgesForSim, 1920, 1080, schema)

  const t = fitAllTransform(nodes, 1920, 1080, {
    pad: 48,
    enforceAspectRatio: false,
    maxScale: 6,
    maxScaleHardCap: 6,
  })

  const clampToViewport = (v: number) => Math.max(-2, Math.min(1922, v))

  for (const n of nodes) {
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const vw = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
    const vh = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
    const halfW = vw > 0 ? vw / 2 : 0
    const halfH = vh > 0 ? vh / 2 : 0
    const sx = t.k * x + t.x
    const sy = t.k * y + t.y
    const left = clampToViewport(sx - halfW * t.k)
    const right = clampToViewport(sx + halfW * t.k)
    const top = clampToViewport(sy - halfH * t.k)
    const bottom = clampToViewport(sy + halfH * t.k)
    if (left < 0 || right > 1920 || top < 0 || bottom > 1080) {
      throw new Error(`node ${String(n.id)} overflows viewport after fit transform`)
    }
  }

  for (const e of edgesForSim) {
    const props = (e.properties || {}) as Record<string, unknown>
    const pts = props['visual:points']
    if (!Array.isArray(pts)) continue
    for (const p of pts) {
      const px = typeof p === 'object' && p !== null && 'x' in p ? (p as { x?: unknown }).x : undefined
      const py = typeof p === 'object' && p !== null && 'y' in p ? (p as { y?: unknown }).y : undefined
      if (typeof px !== 'number' || typeof py !== 'number') continue
      const sx = clampToViewport(t.k * px + t.x)
      const sy = clampToViewport(t.k * py + t.y)
      if (sx < 0 || sx > 1920 || sy < 0 || sy > 1080) {
        throw new Error('edge point overflows viewport after fit transform')
      }
    }
  }

  await Promise.resolve()
}
