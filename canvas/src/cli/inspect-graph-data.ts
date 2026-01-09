import fs from 'node:fs'
import path from 'node:path'

import { parseGraph } from '@/lib/graph/io/adapter'

const argv = process.argv.slice(2)
const inputArg = argv[0]

if (!inputArg || !inputArg.trim()) {
  process.stderr.write('Usage: pnpm inspect-graph-data <path-to-json-or-jsonld-or-csv>\n')
  process.exit(1)
}

const inputPath = path.resolve(process.cwd(), inputArg.trim())

let text = ''
try {
  text = fs.readFileSync(inputPath, 'utf8')
} catch {
  process.stderr.write(`Failed to read input file at ${inputPath}\n`)
  process.exit(1)
}

let parsed
try {
  parsed = parseGraph(inputPath, text)
} catch (err) {
  const msg = String((err as Error)?.message || err || '')
  process.stderr.write(`Failed to parse graph: ${msg}\n`)
  process.exit(1)
}

const data = parsed.data
const diag = parsed.diag

process.stdout.write('GraphData Inspection\n')
process.stdout.write(`Path: ${inputPath}\n`)
process.stdout.write(`Format: ${diag.format}\n`)
process.stdout.write(`Warnings: ${diag.warnings.length}\n`)
process.stdout.write(`Nodes: ${Array.isArray(data.nodes) ? data.nodes.length : 0}\n`)
process.stdout.write(`Edges: ${Array.isArray(data.edges) ? data.edges.length : 0}\n`)

if (Array.isArray(data.nodes) && data.nodes.length > 0) {
  const sample = data.nodes[0]
  process.stdout.write('\nSample node\n')
  process.stdout.write(`${JSON.stringify(sample, null, 2)}\n`)
}

