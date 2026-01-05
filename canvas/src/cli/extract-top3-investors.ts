import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type GraphNode = { id?: string; data?: { degree?: number } }
type GraphEdge = { source?: string; target?: string }
type Graph = { nodes?: GraphNode[]; edges?: GraphEdge[] }

const inputPath = path.resolve(process.cwd(), '..', 'test-data', 'unicorn-investors-test.json')
const outputPath = path.resolve(process.cwd(), '..', 'test-data', 'unicorn-investors-top-3-test.json')

async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf-8'))
}

function byDegreeDesc(a: GraphNode, b: GraphNode): number {
  const da = a.data?.degree ?? 0
  const db = b.data?.degree ?? 0
  return db - da
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

async function main(): Promise<void> {
  const data = (await loadJson(inputPath)) as Graph
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []
  const top = nodes.slice().sort(byDegreeDesc).slice(0, 3)
  const topIds = new Set(top.map(node => node.id).filter(Boolean) as string[])
  const filteredEdges = edges.filter(edge => (edge.source && topIds.has(edge.source)) || (edge.target && topIds.has(edge.target)))
  const connectedIds = new Set(unique(filteredEdges.flatMap(edge => [edge.source, edge.target].filter(Boolean) as string[])))
  const filteredNodes = nodes.filter(node => (node.id ? connectedIds.has(node.id) : false))
  const result = { nodes: filteredNodes, edges: filteredEdges }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
}

void main()

