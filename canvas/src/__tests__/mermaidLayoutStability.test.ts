import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils'
import { applyMermaidLayout } from '@/components/GraphCanvas/layout/mermaid'
import { defaultSchema } from '@/lib/graph/schema'

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

