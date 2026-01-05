import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type GraphNode = { id?: string; data?: Record<string, unknown> }
type GraphEdge = { id?: string; source?: string; target?: string; data?: Record<string, unknown> }
type Graph = { nodes?: GraphNode[]; edges?: GraphEdge[] }

const inputPath = path.resolve(process.cwd(), '..', 'test-data', 'unicorn-investors-top-3-test.json')
const outputPath = path.resolve(process.cwd(), '..', 'test-data', 'unicorn-investors-top-3-test.csv')

async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf-8'))
}

function escapeCsv(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value)
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const head = headers.join(',')
  const body = rows.map(row => headers.map(header => escapeCsv(row[header])).join(',')).join('\n')
  return `${head}\n${body}\n`
}

async function main(): Promise<void> {
  const data = (await loadJson(inputPath)) as Graph
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  const rows: Array<Record<string, unknown>> = []
  for (const node of nodes) {
    const d = node.data ?? {}
    rows.push({
      kind: 'node',
      id: node.id ?? '',
      name: (d as Record<string, unknown>).name ?? '',
      type: (d as Record<string, unknown>).type ?? '',
      degree: (d as Record<string, unknown>).degree ?? '',
      source: '',
      target: '',
      edge_type: '',
      weight: '',
    })
  }
  for (const edge of edges) {
    const d = edge.data ?? {}
    rows.push({
      kind: 'edge',
      id: edge.id ?? '',
      name: '',
      type: '',
      degree: '',
      source: edge.source ?? '',
      target: edge.target ?? '',
      edge_type: (d as Record<string, unknown>).type ?? '',
      weight: (d as Record<string, unknown>).weight ?? '',
    })
  }

  const headers = ['kind', 'id', 'name', 'type', 'degree', 'source', 'target', 'edge_type', 'weight']
  await writeFile(outputPath, toCsv(rows, headers), 'utf-8')
}

void main()

