import { useGraphStore } from '@/hooks/useGraphStore'

export function testCollapsedGroupIdsAreScopedByGraphMetaKey() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: { 'visual:community': 0 } },
      { id: 'b', type: 'Node', label: 'b', properties: { 'visual:community': 0 } },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  useGraphStore.getState().setCollapsedGroupIds(['community:0'])
  const afterA = useGraphStore.getState()
  if ((afterA.collapsedGroupIds || []).join('|') !== 'community:0') throw new Error('expected community:0 collapsed for graph A')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'c', type: 'Node', label: 'c', properties: { 'visual:community': 0 } },
      { id: 'd', type: 'Node', label: 'd', properties: { 'visual:community': 0 } },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-b' },
  } as never)

  const afterB = useGraphStore.getState()
  if ((afterB.collapsedGroupIds || []).length !== 0) throw new Error('expected no collapsed groups for graph B')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: { 'visual:community': 0 } },
      { id: 'b', type: 'Node', label: 'b', properties: { 'visual:community': 0 } },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  const afterARestore = useGraphStore.getState()
  if ((afterARestore.collapsedGroupIds || []).join('|') !== 'community:0') throw new Error('expected collapsed groups restored for graph A')
}

