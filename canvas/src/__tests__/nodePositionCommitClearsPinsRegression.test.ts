import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testUpdateNodePositionCommitClearsFxFyPins() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    state.setGraphData({
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {}, x: 1, y: 2, fx: 1, fy: 2 }],
      edges: [],
      metadata: {},
    })

    state.updateNode('n1', { x: 10, y: 20 })
    const after = useGraphStore.getState()
    const n = after.graphData?.nodes?.find(v => v.id === 'n1')
    if (!n) throw new Error('expected node to exist')
    if (n.x !== 10 || n.y !== 20) throw new Error('expected x/y to update')
    if (typeof (n as any).fx === 'number' || typeof (n as any).fy === 'number') {
      throw new Error('expected position commit to clear transient fx/fy pins')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

export async function testComposedPositionCommitClearsFxFyPinsInViewAndSourceFiles() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    const state = useGraphStore.getState()
    state.clearSourceFiles()
    state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

    const g1: GraphData = {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {}, x: 1, y: 2, fx: 1, fy: 2 }],
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
    state.updateNode('sf-1::n1', { x: 10, y: 20 })

    const mid = useGraphStore.getState()
    const viewNode = mid.graphData?.nodes?.find(v => v.id === 'sf-1::n1')
    if (!viewNode) throw new Error('expected composed view node')
    if (viewNode.x !== 10 || viewNode.y !== 20) throw new Error('expected composed view x/y to update')
    if (typeof (viewNode as any).fx === 'number' || typeof (viewNode as any).fy === 'number') {
      throw new Error('expected composed view position commit to clear transient fx/fy pins')
    }

    await new Promise<void>(resolve => setTimeout(resolve, 450))
    const after = useGraphStore.getState()
    const fileAfter = after.sourceFiles.find(f => f.id === 'sf-1')
    const layerNodeAfter = fileAfter?.parsedGraphData?.nodes?.find(v => v.id === 'n1')
    if (!layerNodeAfter) throw new Error('expected source file node')
    if (layerNodeAfter.x !== 10 || layerNodeAfter.y !== 20) throw new Error('expected source file x/y to update')
    if (typeof (layerNodeAfter as any).fx === 'number' || typeof (layerNodeAfter as any).fy === 'number') {
      throw new Error('expected composed source file commit to clear transient fx/fy pins')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

