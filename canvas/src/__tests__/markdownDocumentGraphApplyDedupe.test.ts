import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'
import { useGraphStore } from '@/hooks/useGraphStore'

const buildFrontmatterFlowMarkdown = (): string => [
  '---',
  'kgCanvasSurfaceMode: "2d"',
  'kgCanvasRenderMode: "2d"',
  'kgCanvas2dRenderer: "flowEditor"',
  'kgDocumentSemanticMode: "document"',
  'kgFrontmatterModeEnabled: true',
  'nodes:',
  '  - id: NODE_A',
  '    type: Source',
  '    label: "A"',
  '    outputs:',
  '      - port: out_1',
  '        type: STRING',
  '  - id: NODE_B',
  '    type: Sink',
  '    label: "B"',
  '    inputs:',
  '      - port: in_1',
  '        type: STRING',
  '        from: NODE_A.out_1',
  'connections:',
  '  - { id: e01, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_1, type: STRING }',
  '---',
  '',
  '# Source Switch',
].join('\n')

export const testMarkdownDocumentGraphApplyDedupesSameSemanticRequest = async () => {
  useGraphStore.getState().resetAll()
  const text = buildFrontmatterFlowMarkdown()
  const preset = parseCanvasWorkspaceFrontmatterPreset(text)
  if (!preset) throw new Error('expected frontmatter preset')

  const apply = () => useGraphStore.getState().setActiveMarkdownDocument({
    name: 'source-switch.md',
    text,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
    canvasWorkspacePreset: preset,
    normalizeMermaidMmd: false,
  })

  const first = await apply()
  if (!first) throw new Error('expected first markdown graph apply to succeed')
  const afterFirst = useGraphStore.getState()
  const firstGraph = afterFirst.graphData
  const firstGraphRevision = afterFirst.graphDataRevision
  const firstContentRevision = afterFirst.graphContentRevision
  if (!firstGraph || (firstGraph.nodes || []).length !== 2 || (firstGraph.edges || []).length !== 1) {
    throw new Error('expected first markdown graph apply to produce the frontmatter flow graph')
  }

  const second = await apply()
  if (!second) throw new Error('expected deduped markdown graph apply to report current graph')
  const afterSecond = useGraphStore.getState()
  if (afterSecond.graphData !== firstGraph) throw new Error('expected duplicate graph apply to reuse current graph object')
  if (afterSecond.graphDataRevision !== firstGraphRevision) throw new Error('expected duplicate graph apply to avoid graphDataRevision churn')
  if (afterSecond.graphContentRevision !== firstContentRevision) throw new Error('expected duplicate graph apply to avoid graphContentRevision churn')
}

export const testMarkdownDocumentGraphApplyDedupeUsesSharedSemanticKey = () => {
  const filePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("buildScopedGraphSemanticKey('markdown-document-graph-apply-request'")) {
    throw new Error('expected markdown graph apply dedupe to reuse the shared semantic-key helper')
  }
}

export const testMarkdownDocumentGraphApplyRejectsStaleStrybldrSourceGraph = async () => {
  useGraphStore.getState().resetAll()
  const demoPath = resolve(process.cwd(), '../..', 'huijoohwee/docs/knowgrph-strybldr-demo.md')
  const text = readFileSync(demoPath, 'utf8')
  const name = 'knowgrph-strybldr-demo.md'
  const staleGraph = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      parserId: 'markdown',
    },
  }
  useGraphStore.setState({
    sourceFiles: [
      {
        id: 'sf-stale-strybldr',
        name,
        text,
        enabled: true,
        status: 'parsed',
        parsedParserId: 'markdown',
        parsedGraphData: staleGraph,
        source: { kind: 'local', path: `workspace:/docs/${name}` },
      },
    ],
  })

  const ok = await useGraphStore.getState().setActiveMarkdownDocument({
    name,
    text,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
    normalizeMermaidMmd: false,
  })
  if (!ok) throw new Error('expected Strybldr markdown graph apply to succeed after rejecting stale source graph')
  const graph = useGraphStore.getState().graphData
  const meta = (graph?.metadata || {}) as Record<string, unknown>
  if (String(meta.kind || '') !== 'strybldr-storyboard') {
    throw new Error(`expected active graph to reparse as strybldr-storyboard, got ${String(meta.kind || graph?.context || '')}`)
  }
  if ((graph?.nodes || []).length === 0) {
    throw new Error('expected active Strybldr graph to contain renderer nodes instead of stale zero-node frontmatter-flow graph')
  }
}

export const testMarkdownDocumentGraphApplyRejectsEmptyCachedStrybldrSourceGraph = async () => {
  useGraphStore.getState().resetAll()
  const demoPath = resolve(process.cwd(), '../..', 'huijoohwee/docs/knowgrph-strybldr-demo.md')
  const text = readFileSync(demoPath, 'utf8')
  const name = 'knowgrph-strybldr-demo.md'
  const staleGraph = {
    type: 'Graph',
    context: 'strybldr-storyboard',
    nodes: [],
    edges: [],
    metadata: {
      kind: 'strybldr-storyboard',
      parserId: 'strybldr-storyboard',
      kgCanvas2dRenderer: 'storyboard',
    },
  }
  useGraphStore.setState({
    sourceFiles: [
      {
        id: 'sf-empty-strybldr',
        name,
        text,
        enabled: true,
        status: 'parsed',
        parsedParserId: 'strybldr-storyboard',
        parsedGraphData: staleGraph,
        source: { kind: 'local', path: `workspace:/docs/${name}` },
      },
    ],
  })

  const ok = await useGraphStore.getState().setActiveMarkdownDocument({
    name,
    text,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
    normalizeMermaidMmd: false,
  })
  if (!ok) throw new Error('expected Strybldr markdown graph apply to reject the empty cached Strybldr graph and reparse')
  const graph = useGraphStore.getState().graphData
  const meta = (graph?.metadata || {}) as Record<string, unknown>
  if (String(meta.kind || '') !== 'strybldr-storyboard') {
    throw new Error(`expected active graph to reparse as strybldr-storyboard, got ${String(meta.kind || graph?.context || '')}`)
  }
  if ((graph?.nodes || []).length === 0) {
    throw new Error('expected active Strybldr graph to contain renderer nodes after rejecting empty cached graph')
  }
}
