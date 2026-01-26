import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'

export function testSourceFilesCompositionOrderAndVisibility() {
  const state = useGraphStore.getState()
  state.clearSourceFiles()
  state.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as unknown as GraphData)

  const g1: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'A', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  }
  const g2: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n2', label: 'B', type: 'Thing', properties: {} }],
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
    source: { kind: 'local', path: 'a.md' },
  })
  state.addSourceFile({
    id: 'sf-2',
    name: 'b.md',
    text: 'b',
    enabled: true,
    status: 'parsed',
    parsedGraphData: g2,
    parsedTextHash: 'h2',
    source: { kind: 'local', path: 'b.md' },
  })

  applyComposedGraphFromSourceFiles()
  const first = useGraphStore.getState().graphData
  if (!first) throw new Error('expected composed graph data')
  const meta1 = (first.metadata || {}) as Record<string, any>
  const layers1 = meta1.sourceLayers as Array<{ id: string }> | undefined
  if (!Array.isArray(layers1) || layers1.length !== 2) throw new Error('expected 2 sourceLayers')
  if (layers1[0]?.id !== 'sf-1' || layers1[1]?.id !== 'sf-2') throw new Error('sourceLayers order mismatch')
  if (first.nodes.map(n => n.id).join(',') !== 'sf-1::n1,sf-2::n2') throw new Error('node order mismatch after compose')

  const contentKey1 = String(meta1.sourceLayerHash || '')
  const orderKey1 = String(meta1.sourceLayerOrderHash || '')
  if (!contentKey1 || !orderKey1) throw new Error('expected composition keys')

  state.reorderSourceFiles('sf-2', 'sf-1')
  applyComposedGraphFromSourceFiles()
  const second = useGraphStore.getState().graphData
  if (!second) throw new Error('expected composed graph data after reorder')
  const meta2 = (second.metadata || {}) as Record<string, any>
  const layers2 = meta2.sourceLayers as Array<{ id: string }> | undefined
  if (!Array.isArray(layers2) || layers2.length !== 2) throw new Error('expected 2 sourceLayers after reorder')
  if (layers2[0]?.id !== 'sf-2' || layers2[1]?.id !== 'sf-1') throw new Error('sourceLayers order mismatch after reorder')
  if (second.nodes.map(n => n.id).join(',') !== 'sf-2::n2,sf-1::n1') throw new Error('node order mismatch after reorder')

  const contentKey2 = String(meta2.sourceLayerHash || '')
  const orderKey2 = String(meta2.sourceLayerOrderHash || '')
  if (contentKey2 !== contentKey1) throw new Error('content key should not change on reorder')
  if (orderKey2 === orderKey1) throw new Error('order key should change on reorder')

  state.updateSourceFile('sf-2', { enabled: false })
  applyComposedGraphFromSourceFiles()
  const third = useGraphStore.getState().graphData
  if (!third) throw new Error('expected composed graph data after disable')
  if (third.nodes.length !== 1 || third.nodes[0]?.id !== 'sf-1::n1') throw new Error('expected only enabled layer nodes')
}

