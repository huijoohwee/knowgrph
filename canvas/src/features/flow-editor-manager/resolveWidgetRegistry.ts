import type { GraphNode, JSONValue } from '@/lib/graph/types'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { readNodeProperties } from '@/lib/graph/nodeProperties'

import { getWidgetRegistryEntryLabel } from '@/features/flow-editor-manager/registryTemplates'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

export const FLOW_WIDGET_TYPE_ID_KEY = 'flow:widgetTypeId' as const
export const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const

const pickString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

type RegistryIndex = {
  byNodeType: Map<string, ReadonlyArray<WidgetRegistryEntry>>
}

const registryIndexCache = new WeakMap<object, RegistryIndex>()

const getRegistryIndex = (registry: ReadonlyArray<WidgetRegistryEntry>): RegistryIndex => {
  const cached = registryIndexCache.get(registry as unknown as object)
  if (cached) return cached
  const byNodeType = new Map<string, WidgetRegistryEntry[]>()
  for (let i = 0; i < registry.length; i += 1) {
    const e = registry[i]
    if (!e || e.isEnabled !== true) continue
    const nt = String(e.nodeTypeId || '').trim()
    if (!nt) continue
    const list = byNodeType.get(nt) || []
    list.push(e)
    byNodeType.set(nt, list)
  }
  const idx: RegistryIndex = { byNodeType }
  registryIndexCache.set(registry as unknown as object, idx)
  return idx
}

const entryRichnessScore = (entry: WidgetRegistryEntry): number => {
  const ports = Array.isArray(entry.ports) ? entry.ports.length : 0
  const schemaMappings = Array.isArray(entry.schemaMappings) ? entry.schemaMappings.length : 0
  const fields = Array.isArray(entry.fields) ? entry.fields.length : 0
  return ports * 100 + schemaMappings * 20 + fields * 5
}

const compareRegistryEntries = (a: WidgetRegistryEntry, b: WidgetRegistryEntry): number => {
  const t = a.widgetTypeId.localeCompare(b.widgetTypeId)
  if (t !== 0) return t
  const f = a.formId.localeCompare(b.formId)
  if (f !== 0) return f
  const richnessDelta = entryRichnessScore(b) - entryRichnessScore(a)
  if (richnessDelta !== 0) return richnessDelta
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
}

export function resolveWidgetRegistryEntry(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): WidgetRegistryEntry | null {
  const props = readNodeProperties(args.node) as Record<string, JSONValue | undefined>
  const wantType = pickString(props[FLOW_WIDGET_TYPE_ID_KEY])
  const wantForm = pickString(props[FLOW_WIDGET_FORM_ID_KEY])
  const isFrontmatterFlow = pickString(args.graphMetaKind) === 'frontmatter-flow' || (wantForm && wantForm.startsWith('fm:'))
  const candidatesAll = listScopedWidgetRegistryEntries(args)
  if (candidatesAll.length === 0) return null

  if (isFrontmatterFlow) {
    let bestMatch: WidgetRegistryEntry | null = null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (wantType && e.widgetTypeId !== wantType) continue
      if (!bestMatch) {
        bestMatch = e
        continue
      }
      if (compareRegistryEntries(e, bestMatch) < 0) bestMatch = e
    }
    return bestMatch
  }

  const restrictByType = (() => {
    if (!wantType) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      if (candidatesAll[i]?.widgetTypeId === wantType) return wantType
    }
    return null
  })()

  const restrictByForm = (() => {
    if (!wantForm) return null
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.widgetTypeId !== restrictByType) continue
      if (e.formId === wantForm) return wantForm
    }
    return null
  })()

  const prefer = (typeId: string, formId?: string) => {
    for (let i = 0; i < candidatesAll.length; i += 1) {
      const e = candidatesAll[i]
      if (!e) continue
      if (restrictByType && e.widgetTypeId !== restrictByType) continue
      if (restrictByForm && e.formId !== restrictByForm) continue
      if (e.widgetTypeId !== typeId) continue
      if (formId && e.formId !== formId) continue
      return e
    }
    return null
  }

  const preferred = prefer('default', wantForm || undefined) || prefer('default')
  if (preferred) return preferred

  let best: WidgetRegistryEntry | null = null
  for (let i = 0; i < candidatesAll.length; i += 1) {
    const e = candidatesAll[i]
    if (!e) continue
    if (restrictByType && e.widgetTypeId !== restrictByType) continue
    if (restrictByForm && e.formId !== restrictByForm) continue
    if (!best) {
      best = e
      continue
    }
    if (compareRegistryEntries(e, best) < 0) best = e
  }
  return best
}

export function isMarkdownHeadingSectionNode(
  node: Pick<GraphNode, 'type' | 'properties'> | null | undefined,
): boolean {
  if (!node || pickString(node.type) !== 'Section') return false
  const props = readNodeProperties(node)
  return typeof props.level === 'number' && Number.isFinite(props.level)
}

export function hasWidgetRegistryHint(
  node: Pick<GraphNode, 'properties'> | null | undefined,
): boolean {
  const props = readNodeProperties(node)
  return Boolean(pickString(props[FLOW_WIDGET_TYPE_ID_KEY]) || pickString(props[FLOW_WIDGET_FORM_ID_KEY]))
}

export function resolveNodeWidgetIdentity(args: {
  node: Pick<GraphNode, 'properties'> | null | undefined
  registryEntry?: Pick<WidgetRegistryEntry, 'widgetTypeId' | 'formId'> | null | undefined
}): {
  widgetTypeId: string
  formId: string
} {
  const props = readNodeProperties(args.node)
  return {
    widgetTypeId: pickString(args.registryEntry?.widgetTypeId) || pickString(props[FLOW_WIDGET_TYPE_ID_KEY]),
    formId: pickString(args.registryEntry?.formId) || pickString(props[FLOW_WIDGET_FORM_ID_KEY]),
  }
}

export function resolveExpectedFrontmatterWidgetFormId(
  node: Pick<GraphNode, 'id' | 'properties'> | null | undefined,
): string {
  const widgetIdentity = resolveNodeWidgetIdentity({ node })
  if (widgetIdentity.formId) return widgetIdentity.formId
  const nodeId = pickString(node?.id)
  return nodeId ? `fm:${nodeId}` : ''
}

export function isFrontmatterWidgetRegistryNode(
  node: Pick<GraphNode, 'type'> | null | undefined,
): boolean {
  const nodeType = pickString(node?.type)
  return (
    nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
  )
}

export function isNodeOwnedFrontmatterWidgetRegistryEntry(args: {
  node: Pick<GraphNode, 'id' | 'properties'> | null | undefined
  registryEntry?: Pick<WidgetRegistryEntry, 'formId'> | null | undefined
}): boolean {
  const formId = pickString(args.registryEntry?.formId)
  if (!formId) return false
  return formId === resolveExpectedFrontmatterWidgetFormId(args.node)
}

export function resolveFrontmatterWidgetRegistrySectionState(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registryEntry?: Pick<WidgetRegistryEntry, 'nodeTypeId' | 'widgetTypeId' | 'formId'> | null | undefined
  graphMetaKind?: string | null | undefined
}): {
  visible: boolean
  hideFlowContractRows: boolean
  identityLabel: string
} {
  const isFrontmatterFlow = pickString(args.graphMetaKind) === 'frontmatter-flow'
  const visible = Boolean(
    isFrontmatterFlow
    && isFrontmatterWidgetRegistryNode(args.node)
    && isNodeOwnedFrontmatterWidgetRegistryEntry({
      node: args.node,
      registryEntry: args.registryEntry,
    }),
  )
  if (!visible || !args.registryEntry) {
    return { visible: false, hideFlowContractRows: false, identityLabel: '' }
  }
  return {
    visible: true,
    hideFlowContractRows: true,
    identityLabel: getWidgetRegistryEntryLabel({
      nodeTypeId: pickString(args.node?.type) || pickString(args.registryEntry.nodeTypeId),
      widgetTypeId: pickString(args.registryEntry.widgetTypeId),
      formId: pickString(args.registryEntry.formId),
    }),
  }
}

export function listScopedWidgetRegistryEntries(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): ReadonlyArray<WidgetRegistryEntry> {
  const nodeType = pickString(args.node?.type)
  if (!nodeType) return []
  const reg = Array.isArray(args.registry) ? args.registry : []
  if (reg.length === 0) return []
  const candidatesAll = getRegistryIndex(reg).byNodeType.get(nodeType) || []
  if (candidatesAll.length === 0) return []
  const widgetIdentity = resolveNodeWidgetIdentity({ node: args.node })
  const isFrontmatterFlow =
    pickString(args.graphMetaKind) === 'frontmatter-flow'
    || (widgetIdentity.formId && widgetIdentity.formId.startsWith('fm:'))
  if (!isFrontmatterFlow) return candidatesAll
  const expectedForm = resolveExpectedFrontmatterWidgetFormId(args.node)
  if (!expectedForm) return []
  return candidatesAll.filter(entry => pickString(entry.formId) === expectedForm)
}

export function isWidgetCandidateNode(args: {
  node: Pick<GraphNode, 'id' | 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): boolean {
  const node = args.node
  if (!node || isMarkdownHeadingSectionNode(node)) return false
  return hasWidgetRegistryHint(node) || !!resolveWidgetRegistryEntry(args)
}

export function deriveWidgetCandidateNodeIds(args: {
  nodeById: ReadonlyMap<string, Pick<GraphNode, 'id' | 'type' | 'properties'>> | null | undefined
  openWidgetNodeIds: ReadonlyArray<string> | null | undefined
  selectedNodeId?: string | null | undefined
  registry: ReadonlyArray<WidgetRegistryEntry> | null | undefined
  graphMetaKind?: string | null | undefined
}): string[] {
  const nodeById = args.nodeById || null
  if (!nodeById || nodeById.size === 0) return []
  const collected: string[] = []
  const seen = new Set<string>()

  const pushOpenWidgetNodeId = (id: string) => {
    if (!id || seen.has(id)) return
    const node = nodeById.get(id) || null
    if (!node || isMarkdownHeadingSectionNode(node)) return
    seen.add(id)
    collected.push(id)
  }

  const openWidgetNodeIds = Array.isArray(args.openWidgetNodeIds) ? args.openWidgetNodeIds : []
  for (let i = 0; i < openWidgetNodeIds.length; i += 1) {
    pushOpenWidgetNodeId(String(openWidgetNodeIds[i] || '').trim())
  }

  const selectedNodeId = pickString(args.selectedNodeId)
  if (!selectedNodeId || seen.has(selectedNodeId)) return collected
  const selectedNode = nodeById.get(selectedNodeId) || null
  if (!isWidgetCandidateNode({
    node: selectedNode,
    registry: args.registry,
    graphMetaKind: args.graphMetaKind,
  })) return collected
  seen.add(selectedNodeId)
  collected.push(selectedNodeId)
  return collected
}
