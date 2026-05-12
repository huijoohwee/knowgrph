import { computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'

export const testFlowHandlesIncludeRegistryPortsWithoutEdges = () => {
  const registry = [
    {
      id: 'q1',
      isEnabled: true,
      nodeTypeId: 'Node',
      widgetTypeId: 'default',
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
    widgetRegistry: registry,
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
      widgetTypeId: 'default',
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
    widgetRegistry: registry,
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

export const testFlowHandlesRebalanceRichMediaPanelPortsByActiveTab = () => {
  const registry = [
    {
      id: 'rich-media-panel',
      isEnabled: true,
      nodeTypeId: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
      widgetTypeId: 'kg-rich-media-panel',
      formId: 'richMediaPanel',
      fields: [],
      ports: [
        { portKey: 'output', direction: 'input' as const },
        { portKey: 'imageUrl', direction: 'input' as const },
        { portKey: 'videoUrl', direction: 'input' as const },
        { portKey: 'outputSrcDoc', direction: 'input' as const },
        { portKey: 'output', direction: 'output' as const },
        { portKey: 'imageUrl', direction: 'output' as const },
        { portKey: 'videoUrl', direction: 'output' as const },
        { portKey: 'outputSrcDoc', direction: 'output' as const },
      ],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNode = computeFlowHandlesByNode({
    nodes: [{ id: 'panel-1', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, properties: { richMediaActiveTab: 'video' } }],
    edges: [],
    widgetRegistry: registry,
  })
  const handles = byNode['panel-1']
  if (!handles) throw new Error('expected handles for rich media panel')
  if (handles.in[0]?.id !== 'in:videoUrl') {
    throw new Error(`expected video tab input handles to prioritize in:videoUrl, got ${handles.in.map(h => h.id).join(',')}`)
  }
  if (handles.out[0]?.id !== 'out:videoUrl') {
    throw new Error(`expected video tab output handles to prioritize out:videoUrl, got ${handles.out.map(h => h.id).join(',')}`)
  }
}
