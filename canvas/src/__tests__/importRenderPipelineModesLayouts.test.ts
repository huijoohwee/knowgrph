import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import { mergeKeywordGraphWithSourceNodes } from '@/hooks/useActiveGraphData'
import { deriveSceneDisplayGraph, deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { buildDagreLayout, buildFastGridLayout } from '@/components/FlowCanvas/layout'
import { computeLayoutDatasetKey, determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'
import { fibSphere } from '@/features/three/layout'
import { computePositions3d } from '@/features/three/positions'
import { projectPositionsToSphereShell } from '@/features/three/sphereConstraint'
import { computeFlowHandlesByNode, ensureFlowHandlesHaveDefaults } from '@/components/FlowCanvas/handles'
import { togglePortHandlesEnabledInSchema, shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import type { GraphNode } from '@/lib/graph/types'

const readSlideDemoOrFallback = (): { nameForParse: string; text: string; documentPath: string } => {
  const docPath = resolveMarkdownSlideDemoDocumentPath() || 'sandbox/demo/markdown-slide-demo.md'
  const text = readMarkdownSlideDemo()
  if (text && text.trim()) {
    return { nameForParse: docPath, text, documentPath: docPath }
  }
  const fallback = ['---', 'mermaid: |', '  graph LR', '    A --> B', '---', '', '# Title', '', '- A', '- B', ''].join('\n')
  return { nameForParse: docPath, text: fallback, documentPath: docPath }
}

const toSimpleFlowGraph = (graphData: { nodes?: unknown; edges?: unknown }) => {
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as Array<{ id?: unknown }>) : []
  const edges = Array.isArray(graphData.edges)
    ? (graphData.edges as Array<{ id?: unknown; source?: unknown; target?: unknown }>)
    : []
  const flowNodes = nodes
    .map(n => ({ id: String(n?.id ?? '').trim() }))
    .filter(n => n.id)
    .slice(0, 300)
  const nodeIdSet = new Set(flowNodes.map(n => n.id))
  const flowEdges = edges
    .map(e => ({
      id: String(e?.id ?? '').trim() || `${String(e?.source ?? '')}->${String(e?.target ?? '')}`,
      source: String(e?.source ?? '').trim(),
      target: String(e?.target ?? '').trim(),
    }))
    .filter(e => e.source && e.target && nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
    .slice(0, 600)
  return { flowNodes, flowEdges }
}

export const testImportRenderPipelineAcrossModesAndLayouts = async () => {
  useGraphStore.getState().resetAll()

  const { nameForParse, text, documentPath } = readSlideDemoOrFallback()
  const res = await loadGraphDataFromTextViaParser(nameForParse, text, { applyToStore: true })
  if (!res?.graphData) throw new Error('expected graphData from import')
  if ((res.graphData.nodes || []).length === 0 && (res.graphData.edges || []).length === 0) {
    throw new Error('expected import to yield non-empty graph')
  }

  const afterImport = useGraphStore.getState()
  if (afterImport.markdownDocumentName !== documentPath) {
    throw new Error(`expected markdownDocumentName to be set by import, got ${String(afterImport.markdownDocumentName || '')}`)
  }
  if (afterImport.markdownDocumentText !== text) {
    throw new Error('expected markdownDocumentText to be set by import')
  }
  afterImport.setDocumentSemanticMode('document')
  afterImport.setFrontmatterModeEnabled(true)

  const baseGraph = useGraphStore.getState().graphData
  if (!baseGraph) throw new Error('expected store.graphData after import')

  const effectiveFrontmatter = computeEffectiveFrontmatterMode({
    graphData: baseGraph,
    frontmatterModeEnabled: useGraphStore.getState().frontmatterModeEnabled,
    documentSemanticMode: useGraphStore.getState().documentSemanticMode,
  })

  const frontmatterGraph = effectiveFrontmatter ? filterGraphToFrontmatterMermaid(baseGraph) : baseGraph
  const display = deriveSceneDisplayGraph({ graphData: frontmatterGraph })
  if (!display) throw new Error('expected scene display derivation to succeed')
  if (display.displayNodes.length === 0) throw new Error('expected display nodes after import')

  const schema = useGraphStore.getState().schema
  const groups = deriveSceneGroups({
    graphData: frontmatterGraph,
    graphDataRevision: useGraphStore.getState().graphDataRevision,
    schema,
    documentSemanticMode: useGraphStore.getState().documentSemanticMode,
    frontmatterModeEnabled: !!effectiveFrontmatter,
  })
  if (!groups) throw new Error('expected group derivation to succeed')
  if (!groups.key.trim()) throw new Error('expected group derivation cache key')

  const { flowNodes, flowEdges } = toSimpleFlowGraph(display.displayGraphData)
  if (flowNodes.length === 0) throw new Error('expected flow nodes for layout')
  const dagre = buildDagreLayout({ nodes: flowNodes, edges: flowEdges, rankdir: 'TB' })
  const grid = buildFastGridLayout({ nodes: flowNodes })
  if (Object.keys(dagre).length === 0 && Object.keys(grid).length === 0) {
    throw new Error('expected at least one 2d layout to yield positions')
  }

  const datasetKey = computeLayoutDatasetKey({
    graphData: frontmatterGraph,
    graphDataRevision: useGraphStore.getState().graphDataRevision,
  })
  const layout = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: !!effectiveFrontmatter,
    semanticMode: useGraphStore.getState().documentSemanticMode,
    renderMode: '2d',
    renderVariant: 'd3',
    prevViewKey: null,
    prevDatasetKey: null,
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    prevRenderVariant: null,
    prevLayoutVariant: null,
    nodes: display.displayNodes,
    layoutPositionCacheByMode: useGraphStore.getState().layoutPositionCacheByMode,
  })
  if (!layout.cacheKey.trim()) throw new Error('expected layout cache key')

  useGraphStore.getState().setDocumentSemanticMode('keyword')
  const keywordText = text.length > 10_000 ? text.slice(0, 10_000) : text
  const keyword = deriveKeywordGraphFromText({ documentId: `doc:${documentPath}`, documentText: keywordText }).graph
  const keywordMerged = mergeKeywordGraphWithSourceNodes({
    baseGraphData: baseGraph,
    keywordGraph: keyword,
    sourceId: `doc:${documentPath}`,
  })
  if ((keywordMerged.nodes || []).length === 0) throw new Error('expected keyword mode graph nodes')

  const keywordDatasetKey = computeLayoutDatasetKey({
    graphData: keywordMerged,
    graphDataRevision: useGraphStore.getState().graphDataRevision,
  })
  if (!keywordDatasetKey.trim()) throw new Error('expected keyword dataset key')

  const handlesByNode = computeFlowHandlesByNode({
    nodes: (keywordMerged.nodes || []).slice(0, 40) as unknown as Array<{ id: unknown; type?: unknown; properties?: unknown }>,
    edges: (keywordMerged.edges || []).slice(0, 80) as unknown as Array<{ id: unknown; source: unknown; target: unknown; properties?: unknown }>,
    nodeQuickEditorRegistry: null,
  })
  const anyHandles = Object.values(handlesByNode)[0]
  if (anyHandles) {
    const ensured = ensureFlowHandlesHaveDefaults(anyHandles)
    if (ensured.in.length === 0 || ensured.out.length === 0) throw new Error('expected flow handle defaults')
  }

  const portToggled = togglePortHandlesEnabledInSchema(schema)
  if (!portToggled.changed) throw new Error('expected port handles schema toggle to report changed')
  const inject = shouldInjectDefaultFlowHandles(portToggled.schema)
  if (typeof inject !== 'boolean') throw new Error('expected port handles inject predicate')
}

export const testImportRenderPipelineRadialLayoutForces2d = () => {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setCanvasRenderMode('3d')
  useGraphStore.getState().setCanvas2dRenderer('flow')
  const schema = useGraphStore.getState().schema
  const next = { ...schema, layout: { ...(schema.layout || {}), mode: 'radial' as const } }
  useGraphStore.getState().setSchema(next)
  const mode = useGraphStore.getState().canvasRenderMode
  if (mode !== '2d') {
    throw new Error(`expected radial layout to force canvasRenderMode=2d, got ${String(mode)}`)
  }
  const renderer = useGraphStore.getState().canvas2dRenderer
  if (renderer !== 'd3') {
    throw new Error(`expected radial layout to force canvas2dRenderer=d3, got ${String(renderer)}`)
  }
}

export const testImportRenderPipelineThreeFibSphereStable = () => {
  const pts = fibSphere(50, 120, 42, 10)
  if (pts.length !== 50) throw new Error(`expected 50 points, got ${pts.length}`)
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i] || [0, 0, 0]
    for (let j = 0; j < 3; j += 1) {
      const v = p[j] as number
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('expected finite fibSphere coordinate')
    }
  }
}

export const testImportRenderPipelineThreeSeedNotPlanar = () => {
  const nodes: GraphNode[] = []
  const seed2d: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < 80; i += 1) {
    const id = `n${i}`
    nodes.push({ id, type: 'Node', label: id, x: 0, y: 0, properties: {} } as unknown as GraphNode)
    seed2d[id] = { x: (i % 10) * 12, y: Math.floor(i / 10) * 12 }
  }
  const schema = { three: { sphereRadius: 120, seed: 42, minSpacing: 10 } } as any
  const pos = computePositions3d(nodes, schema, { seed2dPositions: seed2d })
  let minZ = Infinity
  let maxZ = -Infinity
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const p = pos[nodes[i].id]
    if (!p) continue
    const z = p[2]
    if (!(typeof z === 'number' && Number.isFinite(z))) continue
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
    count += 1
  }
  if (count < 2) throw new Error('expected multiple 3d seed positions')
  if (!(maxZ - minZ > 1e-3)) {
    throw new Error(`expected non-planar 3d seed (z span), got span=${maxZ - minZ}`)
  }
}

export const testImportRenderPipelineThreeSphereConstraintProjects = () => {
  const n = 60
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  const vx = new Float32Array(n)
  const vy = new Float32Array(n)
  const vz = new Float32Array(n)
  const targetRByIndex = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    px[i] = (i - n / 2) * 3.1
    py[i] = ((i * 7) % n - n / 2) * 2.7
    pz[i] = ((i * 13) % n - n / 2) * 2.3
    vx[i] = ((i * 3) % 9) - 4
    vy[i] = ((i * 5) % 9) - 4
    vz[i] = ((i * 7) % 9) - 4
    targetRByIndex[i] = 140
  }
  projectPositionsToSphereShell({ px, py, pz, vx, vy, vz, targetRByIndex })
  for (let i = 0; i < n; i += 1) {
    const r = Math.sqrt(px[i] * px[i] + py[i] * py[i] + pz[i] * pz[i])
    if (!Number.isFinite(r)) throw new Error('expected finite projected radius')
    if (Math.abs(r - 140) > 1e-2) throw new Error(`expected projected radius≈140, got ${r}`)
    const inv = r > 1e-6 ? 1 / r : 0
    const nx = px[i] * inv
    const ny = py[i] * inv
    const nz = pz[i] * inv
    const vr = vx[i] * nx + vy[i] * ny + vz[i] * nz
    if (Math.abs(vr) > 1e-3) throw new Error(`expected tangential velocity after projection, got vr=${vr}`)
  }
}

export const testForbidHardcodedMarkdownSlideDemoAbsolutePath = () => {
  const forbidden = ['','Users','huijoohwee','Documents','GitHub','sandbox','demo','markdown-slide-demo.md'].join('/')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const root = path.resolve(here, '..')
  const stack: string[] = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: string[] = []
    try {
      entries = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!name) continue
      const p = path.join(dir, name)
      let st: fs.Stats | null = null
      try {
        st = fs.statSync(p)
      } catch {
        st = null
      }
      if (!st) continue
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue
        stack.push(p)
        continue
      }
      if (!st.isFile()) continue
      const lower = name.toLowerCase()
      if (!(lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.md'))) continue
      let text = ''
      try {
        text = fs.readFileSync(p, 'utf8')
      } catch {
        text = ''
      }
      if (text.includes(forbidden)) throw new Error(`forbidden hardcoded path found in ${p}`)
    }
  }
}
