import fs from 'node:fs'
import path from 'node:path'

import { parseJsonLd, agenticRagNodeFromGraphNode } from '@/lib/graph/jsonld'
import { findGraphRagTraversalEdgeIds, toParsedTraversePath, isGraphRagPathValue } from '@/lib/graph/graphragTraversal'
import type { GraphData, JSONValue } from '@/lib/graph/types'

const argv = process.argv.slice(2)
const shouldDumpParsed = argv.includes('--dump-parsed') || argv.includes('-p')
const inputArg = argv.find(arg => arg !== '--dump-parsed' && arg !== '-p')

const defaultInput = path.resolve(process.cwd(), '..', 'test-data', 'codebase-index-graphRAGPath-canvas.jsonld')
const inputPath = inputArg && inputArg.trim() ? path.resolve(process.cwd(), inputArg.trim()) : defaultInput

let rawText = ''
try {
  rawText = fs.readFileSync(inputPath, 'utf8')
} catch {
  process.stderr.write(`Failed to read JSON-LD at ${inputPath}\n`)
  process.exit(1)
}

let jsonld: unknown
try {
  jsonld = JSON.parse(rawText) as unknown
} catch {
  process.stderr.write('Input file is not valid JSON\n')
  process.exit(1)
}

const graph: GraphData = parseJsonLd(jsonld)

const agenticNodes = graph.nodes.map(agenticRagNodeFromGraphNode)

const owner = agenticNodes.find(node => {
  const props = node.properties || {}
  const value = (props as { [key: string]: unknown }).graphRAGPath
  return !!value && typeof value === 'object' && !Array.isArray(value)
})

if (!owner) {
  process.stderr.write('No node with graphRAGPath found in input graph\n')
  process.exit(1)
}

const ownerProps = owner.properties ?? {}
const rawPath = (ownerProps as Record<string, JSONValue>).graphRAGPath
const parsedPath = isGraphRagPathValue(rawPath) ? toParsedTraversePath(rawPath) : null

const edgeIds = findGraphRagTraversalEdgeIds(graph)

const nodeById = new Map(graph.nodes.map(n => [String(n.id), n]))
const edgesById = new Map(graph.edges.map(e => [String(e.id), e]))

const pathNodes = edgeIds.length === 0 ? [] : (() => {
  const ownerId = String(owner.id)
  const result = [ownerId]
  const neighbors = new Map<string, string[]>()
  graph.edges.forEach(e => {
    const list = neighbors.get(String(e.source)) || []
    list.push(String(e.target))
    neighbors.set(String(e.source), list)
  })
  let current = ownerId
  for (const edgeId of edgeIds) {
    const edge = edgesById.get(edgeId)
    if (!edge) continue
    const nextId = String(edge.source) === current ? String(edge.target) : String(edge.source)
    result.push(nextId)
    current = nextId
  }
  return result
})()

process.stdout.write('AgenticRAG trace for Canvas codebase path\n')
process.stdout.write('=========================================\n\n')

process.stdout.write(`Input JSON-LD: ${inputPath}\n\n`)

if (shouldDumpParsed) {
  process.stdout.write('Parsed AgenticRAG traverse path (before edge selection):\n')
  if (!parsedPath) {
    process.stdout.write('  <none>\n\n')
  } else {
    const payload = {
      query: parsedPath.query ?? null,
      traverse: Array.isArray(parsedPath.traverse) ? parsedPath.traverse.map(id => String(id)) : [],
      multiHop: Array.isArray(parsedPath.multiHop) ? parsedPath.multiHop : [],
    }
    try {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n\n`)
    } catch {
      process.stdout.write('  Parsed path is present but could not be serialized.\n\n')
    }
  }
}

process.stdout.write('Owner node (with graphRAGPath):\n')
process.stdout.write(`  id: ${owner.id}\n`)
process.stdout.write(`  labels: ${owner.labels.join(', ')}\n`)
process.stdout.write(`  has chunk_text: ${owner.chunkText ? 'yes' : 'no'}\n`)
process.stdout.write('\n')

process.stdout.write('Traversal edges (in order):\n')
if (edgeIds.length === 0) {
  process.stdout.write('  <none>\n\n')
} else {
  edgeIds.forEach((edgeId, index) => {
    const edge = edgesById.get(edgeId)
    if (!edge) return
    process.stdout.write(
      `  ${index + 1}. ${edge.id}: ${edge.label} ${edge.source} -> ${edge.target}\n`,
    )
  })
  process.stdout.write('\n')
}

process.stdout.write('Traversal nodes (owner + path):\n')
if (pathNodes.length === 0) {
  process.stdout.write('  <none>\n')
} else {
  pathNodes.forEach((nodeId, index) => {
    const node = nodeById.get(nodeId)
    const label = node ? node.label : '<missing>'
    process.stdout.write(`  ${index + 1}. ${nodeId} (${label})\n`)
  })
}
process.stdout.write('\n')
