import { computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'

export const testFlowHandlesIncludeRegistryPortsWithoutEdges = () => {
  const registry = [
    {
      id: 'q1',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'default',
      formId: 'default',
      fields: [{ fieldKey: 'title', fieldType: 'text' }],
      ports: [
        { portKey: 'alpha', direction: 'input' as const },
        { portKey: 'beta', direction: 'output' as const },
      ],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNode = computeFlowHandlesByNode({
    nodes: [{ id: 'n1', type: 'Node', properties: {} }],
    edges: [],
    nodeQuickEditorRegistry: registry,
  })
  const handles = byNode.n1
  if (!handles) throw new Error('expected handles for node n1')
  const ins = new Set(handles.in.map(h => h.id))
  const outs = new Set(handles.out.map(h => h.id))
  if (!ins.has('in:alpha')) throw new Error('expected in handle for registry portKey alpha')
  if (!outs.has('out:beta')) throw new Error('expected out handle for registry portKey beta')
}
