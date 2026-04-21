import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { parseGraph } from '@/lib/graph/io/adapter'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'

export const testFlowDataflowConnectedValuesBySchemaPath = () => {
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'a',
        type: 'Node',
        label: 'A',
        properties: { value: 'hello', [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
      },
      { id: 'b', type: 'Node', label: 'B', properties: { [FLOW_WIDGET_TYPE_ID_KEY]: 'in', [FLOW_WIDGET_FORM_ID_KEY]: 'in' } },
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
      widgetTypeId: 'out',
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
      widgetTypeId: 'in',
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
        properties: { value: 'hello', [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
      },
      {
        id: 'b',
        type: 'Node',
        label: 'B',
        properties: { [FLOW_WIDGET_TYPE_ID_KEY]: 'mid', [FLOW_WIDGET_FORM_ID_KEY]: 'mid' },
      },
      {
        id: 'c',
        type: 'Node',
        label: 'C',
        properties: { [FLOW_WIDGET_TYPE_ID_KEY]: 'in', [FLOW_WIDGET_FORM_ID_KEY]: 'in' },
      },
      {
        id: 'a2',
        type: 'Node',
        label: 'A2',
        properties: { value: 'world', [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
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
      widgetTypeId: 'out',
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
      widgetTypeId: 'mid',
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
      widgetTypeId: 'in',
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

export const testFlowDataflowConnectedValuesRgbTransforms = () => {
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'r',
        type: 'Node',
        label: 'R',
        properties: { value: 255, [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
      },
      {
        id: 'g',
        type: 'Node',
        label: 'G',
        properties: { value: 0, [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
      },
      {
        id: 'b',
        type: 'Node',
        label: 'B',
        properties: { value: 128, [FLOW_WIDGET_TYPE_ID_KEY]: 'out', [FLOW_WIDGET_FORM_ID_KEY]: 'out' },
      },
      {
        id: 'color',
        type: 'Node',
        label: 'Color',
        properties: { [FLOW_WIDGET_TYPE_ID_KEY]: 'color', [FLOW_WIDGET_FORM_ID_KEY]: 'color' },
      },
    ],
    edges: [
      {
        id: 'e-r',
        source: 'r',
        target: 'color',
        label: 'linksTo',
        properties: { 'flow:sourcePortKey': 'out', 'flow:targetPortKey': 'r' },
      },
      {
        id: 'e-g',
        source: 'g',
        target: 'color',
        label: 'linksTo',
        properties: { 'flow:sourcePortKey': 'out', 'flow:targetPortKey': 'g' },
      },
      {
        id: 'e-b',
        source: 'b',
        target: 'color',
        label: 'linksTo',
        properties: { 'flow:sourcePortKey': 'out', 'flow:targetPortKey': 'b' },
      },
    ],
  }

  const registry = [
    {
      id: 'q-out',
      isEnabled: true,
      nodeTypeId: 'Node',
      widgetTypeId: 'out',
      formId: 'out',
      fields: [],
      ports: [{ portKey: 'out', direction: 'output' as const, schemaPath: 'properties.value' }],
      schemaMappings: [],
      updatedAt: '2026-02-08T00:00:00.000Z',
    },
    {
      id: 'q-color',
      isEnabled: true,
      nodeTypeId: 'Node',
      widgetTypeId: 'color',
      formId: 'color',
      fields: [],
      ports: [
        { portKey: 'r', direction: 'input' as const, schemaPath: 'properties.r' },
        { portKey: 'g', direction: 'input' as const, schemaPath: 'properties.g' },
        { portKey: 'b', direction: 'input' as const, schemaPath: 'properties.b' },
        { portKey: 'color', direction: 'output' as const, schemaPath: 'properties.color' },
        { portKey: 'textColor', direction: 'output' as const, schemaPath: 'properties.textColor' },
      ],
      schemaMappings: [
        { fromPath: 'in', toPath: 'properties.color', transformId: 'rgb_css' },
        { fromPath: 'in', toPath: 'properties.textColor', transformId: 'contrast_text' },
      ],
      updatedAt: '2026-02-08T00:00:00.000Z',
    },
  ]

  const byNodeId = computeFlowConnectedValuesBySchemaPath({ graphData: graphData as never, registry, targetNodeIds: new Set(['color']) })
  const color = byNodeId.get('color')
  if (!color) throw new Error('expected connected values for node color')

  const r = color['properties.r']
  if (!r) throw new Error('expected connected value at properties.r')
  if (r.value !== 255) throw new Error(`expected properties.r to be 255, got ${String(r.value)}`)

  const css = color['properties.color']
  if (!css) throw new Error('expected derived mapping at properties.color')
  if (css.value !== 'rgb(255, 0, 128)') throw new Error(`expected properties.color to be rgb(255, 0, 128), got ${String(css.value)}`)

  const textColor = color['properties.textColor']
  if (!textColor) throw new Error('expected derived mapping at properties.textColor')
  if (textColor.value !== 'white') throw new Error(`expected properties.textColor to be white, got ${String(textColor.value)}`)
}

export const testComputingDataFlowsDemoBundleParsesAndComputes = () => {
  const bundle = {
    kind: 'kg:flow:widgetBundle',
    version: 1,
    registry: [
      {
        id: 'qer-NumberInput-default-value',
        isEnabled: true,
        nodeTypeId: 'NumberInput',
        widgetTypeId: 'default',
        formId: 'value',
        fields: [{ fieldKey: 'value', fieldType: 'number', label: 'Value', schemaPath: 'properties.value' }],
        ports: [{ portKey: 'value', direction: 'output', schemaPath: 'properties.value' }],
        schemaMappings: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
      {
        id: 'qer-ColorPreview-default-color',
        isEnabled: true,
        nodeTypeId: 'ColorPreview',
        widgetTypeId: 'default',
        formId: 'color',
        fields: [
          { fieldKey: 'r', fieldType: 'number', label: 'Red', schemaPath: 'properties.r' },
          { fieldKey: 'g', fieldType: 'number', label: 'Green', schemaPath: 'properties.g' },
          { fieldKey: 'b', fieldType: 'number', label: 'Blue', schemaPath: 'properties.b' },
          { fieldKey: 'color', fieldType: 'text', label: 'Background', schemaPath: 'properties.color' },
          { fieldKey: 'textColor', fieldType: 'text', label: 'Text', schemaPath: 'properties.textColor' },
        ],
        ports: [
          { portKey: 'r', direction: 'input', schemaPath: 'properties.r' },
          { portKey: 'g', direction: 'input', schemaPath: 'properties.g' },
          { portKey: 'b', direction: 'input', schemaPath: 'properties.b' },
          { portKey: 'color', direction: 'output', schemaPath: 'properties.color' },
          { portKey: 'textColor', direction: 'output', schemaPath: 'properties.textColor' },
        ],
        schemaMappings: [
          { fromPath: 'in', toPath: 'properties.color', transformId: 'rgb_css' },
          { fromPath: 'in', toPath: 'properties.textColor', transformId: 'contrast_text' },
        ],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    ],
    graph: {
      type: 'Graph',
      nodes: [
        {
          id: 'red',
          type: 'NumberInput',
          label: 'R',
          properties: { value: 255, [FLOW_WIDGET_TYPE_ID_KEY]: 'default', [FLOW_WIDGET_FORM_ID_KEY]: 'value' },
        },
        {
          id: 'green',
          type: 'NumberInput',
          label: 'G',
          properties: { value: 0, [FLOW_WIDGET_TYPE_ID_KEY]: 'default', [FLOW_WIDGET_FORM_ID_KEY]: 'value' },
        },
        {
          id: 'blue',
          type: 'NumberInput',
          label: 'B',
          properties: { value: 128, [FLOW_WIDGET_TYPE_ID_KEY]: 'default', [FLOW_WIDGET_FORM_ID_KEY]: 'value' },
        },
        {
          id: 'preview',
          type: 'ColorPreview',
          label: 'ColorPreview',
          properties: { [FLOW_WIDGET_TYPE_ID_KEY]: 'default', [FLOW_WIDGET_FORM_ID_KEY]: 'color' },
        },
      ],
      edges: [
        { id: 'e-r', source: 'red', target: 'preview', label: 'linksTo', properties: { 'flow:sourcePortKey': 'value', 'flow:targetPortKey': 'r' } },
        { id: 'e-g', source: 'green', target: 'preview', label: 'linksTo', properties: { 'flow:sourcePortKey': 'value', 'flow:targetPortKey': 'g' } },
        { id: 'e-b', source: 'blue', target: 'preview', label: 'linksTo', properties: { 'flow:sourcePortKey': 'value', 'flow:targetPortKey': 'b' } },
      ],
    },
  }

  const text = JSON.stringify(bundle)
  const res = parseGraph('computing-data-flows.json', text)
  const graphData = res.data

  const meta = graphData.metadata as unknown as Record<string, unknown> | undefined
  const registry = (meta?.[FLOW_WIDGET_REGISTRY_METADATA_KEY] as unknown[]) || []
  if (!Array.isArray(registry) || registry.length === 0) throw new Error('expected registry metadata to be present')

  const byNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData: graphData as never,
    registry: registry as never,
    targetNodeIds: new Set(['preview']),
  })
  const preview = byNodeId.get('preview')
  if (!preview) throw new Error('expected connected values for node preview')

  const css = preview['properties.color']
  if (!css) throw new Error('expected derived mapping at properties.color')
  if (css.value !== 'rgb(255, 0, 128)') throw new Error(`expected properties.color to be rgb(255, 0, 128), got ${String(css.value)}`)
}

export const testFlowDataflowConnectedValuesFlowComputeFunction = () => {
  const graphData = {
    type: 'GraphData',
    nodes: [
      {
        id: 'src',
        type: 'input',
        label: 'Source',
        properties: {
          data: { urls: ['https://demo.local/a', 'https://demo.local/b'] },
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'src',
        },
      },
      {
        id: 'transform',
        type: 'default',
        label: 'Transform',
        properties: {
          'flow:compute': '(inputs) => ({ demos: (Array.isArray(inputs.urls) ? inputs.urls : [inputs.urls]).filter(Boolean).map((url) => ({ url, extracted: true })) })',
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'transform',
        },
      },
      {
        id: 'sink',
        type: 'output',
        label: 'Sink',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'sink',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'src', target: 'transform', properties: { 'flow:sourcePortKey': 'urls', 'flow:targetPortKey': 'urls' } },
      { id: 'e2', source: 'transform', target: 'sink', properties: { 'flow:sourcePortKey': 'demos', 'flow:targetPortKey': 'demos' } },
    ],
  }
  const registry = [
    {
      id: 'q-src',
      isEnabled: true,
      nodeTypeId: 'input',
      widgetTypeId: 'default',
      formId: 'src',
      fields: [],
      ports: [{ portKey: 'urls', direction: 'output' as const, schemaPath: 'properties.data.urls' }],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
    {
      id: 'q-transform',
      isEnabled: true,
      nodeTypeId: 'default',
      widgetTypeId: 'default',
      formId: 'transform',
      fields: [],
      ports: [
        { portKey: 'urls', direction: 'input' as const, schemaPath: 'properties.data.urls' },
        { portKey: 'demos', direction: 'output' as const, schemaPath: 'properties.data.demos' },
      ],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
    {
      id: 'q-sink',
      isEnabled: true,
      nodeTypeId: 'output',
      widgetTypeId: 'default',
      formId: 'sink',
      fields: [],
      ports: [{ portKey: 'demos', direction: 'input' as const, schemaPath: 'properties.data.demos' }],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
  ]

  const byNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData: graphData as never,
    registry,
    targetNodeIds: new Set(['sink']),
  })
  const sink = byNodeId.get('sink')
  if (!sink) throw new Error('expected connected values for sink')
  const demos = sink['properties.data.demos']
  if (!demos) throw new Error('expected properties.data.demos value for sink')
  if (!Array.isArray(demos.value)) throw new Error('expected sink demos to be an array')
  if ((demos.value as Array<unknown>).length !== 2) throw new Error('expected sink demos length 2')
}

export const testFlowDataflowConnectedValuesFrontmatterComputedFalseDisablesRuntimeCompute = () => {
  const graphData = {
    type: 'GraphData',
    context: 'frontmatter-flow',
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterFlowSettings: {
        computed: false,
      },
    },
    nodes: [
      {
        id: 'src',
        type: 'input',
        label: 'Source',
        properties: {
          data: { urls: ['https://demo.local/a'] },
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'src',
        },
      },
      {
        id: 'transform',
        type: 'default',
        label: 'Transform',
        properties: {
          'flow:compute': '(inputs) => ({ demos: [{ url: "should-not-run" }] })',
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'transform',
        },
      },
      {
        id: 'sink',
        type: 'output',
        label: 'Sink',
        properties: {
          [FLOW_WIDGET_TYPE_ID_KEY]: 'default',
          [FLOW_WIDGET_FORM_ID_KEY]: 'sink',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'src', target: 'transform', properties: { 'flow:sourcePortKey': 'urls', 'flow:targetPortKey': 'urls' } },
      { id: 'e2', source: 'transform', target: 'sink', properties: { 'flow:sourcePortKey': 'demos', 'flow:targetPortKey': 'demos' } },
    ],
  }
  const registry = [
    {
      id: 'q-src',
      isEnabled: true,
      nodeTypeId: 'input',
      widgetTypeId: 'default',
      formId: 'src',
      fields: [],
      ports: [{ portKey: 'urls', direction: 'output' as const, schemaPath: 'properties.data.urls' }],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
    {
      id: 'q-transform',
      isEnabled: true,
      nodeTypeId: 'default',
      widgetTypeId: 'default',
      formId: 'transform',
      fields: [],
      ports: [
        { portKey: 'urls', direction: 'input' as const, schemaPath: 'properties.data.urls' },
        { portKey: 'demos', direction: 'output' as const, schemaPath: 'properties.data.demos' },
      ],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
    {
      id: 'q-sink',
      isEnabled: true,
      nodeTypeId: 'output',
      widgetTypeId: 'default',
      formId: 'sink',
      fields: [],
      ports: [{ portKey: 'demos', direction: 'input' as const, schemaPath: 'properties.data.demos' }],
      schemaMappings: [],
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
  ]

  const byNodeId = computeFlowConnectedValuesBySchemaPath({
    graphData: graphData as never,
    registry,
    targetNodeIds: new Set(['sink']),
  })
  const sink = byNodeId.get('sink')
  if (!sink) throw new Error('expected connected values for sink')
  const demos = sink['properties.data.demos']
  if (typeof demos?.value !== 'undefined') {
    throw new Error('expected runtime compute outputs to stay disabled when frontmatter flow computed=false')
  }
}
