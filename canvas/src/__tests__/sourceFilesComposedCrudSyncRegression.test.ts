import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testComposedUpdateNodeSyncsToSourceFileAndRecomposes() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const g1: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    }

    state.addSourceFile({
      id: 'sf-1',
      name: 'a.md',
      text: 'a',
      enabled: true,
      status: 'parsed',
      parsedGraphData: g1,
      parsedTextHash: 'h1',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'a.md' },
    })

    applyComposedGraphFromSourceFiles()
    const before = useGraphStore.getState()
    const beforeGraph = before.graphData
    if (!beforeGraph) throw new Error('expected composed graph data')
    const beforeKey = String(((beforeGraph.metadata || {}) as any).sourceLayerHash || '')
    if (!beforeKey) throw new Error('expected sourceLayerHash')

    before.updateNode('sf-1::n1', { label: 'A2' })

    const after = useGraphStore.getState()
    const file = after.sourceFiles.find(f => f.id === 'sf-1')
    const label = file?.parsedGraphData?.nodes?.find(n => n.id === 'n1')?.label
    if (label !== 'A2') throw new Error(`expected source file node label to update, got ${String(label)}`)
    if ((file?.parsedGraphRevision || 0) !== 1) throw new Error('expected parsedGraphRevision to increment')

    const afterGraph = after.graphData
    if (!afterGraph) throw new Error('expected composed graph data after update')
    const afterKey = String(((afterGraph.metadata || {}) as any).sourceLayerHash || '')
    if (afterKey === beforeKey) throw new Error('expected sourceLayerHash to change after composed CRUD update')
    const composedLabel = afterGraph.nodes.find(n => n.id === 'sf-1::n1')?.label
    if (composedLabel !== 'A2') throw new Error(`expected composed node label to update, got ${String(composedLabel)}`)
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
