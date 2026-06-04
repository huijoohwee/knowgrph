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
      nodeTypeId: 'MetricPreview',
      widgetTypeId: 'default',
      formId: 'metrics',
      fields: [
        { fieldKey: 'alpha', fieldType: 'number' },
        { fieldKey: 'beta', fieldType: 'number' },
        { fieldKey: 'gamma', fieldType: 'number' },
      ],
      ports: [
        { portKey: 'alpha', direction: 'input' as const },
        { portKey: 'beta', direction: 'input' as const },
        { portKey: 'gamma', direction: 'input' as const },
      ],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNode = computeFlowHandlesByNode({
    nodes: [
      { id: 'alpha-source' },
      { id: 'beta-source' },
      { id: 'gamma-source' },
      { id: 'preview', type: 'MetricPreview', properties: {} },
    ],
    edges: [
      { id: 'e-alpha', source: 'alpha-source', target: 'preview', properties: { 'flow:targetPortKey': 'alpha' } },
      { id: 'e-beta', source: 'beta-source', target: 'preview', properties: { 'flow:targetPortKey': 'beta' } },
      { id: 'e-gamma', source: 'gamma-source', target: 'preview', properties: { 'flow:targetPortKey': 'gamma' } },
    ],
    widgetRegistry: registry,
  })

  const handles = byNode.preview
  if (!handles) throw new Error('expected handles for node preview')
  const ids = handles.in.map(h => h.id)
  const idxAlpha = ids.indexOf('in:alpha')
  const idxBeta = ids.indexOf('in:beta')
  const idxGamma = ids.indexOf('in:gamma')
  if (idxAlpha < 0 || idxBeta < 0 || idxGamma < 0) throw new Error('expected in:alpha, in:beta, in:gamma handles')
  if (!(idxAlpha < idxBeta && idxBeta < idxGamma)) throw new Error('expected registry input ports ordered alpha, beta, gamma')
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
        { portKey: 'audioUrl', direction: 'input' as const },
        { portKey: 'outputSrcDoc', direction: 'input' as const },
        { portKey: 'output', direction: 'output' as const },
        { portKey: 'imageUrl', direction: 'output' as const },
        { portKey: 'videoUrl', direction: 'output' as const },
        { portKey: 'audioUrl', direction: 'output' as const },
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

  const audioByNode = computeFlowHandlesByNode({
    nodes: [{ id: 'panel-audio', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, properties: { richMediaActiveTab: 'audio' } }],
    edges: [],
    widgetRegistry: registry,
  })
  const audioHandles = audioByNode['panel-audio']
  if (!audioHandles) throw new Error('expected handles for audio rich media panel')
  if (audioHandles.in[0]?.id !== 'in:audioUrl') {
    throw new Error(`expected audio tab input handles to prioritize in:audioUrl, got ${audioHandles.in.map(h => h.id).join(',')}`)
  }
  if (audioHandles.out[0]?.id !== 'out:audioUrl') {
    throw new Error(`expected audio tab output handles to prioritize out:audioUrl, got ${audioHandles.out.map(h => h.id).join(',')}`)
  }
}
