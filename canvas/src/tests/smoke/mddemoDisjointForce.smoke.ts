import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { readSandboxDemoText, toDocumentPath } from '@/tests/lib/sandboxRoot'
import { buildSimulation, normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const demo = readSandboxDemoText({ preferBasename: 'mddemo.md' })
if (!demo) process.exit(0)

const docPath = toDocumentPath(demo.path) || 'mddemo.md'
const jsonld = buildMarkdownJsonLd(docPath, demo.text)
const graphData = parseJsonLd(jsonld)
const derived = deriveSceneDisplayGraph({ graphData })
assert(derived, 'expected display graph derivation')

const displayNodes = Array.isArray(derived.displayGraphData.nodes) ? (derived.displayGraphData.nodes as GraphNode[]) : []
const displayEdges = Array.isArray(derived.displayGraphData.edges) ? (derived.displayGraphData.edges as GraphEdge[]) : []
assert(displayNodes.length > 0, 'expected nodes in display graph')

const nodes = displayNodes.map(n => ({ ...n }))
const edgesForSim = normalizeEdgesForSim(nodes, displayEdges)
const edges = edgesForSim.map(e => ({ ...e }))

const schema = {
  ...defaultSchema,
  layout: {
    ...(defaultSchema.layout || {}),
    forces: {
      ...((defaultSchema.layout || {}).forces || {}),
      disjointComponents: true,
      postFitForce: false,
    },
  },
}

const sim = buildSimulation(nodes, edges, 928, 680, schema, { skipInitialLayout: false })
let preSumX = 0
let preSumY = 0
let preCount = 0
for (let i = 0; i < nodes.length; i += 1) {
  const n = nodes[i]!
  if (typeof n.x !== 'number' || !Number.isFinite(n.x) || typeof n.y !== 'number' || !Number.isFinite(n.y)) continue
  preSumX += n.x
  preSumY += n.y
  preCount += 1
}
const preMeanX = preCount > 0 ? preSumX / preCount : NaN
const preMeanY = preCount > 0 ? preSumY / preCount : NaN
sim.alpha(1)
for (let i = 0; i < 320; i += 1) sim.tick()
sim.stop()

let sumX = 0
let sumY = 0
let count = 0
let minX = Infinity
let maxX = -Infinity
let minY = Infinity
let maxY = -Infinity
for (let i = 0; i < nodes.length; i += 1) {
  const n = nodes[i]!
  if (typeof n.x !== 'number' || !Number.isFinite(n.x) || typeof n.y !== 'number' || !Number.isFinite(n.y)) continue
  if (n.x < minX) minX = n.x
  if (n.x > maxX) maxX = n.x
  if (n.y < minY) minY = n.y
  if (n.y > maxY) maxY = n.y
  sumX += n.x
  sumY += n.y
  count += 1
}
assert(count > 0, 'expected finite node positions after simulation ticks')

const meanX = sumX / count
const meanY = sumY / count

assert(Math.abs(meanX) < 180, `expected meanX near 0, got ${meanX} (preMeanX=${preMeanX}, preMeanY=${preMeanY}, count=${count}, spanX=${maxX - minX}, spanY=${maxY - minY})`)
assert(Math.abs(meanY) < 180, `expected meanY near 0, got ${meanY} (preMeanX=${preMeanX}, preMeanY=${preMeanY}, count=${count}, spanX=${maxX - minX}, spanY=${maxY - minY})`)
