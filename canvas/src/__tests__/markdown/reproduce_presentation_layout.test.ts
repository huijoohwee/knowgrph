
import { readFileSync } from 'node:fs'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils'
import { applyMermaidLayout } from '@/components/GraphCanvas/layout/mermaid'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'

export async function testMermaidLayoutForPresentationSlides() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  // 1. Load the specific markdown file
  const mdPathRaw =
    typeof process !== 'undefined' ? process.env.KG_PRESENTATION_SLIDES_MD_PATH : null
  const mdPath = typeof mdPathRaw === 'string' ? mdPathRaw.trim() : ''
  if (!mdPath) {
    await Promise.resolve()
    return
  }
  let markdown = ''
  try {
    markdown = readFileSync(mdPath, 'utf8')
  } catch {
    console.warn('Could not read presentation slides file locally, skipping test payload verification.')
    return
  }

  // 2. Parse it
  const jsonld = buildMarkdownJsonLd('file://presentation.md', markdown)
  // console.log('JSONLD Metadata:', JSON.stringify(jsonld.metadata, null, 2))
  const meta = jsonld.metadata as unknown
  const hasMermaidMeta =
    typeof meta === 'object' && meta !== null && 'mermaid' in meta && (meta as { mermaid?: unknown }).mermaid != null
  if (!hasMermaidMeta) console.log('No mermaid metadata found')
  
  const res = applyParser(toParserId('jsonld'), {
    name: 'presentation.jsonld',
    text: JSON.stringify(jsonld),
  })
  
  if (!res || !res.graphData) throw new Error('Parser failed')
  
  // Debug: check what nodes we have before filtering
  // const allNodes = (res.graphData.nodes || []) as any[]
  // console.log('Total nodes:', allNodes.length)
  // console.log('Sample node:', JSON.stringify(allNodes[0], null, 2))

  // 3. Filter to Frontmatter Mermaid
  const scoped = filterGraphToFrontmatterMermaid(res.graphData, 'presentation.md')
  if (!scoped || !scoped.nodes || scoped.nodes.length === 0) {
    const nodes = (res.graphData.nodes || []) as GraphNode[]
    const mermaidNodes = nodes.filter(n => n.type === 'MermaidNode' || n.type === 'MermaidSubgraph')
    console.log(`Debug: Total Nodes: ${nodes.length}, Mermaid Nodes: ${mermaidNodes.length}`)
    if (mermaidNodes.length > 0) {
      console.log('Sample Mermaid Node:', JSON.stringify(mermaidNodes[0], null, 2))
    }
    throw new Error('No Mermaid nodes found in frontmatter')
  }

  console.log(`Found ${scoped.nodes.length} nodes and ${scoped.edges?.length} edges`)

  // 4. Apply Layout with 16:9 target
  const width = 1920
  const height = 1080
  
  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'mermaid' as const,
      mermaid: {
          separation: 1.5 // As requested for spread
      }
    },
  }

  const nodes = JSON.parse(JSON.stringify(scoped.nodes))
  const edges = normalizeEdgesForSim(nodes, scoped.edges || [])

  applyMermaidLayout(nodes, edges, width, height, schema)

  // 5. Analyze Bounds (use Visual Bounds logic)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
      if (typeof n.x === 'number' && typeof n.y === 'number') {
          const w = Number(n.properties?.['visual:width']) || 0
          const h = Number(n.properties?.['visual:height']) || 0
          
          const left = n.x - w / 2
          const right = n.x + w / 2
          const top = n.y - h / 2
          const bottom = n.y + h / 2
          
          minX = Math.min(minX, left)
          maxX = Math.max(maxX, right)
          minY = Math.min(minY, top)
          maxY = Math.max(maxY, bottom)
      }
  }

  const graphW = maxX - minX
  const graphH = maxY - minY
  const aspectRatio = graphW / graphH

  console.log(`Layout Result: W=${graphW.toFixed(0)}, H=${graphH.toFixed(0)}, AR=${aspectRatio.toFixed(2)}`)
  
  // Check if centered (Bounding Box Center)
  const cx = minX + graphW / 2
  const cy = minY + graphH / 2
  const targetCx = width / 2
  const targetCy = height / 2
  
  // Allow small floating point error
  if (Math.abs(cx - targetCx) > 1) throw new Error(`Graph not centered X: ${cx} vs ${targetCx}`)
  if (Math.abs(cy - targetCy) > 1) throw new Error(`Graph not centered Y: ${cy} vs ${targetCy}`)

  // Check 16:9 "fill-up"
  // Since we capped separation, AR should be more reasonable (e.g. < 5)
  if (aspectRatio > 10) console.warn(`Graph very wide (AR=${aspectRatio.toFixed(2)})`)
  else console.log(`Graph Aspect Ratio: ${aspectRatio.toFixed(2)}`)
  
  await Promise.resolve()
}
