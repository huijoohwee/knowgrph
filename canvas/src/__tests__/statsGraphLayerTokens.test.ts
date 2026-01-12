import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { defaultSchema, getRendererPalette, type GraphSchema } from '@/lib/graph/schema'
import { buildNodeGroupsFromSchema, getGraphLayerStyleForGroup } from '@/components/GraphCanvas/graphLayers'

export async function testStatsTokensByGraphLayerUsesPaletteFillForMarkdownSlideDemo() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const path = resolve(new URL('.', import.meta.url).pathname, 'demo/markdown-slide-demo.md')
  const markdown = readFileSync(path, 'utf8')

  const jsonld = buildMarkdownJsonLd('file://markdown-slide-demo.md', markdown)

  const res = applyParser(toParserId('jsonld'), {
    name: 'markdown-slide-demo.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null for markdown-slide-demo')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings for markdown-slide-demo: ${res.warnings.join('; ')}`)
  }

  const baseGraph = res.graphData as GraphData
  const schema: GraphSchema = {
    ...defaultSchema,
    layers: {
      ...(defaultSchema.layers || {}),
      mode: 'semantic',
      semantic: {
        ...(defaultSchema.layers?.semantic || {}),
        similarityEdgeLabel: 'pointsTo',
        textKeys: [],
        topKEdgesPerNode: 0,
        minSimilarity: 0,
      },
      documentStructure: {
        minGroupSize: 2,
      },
    },
  }

  const graph = deriveGraphDataForLayers(baseGraph, schema)
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('expected derived graphData for markdown-slide-demo in semantic layer mode')
  }

  const groups = buildNodeGroupsFromSchema(graph, schema)
  if (!groups.length) {
    throw new Error('expected buildNodeGroupsFromSchema to produce at least one group for markdown-slide-demo')
  }

  const palette = getRendererPalette(schema)
  const ideaColor = palette.nodes.idea

  const anyGroup = groups[0]
  const style = getGraphLayerStyleForGroup({
    group: anyGroup,
    graphData: graph,
    schema,
  })

  if (typeof style.fill !== 'string' || !style.fill.trim()) {
    throw new Error('expected graph layer style to have a non-empty fill color for markdown-slide-demo group')
  }

  if (style.fill !== ideaColor) {
    throw new Error(
      `expected tokensByGraphLayer-style fill to reuse renderer palette idea color ${ideaColor}, got ${style.fill}`,
    )
  }

  await Promise.resolve()
}

