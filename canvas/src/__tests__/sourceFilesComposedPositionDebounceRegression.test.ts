import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testComposedPositionUpdateIsDebouncedToSourceFiles() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const g1: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {}, x: 1, y: 2 }],
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
    before.updateNode('sf-1::n1', { x: 10, y: 20 })

    const mid = useGraphStore.getState()
    const viewNode = mid.graphData?.nodes?.find(n => n.id === 'sf-1::n1')
    if (!viewNode || viewNode.x !== 10 || viewNode.y !== 20) {
      throw new Error('expected composed view node to update position immediately')
    }
    const fileNow = mid.sourceFiles.find(f => f.id === 'sf-1')
    const layerNodeNow = fileNow?.parsedGraphData?.nodes?.find(n => n.id === 'n1')
    if (!layerNodeNow || layerNodeNow.x === 10 || layerNodeNow.y === 20) {
      throw new Error('expected source file node position update to be deferred')
    }

    mid.flushComposedPositionWritesNow()
    const after = useGraphStore.getState()
    const fileAfter = after.sourceFiles.find(f => f.id === 'sf-1')
    const layerNodeAfter = fileAfter?.parsedGraphData?.nodes?.find(n => n.id === 'n1')
    if (!layerNodeAfter || layerNodeAfter.x !== 10 || layerNodeAfter.y !== 20) {
      throw new Error('expected source file node position to be committed after flush')
    }
    if ((fileAfter?.parsedGraphRevision || 0) !== 1) throw new Error('expected parsedGraphRevision to increment on commit')
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
