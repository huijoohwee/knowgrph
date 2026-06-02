import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
} from '@/lib/graph/flowPorts'
import { formatFlowHandleValueList, readFlowHandleTypeLabel, type FlowHandleDir } from '@/lib/graph/flowHandlePresentation'
import { readNodeProperties, readRecordPathValue } from '@/lib/graph/nodeProperties'
import { FRONTMATTER_FLOW_HANDLES_VALUE_KEY, FRONTMATTER_FLOW_WIDGET_FIELDS_KEY } from '@/features/parsers/markdownFrontmatterFlowGraph.flowBlock'
import {
  formatWidgetFieldValueText,
  normalizeWidgetFieldSchemaPath,
} from '@/features/flow-editor-manager/widgetFieldMutation'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sortUniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map(value => pickString(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(entry => pickString(entry)).filter(Boolean) : []
}

export type FrontmatterFlowHandleKeySet = {
  target: string[]
  source: string[]
}

export type FrontmatterDeclaredFieldValue = {
  fieldKey: string
  fieldType: string
  schemaPath: string
  valueText: string
}

export type FrontmatterWidgetContractModel = {
  flowHandleKeys: FrontmatterFlowHandleKeySet
  frontmatterInKeys: string[]
  frontmatterOutKeys: string[]
  flowCompute: string
  hasFlowCompute: boolean
  hasFlowData: boolean
  flowDataJson: string
  hasFlowTargetHandles: boolean
  hasFlowSourceHandles: boolean
  declaredFieldValues: FrontmatterDeclaredFieldValue[]
}

export type FrontmatterWidgetContractRowSpec =
  | {
      kind: 'handle'
      rowKey: 'flow-handles-target' | 'flow-handles-source'
      dir: Extract<FlowHandleDir, 'in' | 'out'>
      typeLabel: 'in' | 'out'
      valueText: string
      portKeys: string[]
    }
  | {
      kind: 'data'
      rowKey: 'flow-data'
      fieldKey: 'data'
      typeLabel: 'object'
      valueText: string
    }
  | {
      kind: 'compute'
      rowKey: 'flow-compute'
      fieldKey: 'compute'
      typeLabel: 'function'
      valueText: string
    }
  | {
      kind: 'field'
      rowKey: string
      fieldKey: string
      schemaPath: string
      typeLabel: string
      valueText: string
    }

export type FrontmatterWidgetContractHandleRowSpec = Extract<FrontmatterWidgetContractRowSpec, { kind: 'handle' }>

export function buildFrontmatterWidgetContractModel(args: {
  node: Pick<GraphNode, 'id' | 'properties'> | null | undefined
  edges: ReadonlyArray<Pick<GraphEdge, 'source' | 'target' | 'properties'> | null | undefined> | null | undefined
  registryEntry?: Pick<WidgetRegistryEntry, 'fields' | 'ports'> | null | undefined
  suppressRegistryBackedDeclaredFields?: boolean
}): FrontmatterWidgetContractModel {
  const properties = readNodeProperties(args.node)
  const nodeId = pickString(args.node?.id)
  const edgeList = Array.isArray(args.edges) ? args.edges : []
  const suppressRegistryBackedDeclaredFields = args.suppressRegistryBackedDeclaredFields !== false

  const flowPortTypes: FrontmatterFlowHandleKeySet = (() => {
    const raw = properties['flow:portTypes']
    if (!isRecord(raw)) return { target: [], source: [] }
    const inPortsRaw = isRecord(raw.in) ? raw.in : {}
    const outPortsRaw = isRecord(raw.out) ? raw.out : {}
    return {
      target: sortUniqueStrings(Object.keys(inPortsRaw)),
      source: sortUniqueStrings(Object.keys(outPortsRaw)),
    }
  })()

  const connectedFlowHandles: FrontmatterFlowHandleKeySet = (() => {
    const target = new Set<string>()
    const source = new Set<string>()
    for (let i = 0; i < edgeList.length; i += 1) {
      const edge = edgeList[i]
      const src = pickString(edge?.source)
      const tgt = pickString(edge?.target)
      const props = edge?.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
        ? (edge.properties as Record<string, unknown>)
        : {}
      const srcKey = pickString(props[FLOW_EDGE_SOURCE_PORT_KEY])
      const tgtKey = pickString(props[FLOW_EDGE_TARGET_PORT_KEY])
      if (src === nodeId && srcKey) source.add(srcKey)
      if (tgt === nodeId && tgtKey) target.add(tgtKey)
    }
    return {
      target: sortUniqueStrings(target),
      source: sortUniqueStrings(source),
    }
  })()

  const flowRegistryHandles: FrontmatterFlowHandleKeySet = (() => {
    const ports = Array.isArray(args.registryEntry?.ports) ? args.registryEntry!.ports : []
    const target = new Set<string>()
    const source = new Set<string>()
    for (let i = 0; i < ports.length; i += 1) {
      const port = ports[i]
      if (!port || port.isHidden === true) continue
      const portKey = pickString(port.portKey)
      if (!portKey) continue
      if (port.direction === 'input') target.add(portKey)
      else if (port.direction === 'output') source.add(portKey)
    }
    return {
      target: sortUniqueStrings(target),
      source: sortUniqueStrings(source),
    }
  })()

  const handlesRecord = (() => {
    const handlesValue = properties[FRONTMATTER_FLOW_HANDLES_VALUE_KEY]
    return isRecord(handlesValue) ? handlesValue : null
  })()
  const frontmatterInKeys = sortUniqueStrings(readStringArray(handlesRecord?.target))
  const frontmatterOutKeys = sortUniqueStrings(readStringArray(handlesRecord?.source))
  const mergeHandleKeys = (...sets: string[][]): string[] => sortUniqueStrings(sets.flat())
  const flowHandleKeys: FrontmatterFlowHandleKeySet = {
    target: mergeHandleKeys(frontmatterInKeys, connectedFlowHandles.target, flowRegistryHandles.target, flowPortTypes.target),
    source: mergeHandleKeys(frontmatterOutKeys, connectedFlowHandles.source, flowRegistryHandles.source, flowPortTypes.source),
  }

  const flowCompute = pickString(properties['flow:compute'])
  const hasFlowCompute = Object.prototype.hasOwnProperty.call(properties, 'flow:compute')
  const hasFlowData = Object.prototype.hasOwnProperty.call(properties, 'data')
  const flowDataJson = (() => {
    const raw = properties.data
    if (typeof raw === 'string') return raw
    if (typeof raw === 'undefined') return ''
    try {
      return JSON.stringify(raw, null, 2) || ''
    } catch {
      return ''
    }
  })()

  const registrySchemaPaths = (() => {
    const out = new Set<string>()
    const fields = Array.isArray(args.registryEntry?.fields) ? args.registryEntry!.fields : []
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i] as { fieldKey?: unknown; schemaPath?: unknown } | undefined
      const fieldKey = pickString(field?.fieldKey)
      const schemaPath = normalizeWidgetFieldSchemaPath(field?.schemaPath, fieldKey)
      if (schemaPath) out.add(schemaPath)
    }
    const ports = Array.isArray(args.registryEntry?.ports) ? args.registryEntry!.ports : []
    for (let i = 0; i < ports.length; i += 1) {
      const port = ports[i] as { portKey?: unknown; schemaPath?: unknown } | undefined
      const portKey = pickString(port?.portKey)
      const schemaPath = normalizeWidgetFieldSchemaPath(port?.schemaPath, portKey)
      if (schemaPath) out.add(schemaPath)
    }
    return out
  })()

  const declaredFieldValues: FrontmatterDeclaredFieldValue[] = []
  const rawDeclaredFields = Array.isArray(properties[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY])
    ? (properties[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY] as unknown[])
    : []
  for (let i = 0; i < rawDeclaredFields.length; i += 1) {
    const field = rawDeclaredFields[i]
    if (!isRecord(field)) continue
    const fieldKey = pickString(field.fieldKey)
    const fieldType = pickString(field.fieldType) || 'unknown'
    const schemaPath = pickString(field.schemaPath) || fieldKey
    if (!fieldKey || !schemaPath) continue
    const normalizedSchemaPath = normalizeWidgetFieldSchemaPath(schemaPath, fieldKey)
    if (suppressRegistryBackedDeclaredFields && registrySchemaPaths.has(normalizedSchemaPath)) continue
    if (
      schemaPath === FRONTMATTER_FLOW_HANDLES_VALUE_KEY
      || schemaPath === 'flow:compute'
      || schemaPath === 'data'
      || fieldKey === 'handles'
      || fieldKey === 'compute'
      || fieldKey === 'data'
    ) {
      continue
    }
    const rawValue = readRecordPathValue(properties, schemaPath)
    if (typeof rawValue === 'undefined') continue
    declaredFieldValues.push({
      fieldKey,
      fieldType,
      schemaPath,
      valueText: formatWidgetFieldValueText(rawValue),
    })
  }

  return {
    flowHandleKeys,
    frontmatterInKeys,
    frontmatterOutKeys,
    flowCompute,
    hasFlowCompute,
    hasFlowData,
    flowDataJson,
    hasFlowTargetHandles: flowHandleKeys.target.length > 0,
    hasFlowSourceHandles: flowHandleKeys.source.length > 0,
    declaredFieldValues,
  }
}

export function buildFrontmatterWidgetContractRowSpecs(
  model: FrontmatterWidgetContractModel,
): {
  handleRows: ReadonlyArray<FrontmatterWidgetContractHandleRowSpec>
  envelopeRows: ReadonlyArray<FrontmatterWidgetContractRowSpec>
} {
  const handleRows: FrontmatterWidgetContractHandleRowSpec[] = []

  const pushHandleRow = (args: {
    dir: 'in' | 'out'
    hasHandles: boolean
    frontmatterPortKeys: string[]
    resolvedHandleKeys: string[]
  }) => {
    const portKeys = args.resolvedHandleKeys.length > 0 ? args.resolvedHandleKeys : args.frontmatterPortKeys
    if (!args.hasHandles && portKeys.length <= 0) return
    handleRows.push({
      kind: 'handle',
      rowKey: args.dir === 'in' ? 'flow-handles-target' : 'flow-handles-source',
      dir: args.dir,
      typeLabel: readFlowHandleTypeLabel(args.dir),
      valueText: formatFlowHandleValueList(portKeys),
      portKeys,
    })
  }

  pushHandleRow({
    dir: 'in',
    hasHandles: model.hasFlowTargetHandles,
    frontmatterPortKeys: model.frontmatterInKeys,
    resolvedHandleKeys: model.flowHandleKeys.target,
  })
  pushHandleRow({
    dir: 'out',
    hasHandles: model.hasFlowSourceHandles,
    frontmatterPortKeys: model.frontmatterOutKeys,
    resolvedHandleKeys: model.flowHandleKeys.source,
  })

  const envelopeRows: FrontmatterWidgetContractRowSpec[] = [...handleRows]
  if (model.hasFlowData) {
    envelopeRows.push({
      kind: 'data',
      rowKey: 'flow-data',
      fieldKey: 'data',
      typeLabel: 'object',
      valueText: model.flowDataJson,
    })
  }
  if (model.hasFlowCompute) {
    envelopeRows.push({
      kind: 'compute',
      rowKey: 'flow-compute',
      fieldKey: 'compute',
      typeLabel: 'function',
      valueText: model.flowCompute,
    })
  }
  for (let i = 0; i < model.declaredFieldValues.length; i += 1) {
    const field = model.declaredFieldValues[i]
    if (!field) continue
    envelopeRows.push({
      kind: 'field',
      rowKey: `flow-envelope-field-${field.fieldKey}-${i}`,
      fieldKey: field.fieldKey,
      schemaPath: field.schemaPath,
      typeLabel: field.fieldType,
      valueText: field.valueText,
    })
  }

  return { handleRows, envelopeRows }
}
