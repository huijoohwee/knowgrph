import type { GraphData, GraphNode } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import { createLayoutGroupKeyOfNode } from '@/components/GraphCanvas/layout/layoutGroupKey'
import { useGraphStore } from '@/hooks/useGraphStore'

export const testSemanticModeSchemaIsolationRestoresSchemaAndClearsSelection = () => {
  const api = useGraphStore.getState()
  api.resetAll()
  api.setDocumentStructureBaselineLock(false)

  api.selectNode('n1')
  api.selectEdge('e1')
  api.selectGroup('g1')
  api.setCollapsedGroupIds(['g1'])

  api.setBehavior({ nodeShapeMode: 'rect' })
  if (useGraphStore.getState().schema.behavior?.nodeShapeMode !== 'rect') {
    throw new Error('expected document-mode schema update to apply')
  }

  api.setDocumentSemanticMode('keyword')
  const afterKeyword = useGraphStore.getState()
  if (afterKeyword.selectedNodeId || afterKeyword.selectedEdgeId || afterKeyword.selectedGroupId) {
    throw new Error('expected selection to clear on semantic mode switch')
  }
  if ((afterKeyword.collapsedGroupIds || []).length !== 0) {
    throw new Error('expected collapsed groups to clear on semantic mode switch')
  }

  api.setDocumentSemanticMode('document')
  const afterReturn = useGraphStore.getState()
  if (afterReturn.schema.behavior?.nodeShapeMode !== 'rect') {
    throw new Error('expected document-mode schema to restore after switching back')
  }
}

export const testLayoutGroupKeyPrefersDeepestMermaidSubgraph = () => {
  const nodes: GraphNode[] = [
    { id: 'sg0', type: 'MermaidSubgraph', label: 'sg0', properties: { label: 'Parent' } },
    { id: 'sg1', type: 'MermaidSubgraph', label: 'sg1', properties: { label: 'Child' } },
    { id: 'n1', type: 'MermaidNode', label: 'n1', properties: {} },
  ]
  const graphData: GraphData = {
    type: 'application/json',
    nodes,
    edges: [
      { id: 'e0', label: 'hasMermaidSubgraph', source: 'sg0', target: 'sg1', properties: {} },
      { id: 'e1', label: 'hasMermaidNode', source: 'sg1', target: 'n1', properties: {} },
    ],
  }

  const keyOf = createLayoutGroupKeyOfNode({ graphData, schema: defaultSchema })
  const key = keyOf(nodes[2]!)
  if (key !== 'sg1') {
    throw new Error(`expected deepest group sg1, got ${String(key)}`)
  }
}
