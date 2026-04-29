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

export async function testComposedGraphSkipsTransientEdgeOnlyOverwriteWhenPendingTextParses() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({
      type: 'Graph',
      nodes: [{ id: 'stable-node', label: 'Stable', type: 'Thing', properties: {}, x: 10, y: 20 }],
      edges: [{ id: 'stable-edge', source: 'stable-node', target: 'stable-node', properties: {} }],
      metadata: {},
    } as unknown as GraphData)

    state.addSourceFile({
      id: 'sf-edge-only',
      name: 'imported.md',
      text: '# pending parse',
      enabled: true,
      status: 'idle',
      parsedGraphData: {
        type: 'Graph',
        nodes: [],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', properties: {} }],
        metadata: {},
      } as unknown as GraphData,
      parsedTextHash: 'pending',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'workspace:/imported.md' },
    })

    applyComposedGraphFromSourceFiles()

    const after = useGraphStore.getState().graphData
    const nodeCount = Array.isArray(after?.nodes) ? after.nodes.length : 0
    const hasStableNode = !!after?.nodes?.find(n => n.id === 'stable-node')
    if (!hasStableNode || nodeCount === 0) {
      throw new Error('expected transient edge-only composed graph to not overwrite existing node-bearing graph while parse is pending')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
