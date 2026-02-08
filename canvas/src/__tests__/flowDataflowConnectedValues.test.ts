import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY, FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'

export const testFlowDataflowConnectedValuesBySchemaPath = () => {
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'a',
        type: 'Node',
        label: 'A',
        properties: { value: 'hello', [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'out', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'out' },
      },
      { id: 'b', type: 'Node', label: 'B', properties: { [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'in', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'in' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        label: 'linksTo',
        properties: {
          'flow:sourcePortKey': 'out',
          'flow:targetPortKey': 'in',
        },
      },
    ],
  }

  const registry = [
    {
      id: 'qa',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'out',
      formId: 'out',
      fields: [],
      ports: [{ portKey: 'out', direction: 'output' as const, schemaPath: 'properties.value' }],
      schemaMappings: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'qb',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'in',
      formId: 'in',
      fields: [],
      ports: [{ portKey: 'in', direction: 'input' as const, schemaPath: 'properties.input' }],
      schemaMappings: [{ fromPath: 'in.in', toPath: 'properties.mapped' }],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNodeId = computeFlowConnectedValuesBySchemaPath({ graphData: graphData as never, registry })
  const b = byNodeId.get('b')
  if (!b) throw new Error('expected connected values for node b')

  const input = b['properties.input']
  if (!input) throw new Error('expected connected value at properties.input')
  if (input.value !== 'hello') throw new Error(`expected properties.input to be hello, got ${String(input.value)}`)
  if (input.sources.length !== 1) throw new Error('expected exactly one source for properties.input')
  if (input.sources[0].nodeId !== 'a') throw new Error('expected source nodeId to be a')
  if (input.sources[0].portKey !== 'out') throw new Error('expected source portKey to be out')

  const mapped = b['properties.mapped']
  if (!mapped) throw new Error('expected derived mapping at properties.mapped')
  if (mapped.value !== 'hello') throw new Error(`expected properties.mapped to be hello, got ${String(mapped.value)}`)
}

export const testFlowDataflowConnectedValuesTransformsAndPropagation = () => {
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'a',
        type: 'Node',
        label: 'A',
        properties: { value: 'hello', [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'out', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'out' },
      },
      {
        id: 'b',
        type: 'Node',
        label: 'B',
        properties: { [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'mid', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'mid' },
      },
      {
        id: 'c',
        type: 'Node',
        label: 'C',
        properties: { [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'in', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'in' },
      },
      {
        id: 'a2',
        type: 'Node',
        label: 'A2',
        properties: { value: 'world', [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'out', [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: 'out' },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'a',
        target: 'b',
        label: 'linksTo',
        properties: {
          'flow:sourcePortKey': 'out',
          'flow:targetPortKey': 'in',
        },
      },
      {
        id: 'e2',
        source: 'b',
        target: 'c',
        label: 'linksTo',
        properties: {
          'flow:sourcePortKey': 'out',
          'flow:targetPortKey': 'x',
        },
      },
      {
        id: 'e3',
        source: 'a2',
        target: 'b',
        label: 'linksTo',
        properties: {
          'flow:sourcePortKey': 'out',
          'flow:targetPortKey': 'in',
        },
      },
    ],
  }

  const registry = [
    {
      id: 'qa',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'out',
      formId: 'out',
      fields: [],
      ports: [{ portKey: 'out', direction: 'output' as const, schemaPath: 'properties.value' }],
      schemaMappings: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'qb',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'mid',
      formId: 'mid',
      fields: [],
      ports: [
        { portKey: 'in', direction: 'input' as const, schemaPath: 'properties.input' },
        { portKey: 'out', direction: 'output' as const, schemaPath: 'properties.out' },
      ],
      schemaMappings: [
        { fromPath: 'in.in', toPath: 'properties.mapped', reduceId: 'join_comma' },
        { fromPath: 'in.in', toPath: 'properties.out', reduceId: 'first', transformId: 'upper' },
      ],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'qc',
      isEnabled: true,
      nodeTypeId: 'Node',
      quickEditorTypeId: 'in',
      formId: 'in',
      fields: [],
      ports: [{ portKey: 'x', direction: 'input' as const, schemaPath: 'properties.x' }],
      schemaMappings: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ]

  const byNodeId = computeFlowConnectedValuesBySchemaPath({ graphData: graphData as never, registry })
  const b = byNodeId.get('b')
  if (!b) throw new Error('expected connected values for node b')

  const mapped = b['properties.mapped']
  if (!mapped) throw new Error('expected derived mapping at properties.mapped')
  if (mapped.value !== 'hello, world') throw new Error(`expected properties.mapped to be "hello, world", got ${String(mapped.value)}`)

  const out = b['properties.out']
  if (!out) throw new Error('expected derived mapping at properties.out')
  if (out.value !== 'HELLO') throw new Error(`expected properties.out to be "HELLO", got ${String(out.value)}`)

  const c = byNodeId.get('c')
  if (!c) throw new Error('expected connected values for node c')
  const cx = c['properties.x']
  if (!cx) throw new Error('expected connected value at properties.x')
  if (cx.value !== 'HELLO') throw new Error(`expected properties.x to be "HELLO", got ${String(cx.value)}`)
}
