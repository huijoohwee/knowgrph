import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { renderMermaidFrontmatterGeometry } from '@/lib/mermaid/mermaidFrontmatterGeometry'
import type { GraphData } from '@/lib/graph/types'

export async function testMermaidFrontmatterGeometryReusesSharedRenderSeam() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { restore: restoreDom } = initJsdomHarness()

  const geometryPath = resolve(process.cwd(), 'src', 'lib', 'mermaid', 'mermaidFrontmatterGeometry.ts')
  const geometryText = readFileSync(geometryPath, 'utf8')

  if (!geometryText.includes('export async function renderMermaidFrontmatterGeometry')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared renderMermaidFrontmatterGeometry helper')
  }
  if (!geometryText.includes('const rendered = await renderMermaidFrontmatterGeometry({')) {
    throw new Error('expected applyMermaidFrontmatterGeometryToGraphData to reuse shared renderMermaidFrontmatterGeometry helper')
  }
  if (!geometryText.includes('const prepareMermaidFrontmatterGraphBindings = (graphData: GraphData): MermaidFrontmatterGraphBindings => {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared prepareMermaidFrontmatterGraphBindings helper')
  }
  if (!geometryText.includes('const matchMermaidEdgeGeometry = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared matchMermaidEdgeGeometry helper')
  }
  if (!geometryText.includes('const assignFallbackMermaidEdgeGeometry = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared assignFallbackMermaidEdgeGeometry helper')
  }
  if (!geometryText.includes('const applyMermaidNodeGeometry = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared applyMermaidNodeGeometry helper')
  }
  if (!geometryText.includes('const applyMermaidSubgraphGeometry = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared applyMermaidSubgraphGeometry helper')
  }
  if (!geometryText.includes('const finalizeMermaidFrontmatterGraph = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared finalizeMermaidFrontmatterGraph helper')
  }
  if (!geometryText.includes('const resolveMermaidFrontmatterRenderInput = (args: {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to expose shared resolveMermaidFrontmatterRenderInput helper')
  }
  if (!geometryText.includes('const resolveMermaidImageMediaKind = (imageUrl: string): \'image\' | \'svg\' => {')) {
    throw new Error('expected mermaidFrontmatterGeometry SSOT to centralize Mermaid image media-kind derivation')
  }
  if (!geometryText.includes('const edgeIdx = args.edgeIndexById.get(edgeId)')) {
    throw new Error('expected frontmatter Mermaid edge matching helper to reuse indexed edge lookups instead of repeated findIndex scans')
  }
  if (!geometryText.includes('applyMermaidEdgeVisual({')) {
    throw new Error('expected frontmatter Mermaid edge matching and fallback helpers to reuse shared edge-visual mutation helper')
  }
  if (!geometryText.includes('applyMermaidNodeGeometry({')) {
    throw new Error('expected frontmatter Mermaid geometry applier to reuse shared node geometry mutation helper')
  }
  if (!geometryText.includes('applyMermaidSubgraphGeometry({')) {
    throw new Error('expected frontmatter Mermaid geometry applier to reuse shared subgraph geometry mutation helper')
  }
  if (!geometryText.includes('return finalizeMermaidFrontmatterGraph({')) {
    throw new Error('expected frontmatter Mermaid geometry applier to reuse shared graph finalization helper')
  }
  if (!geometryText.includes("layoutEngine: 'mermaid'")) {
    throw new Error('expected shared graph finalization helper to preserve Mermaid layout engine metadata')
  }
  if (!geometryText.includes('const renderInput = resolveMermaidFrontmatterRenderInput(args)')) {
    throw new Error('expected Mermaid frontmatter renderer to reuse shared render input resolution helper')
  }

  try {
    ;(globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__ = {
      registerLayoutLoaders: () => void 0,
      initialize: () => void 0,
      render: async () => ({
        svg: [
          '<svg viewBox="0 0 120 80">',
          '<g class="node" data-id="A" transform="translate(30,40)"><rect width="100" height="40" /></g>',
          '</svg>',
        ].join(''),
      }),
    }

    const graphData: GraphData = {
      type: 'graph',
      context: 'frontmatter-mermaid',
      nodes: [
        {
          id: 'diagram-1',
          type: 'MermaidDiagram',
          label: 'Diagram',
          properties: { code: 'graph TD\nA[Node A]', mermaidScope: 'frontmatter', isMermaidFrontmatter: true },
        },
      ],
      edges: [],
    }

    const result = await renderMermaidFrontmatterGeometry({ graphData, theme: 'light' })
    if (!result) throw new Error('expected shared frontmatter Mermaid seam to render geometry')
    if (result.theme !== 'light') throw new Error(`expected shared frontmatter Mermaid seam to preserve requested theme, got ${result.theme}`)
    if (result.code !== 'graph TD\nA[Node A]') throw new Error(`expected shared frontmatter Mermaid seam to preserve resolved code, got ${JSON.stringify(result.code)}`)
    if (result.geometry.nodes.length !== 1) throw new Error(`expected shared frontmatter Mermaid seam to parse one Mermaid node, got ${result.geometry.nodes.length}`)
    if (result.geometry.nodes[0]?.name !== 'A') throw new Error(`expected parsed Mermaid node name A, got ${String(result.geometry.nodes[0]?.name || '')}`)
  } finally {
    try {
      delete (globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }).__KG_TEST_MERMAID_API__
    } catch {
      void 0
    }
    try {
      restoreDom()
    } catch {
      void 0
    }
    try {
      restoreWindow()
    } catch {
      void 0
    }
  }
}
