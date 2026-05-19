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
