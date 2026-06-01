import {
  buildFrontmatterWidgetContractModel,
  buildFrontmatterWidgetContractRowSpecs,
} from '@/features/flow-editor-manager/frontmatterWidgetContract'
import { FRONTMATTER_FLOW_HANDLES_VALUE_KEY, FRONTMATTER_FLOW_WIDGET_FIELDS_KEY } from '@/features/parsers/markdownFrontmatterFlowGraph.flowBlock'

export const testBuildFrontmatterWidgetContractModelPrefersConnectedThenRegistryThenTypedHandles = () => {
  const model = buildFrontmatterWidgetContractModel({
    node: {
      id: 'node-a',
      properties: {
        'flow:portTypes': {
          in: { typedIn: 'string' },
          out: { typedOut: 'string' },
        },
        [FRONTMATTER_FLOW_HANDLES_VALUE_KEY]: {
          target: ['declaredIn'],
          source: ['declaredOut'],
        },
      },
    },
    edges: [
      {
        source: 'node-a',
        target: 'other',
        properties: { 'flow:sourcePortKey': 'connectedOut' },
      },
    ],
    registryEntry: {
      fields: [],
      ports: [
        { direction: 'input', portKey: 'registryIn' },
        { direction: 'output', portKey: 'registryOut' },
      ],
    },
  })

  if (model.flowHandleKeys.target.length !== 1 || model.flowHandleKeys.target[0] !== 'registryIn') {
    throw new Error(`expected target handles to fall back to registry ports, got [${model.flowHandleKeys.target.join(', ')}]`)
  }
  if (model.flowHandleKeys.source.length !== 1 || model.flowHandleKeys.source[0] !== 'connectedOut') {
    throw new Error(`expected source handles to prefer connected edge ports, got [${model.flowHandleKeys.source.join(', ')}]`)
  }
  if (model.frontmatterInKeys[0] !== 'declaredIn' || model.frontmatterOutKeys[0] !== 'declaredOut') {
    throw new Error('expected frontmatter handle snapshots to stay available for interactive dot rendering')
  }
}

export const testBuildFrontmatterWidgetContractModelFiltersReservedAndRegistryBackedDeclaredFields = () => {
  const model = buildFrontmatterWidgetContractModel({
    node: {
      id: 'node-b',
      properties: {
        title: 'Hello',
        extra: { ok: true },
        data: { should: 'skip' },
        'flow:compute': '(inputs) => inputs',
        [FRONTMATTER_FLOW_WIDGET_FIELDS_KEY]: [
          { fieldKey: 'title', fieldType: 'string', schemaPath: 'title' },
          { fieldKey: 'data', fieldType: 'object', schemaPath: 'data' },
          { fieldKey: 'compute', fieldType: 'function', schemaPath: 'flow:compute' },
          { fieldKey: 'extra', fieldType: 'object', schemaPath: 'extra' },
        ],
      },
    },
    edges: [],
    registryEntry: {
      fields: [{ fieldKey: 'title', fieldType: 'text', schemaPath: 'title' }],
      ports: [],
    },
  })

  if (model.hasFlowData !== true || model.hasFlowCompute !== true) {
    throw new Error('expected flow data and compute flags to reflect explicit frontmatter contract properties')
  }
  if (model.declaredFieldValues.length !== 1 || model.declaredFieldValues[0]?.fieldKey !== 'extra') {
    throw new Error(`expected only non-reserved non-registry declared fields to remain, got [${model.declaredFieldValues.map(field => field.fieldKey).join(', ')}]`)
  }
  if (model.declaredFieldValues[0]?.schemaPath !== 'extra') {
    throw new Error(`expected declared field schemaPath to stay available for editable value rows, got ${String(model.declaredFieldValues[0]?.schemaPath || '')}`)
  }
  if (!model.declaredFieldValues[0]?.valueText.includes('"ok": true')) {
    throw new Error(`expected declared field values to preserve serialized object payloads, got ${String(model.declaredFieldValues[0]?.valueText || '')}`)
  }
}

export const testBuildFrontmatterWidgetContractRowSpecsBuildsHandleAndEnvelopeDescriptors = () => {
  const model = buildFrontmatterWidgetContractModel({
    node: {
      id: 'node-c',
      properties: {
        ratio: 0.7,
        data: { ok: true },
        'flow:compute': '(inputs) => inputs',
        [FRONTMATTER_FLOW_HANDLES_VALUE_KEY]: {
          target: ['declaredIn'],
          source: ['declaredOut'],
        },
        [FRONTMATTER_FLOW_WIDGET_FIELDS_KEY]: [
          { fieldKey: 'ratio', fieldType: 'number', schemaPath: 'ratio' },
        ],
      },
    },
    edges: [],
    registryEntry: {
      fields: [],
      ports: [
        { direction: 'input', portKey: 'registryIn' },
        { direction: 'output', portKey: 'registryOut' },
      ],
    },
  })
  const rows = buildFrontmatterWidgetContractRowSpecs(model)

  if (rows.handleRows.length !== 2) {
    throw new Error(`expected two handle row specs, got ${rows.handleRows.length}`)
  }
  if (rows.handleRows[0]?.kind !== 'handle' || rows.handleRows[0]?.rowKey !== 'flow-handles-target') {
    throw new Error(`expected first handle row spec to target handles.target, got ${String(rows.handleRows[0]?.rowKey || '<none>')}`)
  }
  if (rows.handleRows[0]?.valueText !== '"registryIn"') {
    throw new Error(`expected handle row spec to carry formatted normalized handle values, got ${String(rows.handleRows[0]?.valueText || '')}`)
  }
  if (rows.envelopeRows.length !== 5) {
    throw new Error(`expected handle+data+compute envelope row specs, got ${rows.envelopeRows.length}`)
  }
  if (!rows.envelopeRows.some(row => row.kind === 'data' && row.rowKey === 'flow-data')) {
    throw new Error('expected envelope row specs to include explicit data row descriptor when flow data is present')
  }
  if (!rows.envelopeRows.some(row => row.kind === 'compute' && row.rowKey === 'flow-compute')) {
    throw new Error('expected envelope row specs to include explicit compute row descriptor when flow compute is present')
  }
  if (!rows.envelopeRows.some(row => row.kind === 'field' && row.schemaPath)) {
    throw new Error('expected field envelope row specs to preserve schema paths for editable Value rows')
  }
}
