import { useGraphStore } from '@/hooks/useGraphStore'

export function testDesignLayerStateIsScopedByGraphMetaKey() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'frameA', type: 'Frame', label: 'A', properties: {} },
      { id: 'frameB', type: 'Frame', label: 'B', properties: {} },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  useGraphStore.getState().setDesignLayerState({ order: ['frameA', 'frameB'], hiddenById: { frameB: true } })
  const afterA = useGraphStore.getState()
  if (afterA.designLayerState.hiddenById.frameB !== true) throw new Error('expected frameB hidden for graph A')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'frameA', type: 'Frame', label: 'A', properties: {} },
      { id: 'frameB', type: 'Frame', label: 'B', properties: {} },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-b' },
  } as never)

  const afterB = useGraphStore.getState()
  if (Object.keys(afterB.designLayerState.hiddenById || {}).length !== 0) throw new Error('expected no hidden layers for graph B')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'frameA', type: 'Frame', label: 'A', properties: {} },
      { id: 'frameB', type: 'Frame', label: 'B', properties: {} },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  const afterARestore = useGraphStore.getState()
  if (afterARestore.designLayerState.hiddenById.frameB !== true) throw new Error('expected hidden layers restored for graph A')
}

