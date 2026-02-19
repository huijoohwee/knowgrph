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

export const testFlowHandlesPreferRegistryOrderingWhenPortsOverlapEdges = () => {
  const registry = [
    {
      id: 'q1',
      isEnabled: true,
      nodeTypeId: 'ColorPreview',
      quickEditorTypeId: 'default',
      formId: 'color',
      fields: [
        { fieldKey: 'r', fieldType: 'number' },
        { fieldKey: 'g', fieldType: 'number' },
        { fieldKey: 'b', fieldType: 'number' },
      ],
      ports: [
        { portKey: 'r', direction: 'input' as const },
        { portKey: 'g', direction: 'input' as const },
        { portKey: 'b', direction: 'input' as const },
      ],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNode = computeFlowHandlesByNode({
    nodes: [
      { id: 'red' },
      { id: 'green' },
      { id: 'blue' },
      { id: 'preview', type: 'ColorPreview', properties: {} },
    ],
    edges: [
      { id: 'e-r', source: 'red', target: 'preview', properties: { 'flow:targetPortKey': 'r' } },
      { id: 'e-g', source: 'green', target: 'preview', properties: { 'flow:targetPortKey': 'g' } },
      { id: 'e-b', source: 'blue', target: 'preview', properties: { 'flow:targetPortKey': 'b' } },
    ],
    nodeQuickEditorRegistry: registry,
  })

  const handles = byNode.preview
  if (!handles) throw new Error('expected handles for node preview')
  const ids = handles.in.map(h => h.id)
  const idxR = ids.indexOf('in:r')
  const idxG = ids.indexOf('in:g')
  const idxB = ids.indexOf('in:b')
  if (idxR < 0 || idxG < 0 || idxB < 0) throw new Error('expected in:r, in:g, in:b handles')
  if (!(idxR < idxG && idxG < idxB)) throw new Error('expected registry input ports ordered r, g, b')
}
