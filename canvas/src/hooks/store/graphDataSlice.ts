import { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types';
import { validateNodeProperties, validateEdgeProperties, canAddEdge } from '@/features/schema/validation';
import type { StoreApi } from 'zustand';
import type { GraphState } from '@/hooks/store/types'
import { LS_KEYS } from '@/lib/config'
import { lsRemove } from '@/lib/persistence'
import { persistGraphDataToLocalStorage } from './graphDataPersistence'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import { isJsonValue } from '@/lib/graph/jsonValue'
import { normalizeGraphData } from '@/lib/graph/normalize'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { buildSourceLayerKeys, composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'
import {
  applyLayoutAutosuggestFromMetadata,
  applyWidgetRegistryFromMetadata,
  hashGraphDataForPreviewSync,
  syncGraphFieldsWithGraphData,
  readGraphRagWorkflowJsonTextFromGraphData,
  withGraphDataRevision,
} from './graphDataSliceUtils'
import { containsFrontmatterMermaid, isMarkdownLikeFileName, normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { createSubgraph, readSubgraphs, removeSubgraph as removeSubgraphFromGraphData, subgraphGroupId, updateSubgraph as updateSubgraphInGraphData } from '@/lib/graph/subgraphs'
import { extractYamlFrontmatterBlock } from '@/lib/markdown/frontmatter'
import {
  buildDefaultVisibleColumns,
  isGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'

type SetGraph = StoreApi<GraphState>['setState']
export type GetGraph = StoreApi<GraphState>['getState']

type ParsedComposedId = { layerId: string; innerId: string }

const COMPOSED_NODE_POSITION_KEYS = new Set(['x', 'y', 'vx', 'vy', 'fx', 'fy'])

function normalizeComposedSourcePath(raw: unknown): string {
  const text = String(raw || '').trim().replace(/\\/g, '/')
  if (!text) return ''
  const withoutWorkspace = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  return withoutWorkspace.replace(/^\/+/, '')
}

function resolvePreferredComposedLayerId(args: { get: GetGraph; explicitLayerId?: string | null }): string | null {
  const explicit = String(args.explicitLayerId || '').trim()
  if (explicit) return explicit
  const state = args.get()
  const sourceFiles = state.sourceFiles || []
  const explorerActivePath = normalizeComposedSourcePath(useMarkdownExplorerStore.getState().activePath)
  const activeDocPath = normalizeComposedSourcePath(state.markdownDocumentName) || explorerActivePath
  if (activeDocPath) {
    const activeFile = sourceFiles.find(f => {
      if (!f?.enabled) return false
      const sourcePath = normalizeComposedSourcePath(f.source?.path || f.name || '')
      return sourcePath === activeDocPath
    })
    if (activeFile?.id) return String(activeFile.id)
  }
  const selectedLayerId = parseComposedId(state.selectedNodeId || '')?.layerId || ''
  if (selectedLayerId) return selectedLayerId
  const fallbackLayerId = sourceFiles.find(f => f.enabled && !!f.parsedGraphData)?.id || null
  return fallbackLayerId ? String(fallbackLayerId) : null
}

function ensureSourceFileGraphData(file: GraphState['sourceFiles'][number]): GraphData {
  const parsed = file?.parsedGraphData
  if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed
  return { type: 'Graph', nodes: [], edges: [], metadata: {} }
}

function isPositionOnlyNodeUpdate(updates: Partial<GraphNode>): boolean {
  const keys = Object.keys(updates || {})
  if (keys.length === 0) return false
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    if (!k) continue
    if (!COMPOSED_NODE_POSITION_KEYS.has(k)) return false
  }
  return true
}

function mergeNodeForUpdate(current: GraphNode, updates: Partial<GraphNode>): GraphNode {
  const hasX = Object.prototype.hasOwnProperty.call(updates, 'x')
  const hasY = Object.prototype.hasOwnProperty.call(updates, 'y')
  const isPositionCommit = hasX || hasY
  if (!isPositionCommit) return { ...current, ...updates }

  const hasFx = Object.prototype.hasOwnProperty.call(updates, 'fx')
  const hasFy = Object.prototype.hasOwnProperty.call(updates, 'fy')
  const hasVx = Object.prototype.hasOwnProperty.call(updates, 'vx')
  const hasVy = Object.prototype.hasOwnProperty.call(updates, 'vy')
  const clearPins = !hasFx && !hasFy
  const clearVelocity = !hasVx && !hasVy

  if (!clearPins && !clearVelocity) return { ...current, ...updates }

  const any = current as unknown as Record<string, unknown>
  const rest: Record<string, unknown> = { ...any }
  if (clearPins) {
    delete rest.fx
    delete rest.fy
  }
  if (clearVelocity) {
    delete rest.vx
    delete rest.vy
  }
  return { ...(rest as unknown as GraphNode), ...updates }
}

let composedPendingPositionWrites: Record<string, Record<string, Partial<GraphNode>>> = {}
let composedPendingPositionWriteGraphKey = ''

function readComposedPositionWriteGraphKey(graphData: GraphData | null): string {
  if (!graphData || !isComposedGraphData(graphData)) return ''
  const meta = (graphData.metadata || {}) as Record<string, unknown>
  const content = typeof meta.sourceLayerHash === 'string' ? meta.sourceLayerHash : ''
  const order = typeof meta.sourceLayerOrderHash === 'string' ? meta.sourceLayerOrderHash : ''
  return `${content}|${order}`
}

function isPureComposedNodePositionUpdate(updates: Partial<GraphNode>): boolean {
  const keys = Object.keys(updates || {})
  if (keys.length === 0) return false
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    if (!k) continue
    if (!COMPOSED_NODE_POSITION_KEYS.has(k)) return false
  }
  return true
}

function flushComposedPositionWritesNow(args: { set: SetGraph; get: GetGraph }): void {
  const stateForKey = args.get()
  const currentKey = readComposedPositionWriteGraphKey(stateForKey.graphData)
  if (composedPendingPositionWriteGraphKey && currentKey && composedPendingPositionWriteGraphKey !== currentKey) {
    composedPendingPositionWrites = {}
    composedPendingPositionWriteGraphKey = ''
    return
  }
  const pending = composedPendingPositionWrites
  composedPendingPositionWrites = {}
  composedPendingPositionWriteGraphKey = ''
  const sourceFiles = args.get().sourceFiles || []
  if (sourceFiles.length === 0) return

  let changed = false
  const nextSourceFiles = sourceFiles.map(f => {
    const byInnerId = pending[String(f.id || '')]
    if (!byInnerId) return f
    const pg = f.parsedGraphData
    if (!pg || !Array.isArray(pg.nodes)) return f

    let touched = false
    const nextNodes = pg.nodes.map(n => {
      const u = byInnerId[String(n.id || '')]
      if (!u) return n
      touched = true
      return mergeNodeForUpdate(n as unknown as GraphNode, u)
    })
    if (!touched) return f
    changed = true
    return {
      ...f,
      parsedGraphData: { ...pg, nodes: nextNodes },
      parsedGraphRevision: (f.parsedGraphRevision || 0) + 1,
    }
  })

  if (!changed) return
  const state = args.get()
  const currentGraphData = state.graphData
  if (currentGraphData && isComposedGraphData(currentGraphData)) {
    try {
      const layers = buildLayersFromSourceFiles(nextSourceFiles)
      const { contentKey, orderKey } = buildSourceLayerKeys(layers)
      const currentMeta = (currentGraphData.metadata && typeof currentGraphData.metadata === 'object'
        ? (currentGraphData.metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>
      const prevContentKey = typeof currentMeta.sourceLayerHash === 'string' ? currentMeta.sourceLayerHash : ''
      const prevOrderKey = typeof currentMeta.sourceLayerOrderHash === 'string' ? currentMeta.sourceLayerOrderHash : ''
      if (prevContentKey === contentKey && prevOrderKey === orderKey) {
        args.set({ sourceFiles: nextSourceFiles })
        return
      }
      args.set({
        sourceFiles: nextSourceFiles,
        graphData: {
          ...currentGraphData,
          metadata: {
            ...(currentGraphData.metadata && typeof currentGraphData.metadata === 'object' ? currentGraphData.metadata : {}),
            sourceLayerHash: contentKey,
            sourceLayerOrderHash: orderKey,
          } as unknown as GraphData['metadata'],
        },
      })
      return
    } catch {
      void 0
    }
  }
  args.set({ sourceFiles: nextSourceFiles })
}

function parseComposedId(id: string | null | undefined): ParsedComposedId | null {
  const text = String(id || '')
  const idx = text.indexOf('::')
  if (idx <= 0) return null
  const layerId = text.slice(0, idx).trim()
  const innerId = text.slice(idx + 2)
  if (!layerId || !innerId) return null
  return { layerId, innerId }
}

function isComposedGraphData(graphData: GraphData | null): boolean {
  const meta = (graphData?.metadata || {}) as Record<string, unknown>
  return String(meta.sourceLayerComposition || '') === 'compose'
}

function hasStableSameSourceTopology(current: GraphData | null, next: GraphData | null): boolean {
  if (!current || !next) return false
  const currentMeta = (current.metadata || {}) as Record<string, unknown>
  const nextMeta = (next.metadata || {}) as Record<string, unknown>
  const currentSource = typeof currentMeta.source === 'string' ? currentMeta.source.trim() : ''
  const nextSource = typeof nextMeta.source === 'string' ? nextMeta.source.trim() : ''
  if (!currentSource || !nextSource || currentSource !== nextSource) return false
  const currentKind = String(currentMeta.kind || '').trim()
  const nextKind = String(nextMeta.kind || '').trim()
  if (currentKind !== nextKind) return false

  const currentNodeIds = (current.nodes || []).map(n => String(n?.id || '').trim()).filter(Boolean).sort()
  const nextNodeIds = (next.nodes || []).map(n => String(n?.id || '').trim()).filter(Boolean).sort()
  if (currentNodeIds.length !== nextNodeIds.length) return false
  for (let i = 0; i < currentNodeIds.length; i += 1) {
    if (currentNodeIds[i] !== nextNodeIds[i]) return false
  }

  const currentEdgeSig = (current.edges || [])
    .map(e => `${String(e?.id || '').trim()}|${String(e?.source || '').trim()}|${String(e?.target || '').trim()}`)
    .filter(Boolean)
    .sort()
  const nextEdgeSig = (next.edges || [])
    .map(e => `${String(e?.id || '').trim()}|${String(e?.source || '').trim()}|${String(e?.target || '').trim()}`)
    .filter(Boolean)
    .sort()
  if (currentEdgeSig.length !== nextEdgeSig.length) return false
  for (let i = 0; i < currentEdgeSig.length; i += 1) {
    if (currentEdgeSig[i] !== nextEdgeSig[i]) return false
  }
  return true
}

function hasStableSameSourceNodeLayout(current: GraphData | null, next: GraphData | null): boolean {
  if (!current || !next) return false
  if (!hasStableSameSourceTopology(current, next)) return false
  const currentById = new Map<string, { x: number | null; y: number | null }>()
  for (let i = 0; i < (current.nodes || []).length; i += 1) {
    const node = current.nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    currentById.set(id, {
      x: typeof node?.x === 'number' && Number.isFinite(node.x) ? Math.round(node.x) : null,
      y: typeof node?.y === 'number' && Number.isFinite(node.y) ? Math.round(node.y) : null,
    })
  }
  for (let i = 0; i < (next.nodes || []).length; i += 1) {
    const node = next.nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    const cur = currentById.get(id)
    if (!cur) return false
    const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? Math.round(node.x) : null
    const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? Math.round(node.y) : null
    if (cur.x !== x || cur.y !== y) return false
  }
  return true
}

function cloneDesignLayerState(
  value: import('@/features/design/designLayersState').DesignLayerState | undefined,
): import('@/features/design/designLayersState').DesignLayerState {
  return {
    order: Array.isArray(value?.order) ? value!.order.slice() : [],
    hiddenById: value?.hiddenById ? { ...value.hiddenById } : {},
  }
}

function buildLayersFromSourceFiles(sourceFiles: GraphState['sourceFiles']) {
  return (sourceFiles || []).map(f => ({
    id: f.id,
    name: f.name,
    enabled: Boolean(f.enabled),
    source: f.source,
    text: f.text,
    parsedTextHash: f.parsedTextHash,
    parsedGraphRevision: f.parsedGraphRevision,
    parsedGraphData: f.parsedGraphData,
  }))
}

const FLOW_YAML_PLAIN_KEY_RE = /^[A-Za-z0-9_.-]+$/
const FLOW_EDGE_SOURCE_PORT_KEY = 'flow:sourcePortKey'
const FLOW_EDGE_TARGET_PORT_KEY = 'flow:targetPortKey'
const FLOW_COMPUTE_PROPERTY_KEY = 'flow:compute'
const FLOW_PORT_TYPES_PROPERTY_KEY = 'flow:portTypes'
const FRONTMATTER_HANDLES_PROPERTY_KEY = 'frontmatter:handles'
const FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY = 'frontmatter:widgetFields'

type FrontmatterWidgetFieldSpec = {
  fieldKey: string
  fieldType: string
  schemaPath?: string
}

function flowYamlKey(key: string): string {
  return FLOW_YAML_PLAIN_KEY_RE.test(key) ? key : JSON.stringify(key)
}

function flowYamlInlineValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value == null) return 'null'
  try {
    return JSON.stringify(value)
  } catch {
    return 'null'
  }
}

function flowYamlInlineStringValue(value: string): string {
  return FLOW_YAML_PLAIN_KEY_RE.test(value) ? value : JSON.stringify(value)
}

function appendFlowYamlFieldLines(lines: string[], indent: string, key: string, value: unknown): void {
  if (typeof value === 'undefined') return
  const yamlKey = flowYamlKey(key)
  if (typeof value === 'string' && value.includes('\n')) {
    lines.push(`${indent}${yamlKey}: |`)
    for (const row of value.split('\n')) lines.push(`${indent}  ${row}`)
    return
  }
  lines.push(`${indent}${yamlKey}: ${flowYamlInlineValue(value)}`)
}

function inferFrontmatterFlowFieldType(value: unknown): string {
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (value && typeof value === 'object') return 'object'
  return 'string'
}

function readFrontmatterWidgetFieldSpecs(node: GraphNode): FrontmatterWidgetFieldSpec[] {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props[FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY]
  if (!Array.isArray(raw)) return []
  const out: FrontmatterWidgetFieldSpec[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const spec = raw[i]
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue
    const rec = spec as Record<string, unknown>
    const fieldKey = String(rec.fieldKey || '').trim()
    const fieldType = String(rec.fieldType || '').trim()
    const schemaPath = String(rec.schemaPath || '').trim()
    if (!fieldKey || !fieldType) continue
    out.push({
      fieldKey,
      fieldType,
      ...(schemaPath ? { schemaPath } : {}),
    })
  }
  return out
}

function readFrontmatterFlowFieldType(node: GraphNode, fieldName: string, value: unknown): string {
  const normalizedFieldName = String(fieldName || '').trim()
  if (!normalizedFieldName) return inferFrontmatterFlowFieldType(value)
  if (normalizedFieldName === 'id' || normalizedFieldName === 'type' || normalizedFieldName === 'label') return 'string'
  if (normalizedFieldName === 'position') return 'object'
  if (normalizedFieldName === 'handles') return 'object'
  if (normalizedFieldName === 'compute') return 'string'
  const specs = readFrontmatterWidgetFieldSpecs(node)
  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i]
    if (!spec) continue
    const schemaPath = String(spec.schemaPath || '').trim()
    if (schemaPath === normalizedFieldName || schemaPath === `properties.${normalizedFieldName}` || spec.fieldKey === normalizedFieldName) {
      return spec.fieldType
    }
  }
  return inferFrontmatterFlowFieldType(value)
}

function appendFlowYamlEnvelopeFieldLines(
  lines: string[],
  indent: string,
  key: string,
  value: unknown,
  fieldType?: string,
): void {
  if (typeof value === 'undefined') return
  const yamlKey = flowYamlKey(key)
  const normalizedType = String(fieldType || '').trim() || inferFrontmatterFlowFieldType(value)
  if (typeof value === 'string' && value.includes('\n')) {
    lines.push(`${indent}${yamlKey}:`)
    lines.push(`${indent}  key: ${flowYamlInlineStringValue(String(key || '').trim() || key)}`)
    lines.push(`${indent}  type: ${flowYamlInlineStringValue(normalizedType)}`)
    lines.push(`${indent}  value: |`)
    for (const row of value.split('\n')) lines.push(`${indent}    ${row}`)
    return
  }
  lines.push(
    `${indent}${yamlKey}: {key: ${flowYamlInlineStringValue(String(key || '').trim() || key)}, type: ${flowYamlInlineStringValue(normalizedType)}, value: ${flowYamlInlineValue(value)}}`,
  )
}

function readFlowHandlesFromNode(node: GraphNode): Record<string, unknown> | null {
  const props = (node.properties || {}) as Record<string, unknown>
  const explicit = props[FRONTMATTER_HANDLES_PROPERTY_KEY]
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) {
    return explicit as Record<string, unknown>
  }
  const rawPortTypes = props[FLOW_PORT_TYPES_PROPERTY_KEY]
  if (!rawPortTypes || typeof rawPortTypes !== 'object' || Array.isArray(rawPortTypes)) return null
  const portTypes = rawPortTypes as Record<string, unknown>
  const target = portTypes.in && typeof portTypes.in === 'object' && !Array.isArray(portTypes.in)
    ? Object.keys(portTypes.in as Record<string, unknown>).filter(Boolean)
    : []
  const source = portTypes.out && typeof portTypes.out === 'object' && !Array.isArray(portTypes.out)
    ? Object.keys(portTypes.out as Record<string, unknown>).filter(Boolean)
    : []
  const out: Record<string, unknown> = {}
  if (target.length > 0) out.target = target
  if (source.length > 0) out.source = source
  return Object.keys(out).length > 0 ? out : null
}

function buildFrontmatterFlowBlockLines(graphData: GraphData): string[] {
  const lines: string[] = ['flow:']
  const meta = (graphData.metadata || {}) as Record<string, unknown>
  const settings = meta.frontmatterFlowSettings && typeof meta.frontmatterFlowSettings === 'object' && !Array.isArray(meta.frontmatterFlowSettings)
    ? (meta.frontmatterFlowSettings as Record<string, unknown>)
    : null
  if (settings) {
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'direction', settings.direction, 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'edgeType', settings.edgeType, 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'computed', settings.computed, 'boolean')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'snapToGrid', settings.snapToGrid, 'boolean')
    appendFlowYamlEnvelopeFieldLines(lines, '  ', 'gridSize', settings.gridSize, 'number')
  }
  lines.push('  nodes:')
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (const node of nodes) {
    appendFlowYamlEnvelopeFieldLines(lines, '    - ', 'id', String(node.id || ''), 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '      ', 'type', String(node.type || 'Node'), 'string')
    appendFlowYamlEnvelopeFieldLines(lines, '      ', 'label', String(node.label || node.id || ''), 'string')
    const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (x != null || y != null) {
      const position: Record<string, number> = {}
      if (x != null) position.x = x
      if (y != null) position.y = y
      appendFlowYamlEnvelopeFieldLines(lines, '      ', 'position', position, 'object')
    }
    const handles = readFlowHandlesFromNode(node)
    if (handles) appendFlowYamlEnvelopeFieldLines(lines, '      ', 'handles', handles, 'object')
    const props = (node.properties || {}) as Record<string, unknown>
    const propEntries = Object.entries(props)
      .filter(([key, value]) => {
        if (typeof value === 'undefined') return false
        if (key === FRONTMATTER_HANDLES_PROPERTY_KEY) return false
        if (key === FRONTMATTER_WIDGET_FIELDS_PROPERTY_KEY) return false
        if (key === FLOW_COMPUTE_PROPERTY_KEY) return false
        return true
      })
      .sort(([a], [b]) => a.localeCompare(b))
    for (const [key, value] of propEntries) {
      appendFlowYamlEnvelopeFieldLines(lines, '      ', key, value, readFrontmatterFlowFieldType(node, key, value))
    }
    const compute = typeof props[FLOW_COMPUTE_PROPERTY_KEY] === 'string' ? String(props[FLOW_COMPUTE_PROPERTY_KEY] || '') : ''
    if (compute.trim()) appendFlowYamlEnvelopeFieldLines(lines, '      ', 'compute', compute, 'string')
  }
  lines.push('  edges:')
  const edges = Array.isArray(graphData.edges) ? graphData.edges : []
  for (const edge of edges) {
    const props = (edge.properties || {}) as Record<string, unknown>
    const source = String(edge.source || '').trim()
    const target = String(edge.target || '').trim()
    const sourceHandle = String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
    const targetHandle = String(props[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
    const row: Record<string, unknown> = {
      id: String(edge.id || ''),
      source,
      ...(sourceHandle ? { sourceHandle } : {}),
      target,
      ...(targetHandle ? { targetHandle } : {}),
    }
    const label = String(edge.label || '').trim()
    if (label) row.label = label
    if (typeof props.animated === 'boolean') row.animated = props.animated
    const socketType = String(props['flow:socketType'] || '').trim()
    if (socketType) row.type = socketType
    lines.push(`    - ${flowYamlInlineValue(row)}`)
  }
  return lines
}

function upsertFrontmatterFlowMarkdownText(rawText: string, graphData: GraphData): string {
  const text = String(rawText || '')
  const flowLines = buildFrontmatterFlowBlockLines(graphData)
  const block = extractYamlFrontmatterBlock(text)
  if (!block) {
    const prefix = ['---', ...flowLines, '---', ''].join('\n')
    return text ? `${prefix}\n${text}` : `${prefix}\n`
  }
  const yamlLines = String(block.yamlText || '').split('\n')
  let start = -1
  let end = yamlLines.length
  for (let i = 0; i < yamlLines.length; i += 1) {
    const trimmed = String(yamlLines[i] || '').trim()
    if (/^flow\s*:\s*$/.test(trimmed)) {
      start = i
      break
    }
  }
  if (start >= 0) {
    end = yamlLines.length
    for (let i = start + 1; i < yamlLines.length; i += 1) {
      const rawLine = String(yamlLines[i] || '')
      const trimmed = rawLine.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const indent = rawLine.match(/^\s*/)?.[0]?.length || 0
      if (indent === 0 && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
        end = i
        break
      }
    }
  }
  const nextYamlLines = start >= 0
    ? [...yamlLines.slice(0, start), ...flowLines, ...yamlLines.slice(end)]
    : [...yamlLines.filter((line, index, arr) => !(arr.length === 1 && line.trim() === '')), ...flowLines]
  const nextYaml = nextYamlLines.filter((line, index, arr) => !(arr.length > 1 && index === 0 && line === '')).join('\n')
  const suffix = text.slice(block.rawBlock.length)
  return `---\n${nextYaml}\n---${suffix}`
}

function sourceFileShouldWriteFrontmatterFlow(file: GraphState['sourceFiles'][number]): boolean {
  const name = String(file?.name || '').trim()
  const path = String(file?.source?.path || '').trim()
  return isMarkdownLikeFileName(name) || isMarkdownLikeFileName(path)
}

function isActiveMarkdownSourceFile(state: GraphState, file: GraphState['sourceFiles'][number]): boolean {
  const explorerActivePath = normalizeComposedSourcePath(useMarkdownExplorerStore.getState().activePath)
  const activeDocPath = normalizeComposedSourcePath(state.markdownDocumentName) || explorerActivePath
  if (!activeDocPath) return false
  const sourcePath = normalizeComposedSourcePath(file?.source?.path || file?.name || '')
  return !!sourcePath && sourcePath === activeDocPath
}

function findSourceFileForMarkdownDocument(state: GraphState, name: string): GraphState['sourceFiles'][number] | null {
  const sourceFiles = Array.isArray(state.sourceFiles) ? state.sourceFiles : []
  if (sourceFiles.length === 0) return null
  const explorerActivePath = normalizeComposedSourcePath(useMarkdownExplorerStore.getState().activePath)
  const activeDocPath = normalizeComposedSourcePath(state.markdownDocumentName) || explorerActivePath || normalizeComposedSourcePath(name)
  if (activeDocPath) {
    const byPath = sourceFiles.find(file => {
      const sourcePath = normalizeComposedSourcePath(file?.source?.path || file?.name || '')
      return !!sourcePath && sourcePath === activeDocPath
    })
    if (byPath) return byPath
  }
  const trimmedName = String(name || '').trim()
  if (!trimmedName) return null
  return sourceFiles.find(file => String(file?.name || '').trim() === trimmedName) || null
}

function writeWorkspaceSourceTextIfPresent(file: GraphState['sourceFiles'][number], text: string): void {
  const workspacePath = normalizeComposedSourcePath(file?.source?.path || '')
  if (!workspacePath) return
  void getWorkspaceFs()
    .then(fs => fs.writeFileText(workspacePath as any, text))
    .catch(() => void 0)
}

function syncSourceFileTextFromParsedGraph(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
  fileIndex: number
  parsedGraphData: GraphData
}): { sourceFiles: GraphState['sourceFiles']; markdownDocumentText?: string | null } {
  const file = args.sourceFiles[args.fileIndex]
  if (!file || !sourceFileShouldWriteFrontmatterFlow(file)) return { sourceFiles: args.sourceFiles }
  const nextText = upsertFrontmatterFlowMarkdownText(String(file.text || ''), args.parsedGraphData)
  if (nextText === String(file.text || '')) return { sourceFiles: args.sourceFiles }
  const nextSourceFiles = args.sourceFiles.slice()
  nextSourceFiles[args.fileIndex] = {
    ...file,
    text: nextText,
    parsedTextHash: '',
  }
  return {
    sourceFiles: nextSourceFiles,
    ...(isActiveMarkdownSourceFile(args.state, file) ? { markdownDocumentText: nextText } : {}),
  }
}

export const createGraphDataSlice = (set: SetGraph, get: GetGraph) => ({
  graphData: null as GraphData | null,
  graphDataRevision: 0,
  graphContentRevision: 0,
  docLocationRevision: 0,
  markdownDocumentName: null as string | null,
  markdownDocumentText: null as string | null,
  markdownTokens: null as import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[] | null,
  markdownTokensPath: null as string | null,
  markdownTokensKey: null as string | null,
  markdownTokensMeta: null as import('@/lib/markdown').MarkdownFrontmatter | null,
  markdownTokensStartLineOffset: null as number | null,
  markdownDocumentSourceUrl: null as string | null,
  jsonSourceDocumentText: null as string | null,
  markdownPreviewMermaidFocusCode: null as string | null,
  markdownPreviewMermaidFocusConfig: null as Record<string, unknown> | null,
  markdownPreviewActiveMediaKey: null as string | null,
  graphRagWorkflowJsonText: null as string | null,
  lastTraversalSummary: null as TraversalSummary | null,

  resyncGraphFieldsFromGraphData: () => {
    const current = get().graphData
    if (!current) return
    try {
      syncGraphFieldsWithGraphData(get, current)
    } catch {
      void 0
    }
  },

  setMarkdownDocument: (name: string | null, text: string | null, opts?: { autoEnableFrontmatter?: boolean }) => {
    const nextText = String(text || '')
    const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
    const shouldAutoEnableFrontmatter = opts?.autoEnableFrontmatter !== false
    const state = get()
    const needsAutoEnable = shouldAutoEnableFrontmatter && hasFrontmatterMermaid && !(state.frontmatterModeEnabled || false)
    if (!needsAutoEnable && state.markdownDocumentName === name && state.markdownDocumentText === text) return
    set({
      markdownDocumentName: name,
      markdownDocumentText: text,
      markdownTokens: null, // Invalidate tokens
      markdownTokensPath: null,
      markdownTokensKey: null,
      markdownTokensMeta: null,
      markdownTokensStartLineOffset: null,
      ...(shouldAutoEnableFrontmatter && hasFrontmatterMermaid ? { frontmatterModeEnabled: true } : {}),
    })
  },

  setActiveMarkdownDocument: async (args: {
    name: string
    text: string
    sourceUrl?: string | null
    jsonSourceText?: string | null
    autoEnableFrontmatter?: boolean
    workspaceViewMode?: GraphState['workspaceViewMode'] | null
    recent?: Omit<import('@/hooks/store/types').RecentFileEntry, 'id' | 'timestamp'> | null
    applyToGraph?: boolean
    forceApplyToGraph?: boolean
    normalizeMermaidMmd?: boolean
  }): Promise<boolean> => {
    const name = String(args?.name || '').trim()
    if (!name) return false
    const rawText = String(args?.text || '')
    const text = args?.normalizeMermaidMmd === false ? rawText : normalizeMermaidMmdToMarkdown(name, rawText)

    get().setMarkdownDocument(name, text, { autoEnableFrontmatter: args?.autoEnableFrontmatter })

    if ('sourceUrl' in (args as Record<string, unknown>)) {
      get().setMarkdownDocumentSourceUrl(typeof args.sourceUrl === 'string' ? args.sourceUrl : null)
    }
    if ('jsonSourceText' in (args as Record<string, unknown>)) {
      const nextJson = typeof args.jsonSourceText === 'string' ? args.jsonSourceText : null
      get().setJsonSourceDocument(name, nextJson)
    }
    const viewMode = args?.workspaceViewMode ?? null
    if (viewMode === 'canvas' || viewMode === 'editor') {
      try {
        get().setWorkspaceViewMode(viewMode)
      } catch {
        void 0
      }
    }
    const recent = args?.recent ?? null
    if (recent) {
      try {
        get().addRecentFile(recent)
      } catch {
        void 0
      }
    }

    if (args?.applyToGraph) {
      try {
        return await get().applyMarkdownDocumentToGraph(name, text, { force: args?.forceApplyToGraph !== false })
      } catch {
        return false
      }
    }
    return true
  },

  applyMarkdownDocumentToGraph: async (name: string, text: string, opts?: { force?: boolean }) => {
    const nextName = String(name || '').trim()
    const nextText = String(text || '')
    if (!nextName || !nextText.trim()) return false

    const lower = nextName.toLowerCase()
    const isMarkdown = isMarkdownLikeFileName(lower)
    if (!isMarkdown) return false

    const state = get()
    const shouldApply = (() => {
      if (opts?.force) return true
      if ((state.documentSemanticMode || 'document') !== 'document') return false

      if (state.frontmatterModeEnabled || false) {
        const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
        if (hasFrontmatterMermaid) return true
      }

      return true
    })()

    if (!shouldApply) return false

    const exactSourceFile = findSourceFileForMarkdownDocument(state, nextName)
    if (exactSourceFile) {
      const nextSourceText = nextText
      if (
        String(exactSourceFile.text || '') !== nextSourceText ||
        exactSourceFile.status === 'error'
      ) {
        get().updateSourceFile(exactSourceFile.id, {
          text: nextSourceText,
          status: 'idle',
          error: undefined,
        })
      }
      const mod = (await import('@/features/source-files/sourceFilesIngestIntegration')) as typeof import('@/features/source-files/sourceFilesIngestIntegration')
      await mod.parseAndApplySourceFile(exactSourceFile.id)
      const latest = get().sourceFiles.find(file => file.id === exactSourceFile.id) || null
      const parsedGraph = latest?.parsedGraphData || null
      return !!(parsedGraph && ((parsedGraph.nodes || []).length > 0 || (parsedGraph.edges || []).length > 0))
    }

    const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
    const res = await loadGraphDataFromTextViaParser(nextName, nextText, { applyToStore: true, syncMarkdownDocument: false })
    return !!(res?.graphData && ((res.graphData.nodes || []).length > 0 || (res.graphData.edges || []).length > 0))
  },

  setMarkdownTokens: (args: {
    tokens: import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[] | null
    path?: string | null
    key?: string | null
    meta?: import('@/lib/markdown').MarkdownFrontmatter | null
    startLineOffset?: number | null
  }) => {
    set(state => {
      const nextPath = args.path ?? null
      const nextKey = args.key ?? null
      const nextMeta = args.meta ?? null
      const nextOffset = args.startLineOffset ?? null
      if (
        state.markdownTokens === args.tokens &&
        state.markdownTokensPath === nextPath &&
        state.markdownTokensKey === nextKey &&
        state.markdownTokensMeta === nextMeta &&
        state.markdownTokensStartLineOffset === nextOffset
      ) {
        return state
      }
      return {
        markdownTokens: args.tokens,
        markdownTokensPath: nextPath,
        markdownTokensKey: nextKey,
        markdownTokensMeta: nextMeta,
        markdownTokensStartLineOffset: nextOffset,
      }
    })
  },

  setJsonSourceDocument: (name: string | null, text: string | null) => {
    const trimmed = typeof text === 'string' ? text.trim() : ''
    const nextText = trimmed ? text : null
    set(state => ({
      ...state,
      jsonSourceDocumentText: nextText,
    }))
  },

  setMarkdownPreviewMermaidFocus: (
    focus: { code: string; frontmatterConfig: Record<string, unknown> | null } | null,
  ) => {
    if (!focus) {
      set({
        markdownPreviewMermaidFocusCode: null,
        markdownPreviewMermaidFocusConfig: null,
      })
      return
    }
    const nextCode = typeof focus.code === 'string' ? focus.code : ''
    const cfg = focus.frontmatterConfig
    const nextConfig =
      cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null
    set({
      markdownPreviewMermaidFocusCode: nextCode,
      markdownPreviewMermaidFocusConfig: nextConfig,
    })
  },

  setMarkdownPreviewActiveMediaKey: (key: string | null) => {
    const nextKey = typeof key === 'string' ? key.trim() : ''
    set({
      markdownPreviewActiveMediaKey: nextKey ? nextKey : null,
    })
  },

  setMarkdownDocumentSourceUrl: (url: string | null) => {
    set({ markdownDocumentSourceUrl: url })
  },

  setGraphRagWorkflowJsonText: (text: string | null) => {
    const nextText = typeof text === 'string' ? text : null
    set({ graphRagWorkflowJsonText: nextText })
    const graphData = get().graphData
    if (!graphData) return

    const nextMetadata = { ...(graphData.metadata || {}) } as Record<string, JSONValue>
    const trimmed = typeof nextText === 'string' ? nextText.trim() : ''
    if (!trimmed) {
      if ('graphRagWorkflowJsonText' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonText
      if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
    } else {
      nextMetadata.graphRagWorkflowJsonText = nextText as unknown as JSONValue
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (isJsonValue(parsed) && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const t = (parsed as Record<string, unknown>)['@type']
          if (t === 'rag:GraphRAGWorkflow' || t === 'GraphRAGWorkflow') {
            nextMetadata.graphRagWorkflowJsonLd = parsed as JSONValue
          } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
            delete nextMetadata.graphRagWorkflowJsonLd
          }
        } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
          delete nextMetadata.graphRagWorkflowJsonLd
        }
      } catch {
        if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
      }
    }

    const nextGraphDataBase: GraphData = {
      ...graphData,
      metadata: nextMetadata,
    }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision })
    try {
      persistGraphDataToLocalStorage(nextGraphData)
    } catch {
      void 0
    }
    try {
      get().scheduleHistory('Update GraphRAG workflow')
    } catch {
      void 0
    }
  },

  setLastTraversalSummary: (summary: TraversalSummary | null) => {
    set({ lastTraversalSummary: summary })
  },

  setGraphData: (graphData: GraphData) => {
    if (graphData === get().graphData) return
    composedPendingPositionWrites = {}
    composedPendingPositionWriteGraphKey = ''
    const normalized = normalizeGraphData(graphData)
    const nodeIds = new Set<string>((normalized.nodes || []).map(n => n.id))
    const filteredEdges = (normalized.edges || []).filter(e => {
      const src = String(e.source || '')
      const tgt = String(e.target || '')
      if (!src || !tgt) return false
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false
      return true
    })
    const nextGraphDataBase = filteredEdges.length === (normalized.edges || []).length ? normalized : { ...normalized, edges: filteredEdges }

    try {
      const current = get().graphData
      const nextHash = hashGraphDataForPreviewSync(nextGraphDataBase)
      const curHash = hashGraphDataForPreviewSync(current)
      if (nextHash && curHash && nextHash === curHash) return
    } catch {
      void 0
    }

    const currentGraph = get().graphData
    const currentGraphKey = buildGraphMetaKeyIgnoringPending(currentGraph)
    const collapsedKey = buildGraphMetaKeyIgnoringPending(nextGraphDataBase)
    const carryForwardSameSourceUiState =
      !!collapsedKey &&
      !!currentGraphKey &&
      collapsedKey !== currentGraphKey &&
      hasStableSameSourceTopology(currentGraph, nextGraphDataBase)
    const carryForwardSameSourceWidgetOverlayState =
      carryForwardSameSourceUiState &&
      hasStableSameSourceNodeLayout(currentGraph, nextGraphDataBase)
    set(s => {
      const nextRevision = (s.graphDataRevision || 0) + 1
      const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
      const nextContentRev = (s.graphContentRevision || 0) + 1
      const nextDocRev = (s.docLocationRevision || 0) + 1
      const byKey = (s.collapsedGroupIdsByGraphMetaKey || {}) as Record<string, string[]>
      const collapsedKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(byKey, collapsedKey) : false
      const nextCollapsed =
        collapsedKey && carryForwardSameSourceUiState && collapsedKeyMissing
          ? (s.collapsedGroupIds || [])
          : collapsedKey ? (byKey[collapsedKey] || []) : (s.collapsedGroupIds || [])
      const designByKey = (s.designLayerStateByGraphMetaKey || {}) as Record<string, import('@/features/design/designLayersState').DesignLayerState>
      const designKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designByKey, collapsedKey) : false
      const nextDesignLayerState =
        collapsedKey && carryForwardSameSourceUiState && designKeyMissing
          ? cloneDesignLayerState(s.designLayerState)
          : collapsedKey ? (designByKey[collapsedKey] || { order: [], hiddenById: {} }) : s.designLayerState
      const designFramePosByKey = (s.designFramePosByIdByGraphMetaKey || {}) as Record<string, Record<string, { x: number; y: number }>>
      const designFrameSizeByKey = (s.designFrameSizeByIdByGraphMetaKey || {}) as Record<string, Record<string, { w: number; h: number }>>
      const designFramePosKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designFramePosByKey, collapsedKey) : false
      const designFrameSizeKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designFrameSizeByKey, collapsedKey) : false
      const nextDesignFramePos =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFramePosKeyMissing
          ? { ...(s.designFramePosById || {}) }
          : collapsedKey ? (designFramePosByKey[collapsedKey] || {}) : s.designFramePosById
      const nextDesignFrameSize =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFrameSizeKeyMissing
          ? { ...(s.designFrameSizeById || {}) }
          : collapsedKey ? (designFrameSizeByKey[collapsedKey] || {}) : s.designFrameSizeById
      const pinnedByKey = (s.flowWidgetPinnedByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, boolean>>
      const posByKey = (s.flowWidgetPosByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, { top: number; left: number }>>
      const worldByKey = (s.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, { x: number; y: number }>>
      const pinnedKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(pinnedByKey, collapsedKey) : false
      const posKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(posByKey, collapsedKey) : false
      const worldKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(worldByKey, collapsedKey) : false
      const nextPinned =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && pinnedKeyMissing
          ? { ...(s.flowWidgetPinnedByNodeId || {}) }
          : collapsedKey ? (pinnedByKey[collapsedKey] || {}) : s.flowWidgetPinnedByNodeId
      const nextPos =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && posKeyMissing
          ? { ...(s.flowWidgetPosByNodeId || {}) }
          : collapsedKey ? (posByKey[collapsedKey] || {}) : s.flowWidgetPosByNodeId
      const nextWorld =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && worldKeyMissing
          ? { ...(s.flowWidgetWorldPosByNodeId || {}) }
          : collapsedKey ? (worldByKey[collapsedKey] || {}) : s.flowWidgetWorldPosByNodeId
      const nextCollapsedByKey =
        collapsedKey && carryForwardSameSourceUiState && collapsedKeyMissing
          ? { ...byKey, [collapsedKey]: nextCollapsed }
          : byKey
      const nextDesignByKey =
        collapsedKey && carryForwardSameSourceUiState && designKeyMissing
          ? { ...designByKey, [collapsedKey]: cloneDesignLayerState(nextDesignLayerState) }
          : designByKey
      const nextDesignFramePosByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFramePosKeyMissing
          ? { ...designFramePosByKey, [collapsedKey]: nextDesignFramePos }
          : designFramePosByKey
      const nextDesignFrameSizeByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFrameSizeKeyMissing
          ? { ...designFrameSizeByKey, [collapsedKey]: nextDesignFrameSize }
          : designFrameSizeByKey
      const nextPinnedByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && pinnedKeyMissing
          ? { ...pinnedByKey, [collapsedKey]: nextPinned }
          : pinnedByKey
      const nextPosByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && posKeyMissing
          ? { ...posByKey, [collapsedKey]: nextPos }
          : posByKey
      const nextWorldByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && worldKeyMissing
          ? { ...worldByKey, [collapsedKey]: nextWorld }
          : worldByKey
      return {
        graphData: nextGraphData,
        graphDataRevision: nextRevision,
        graphContentRevision: nextContentRev,
        docLocationRevision: nextDocRev,
        graphValidationStatus: null,
        graphValidationTimestamp: null,
        ...(collapsedKey ? { collapsedGroupIds: nextCollapsed } : {}),
        ...(collapsedKey ? { collapsedGroupIdsByGraphMetaKey: nextCollapsedByKey } : {}),
        ...(collapsedKey ? { designLayerState: nextDesignLayerState } : {}),
        ...(collapsedKey ? { designLayerStateByGraphMetaKey: nextDesignByKey } : {}),
        ...(collapsedKey ? { designFramePosById: nextDesignFramePos } : {}),
        ...(collapsedKey ? { designFramePosByIdByGraphMetaKey: nextDesignFramePosByKey } : {}),
        ...(collapsedKey ? { designFrameSizeById: nextDesignFrameSize } : {}),
        ...(collapsedKey ? { designFrameSizeByIdByGraphMetaKey: nextDesignFrameSizeByKey } : {}),
        ...(collapsedKey ? { flowWidgetPinnedByNodeId: nextPinned } : {}),
        ...(collapsedKey ? { flowWidgetPinnedByNodeIdByGraphMetaKey: nextPinnedByKey } : {}),
        ...(collapsedKey ? { flowWidgetPosByNodeId: nextPos } : {}),
        ...(collapsedKey ? { flowWidgetPosByNodeIdByGraphMetaKey: nextPosByKey } : {}),
        ...(collapsedKey ? { flowWidgetWorldPosByNodeId: nextWorld } : {}),
        ...(collapsedKey ? { flowWidgetWorldPosByNodeIdByGraphMetaKey: nextWorldByKey } : {}),
      }
    })
    const stateNow = get()
    const nextGraphData = stateNow.graphData as GraphData

    try {
      applyLayoutAutosuggestFromMetadata(get, nextGraphData.metadata)
    } catch {
      void 0
    }
    try {
      applyWidgetRegistryFromMetadata(get, nextGraphData.metadata, nextGraphData)
    } catch {
      void 0
    }

    try {
      const nextWorkflowText = readGraphRagWorkflowJsonTextFromGraphData(nextGraphData)
      const currentWorkflowText = get().graphRagWorkflowJsonText
      if (nextWorkflowText !== currentWorkflowText) {
        set({ graphRagWorkflowJsonText: nextWorkflowText })
      }
    } catch { void 0 }
    try {
      const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = get()
      const edgeIds = new Set<string>((nextGraphData.edges || []).map(e => e.id))
      const nextSelectedNodeId = selectedNodeId && nodeIds.has(selectedNodeId) ? selectedNodeId : null
      const nextSelectedEdgeId = selectedEdgeId && edgeIds.has(selectedEdgeId) ? selectedEdgeId : null
      const nextSelectedNodeIds = (selectedNodeIds || []).filter(id => nodeIds.has(id))
      const nextSelectedEdgeIds = (selectedEdgeIds || []).filter(id => edgeIds.has(id))
      if (
        nextSelectedNodeId !== selectedNodeId ||
        nextSelectedEdgeId !== selectedEdgeId ||
        nextSelectedNodeIds.length !== (selectedNodeIds || []).length ||
        nextSelectedEdgeIds.length !== (selectedEdgeIds || []).length
      ) {
        set({
          selectedNodeId: nextSelectedNodeId,
          selectedEdgeId: nextSelectedEdgeId,
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: nextSelectedEdgeIds,
        })
      }
    } catch { void 0 }
    try {
      get().setOpenWidgetNodeIds(get().openWidgetNodeIds || [])
    } catch { void 0 }
    set({ lifecycleStage: 'committed' });
    set({ aiKgTraversalRan: false });
    set({ minimapPreview: { nodesPath: '', edgesPath: '', sx: 1, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 } }, minimapAbortController: null });
    get().cancelMinimapWorker?.();
    get().scheduleHistory('Set Data');

    try {
      syncGraphFieldsWithGraphData(get, nextGraphData, { resetVisibleColumns: true })
    } catch {
      void 0
    }

    const runHeavyGraphDataSideEffects = () => {
      const quick = get().computeMinimapPreviewQuick
      if (typeof quick === 'function') quick()
      const async = get().computeMinimapPreviewAsync
      if (typeof async === 'function') async()

      persistGraphDataToLocalStorage(get().graphData)

      try {
        const mode = get().schema.layout?.mode
        if (mode === 'radial') {
          const curRenderer = get().canvas2dRenderer
          if (curRenderer !== 'd3' && curRenderer !== 'd3Bipartite' && !isFlowEditorCanvas2dRenderer(curRenderer)) {
            const setCanvas2dRenderer = get().setCanvas2dRenderer
            if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer('d3')
          }
        }
      } catch {
        void 0
      }
    }

    if (typeof setTimeout === 'function') {
      setTimeout(runHeavyGraphDataSideEffects, 0)
    } else {
      runHeavyGraphDataSideEffects()
    }
  },

  setGraphDataPreservingLayout: (graphData: GraphData) => {
    if (graphData === get().graphData) return
    const normalized = normalizeGraphData(graphData)
    const nodeIds = new Set<string>((normalized.nodes || []).map(n => n.id))
    const filteredEdges = (normalized.edges || []).filter(e => {
      const src = String(e.source || '')
      const tgt = String(e.target || '')
      if (!src || !tgt) return false
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false
      return true
    })
    const nextGraphData =
      filteredEdges.length === (normalized.edges || []).length ? normalized : { ...normalized, edges: filteredEdges }

    try {
      const current = get().graphData
      const nextHash = hashGraphDataForPreviewSync(nextGraphData)
      const curHash = hashGraphDataForPreviewSync(current)
      if (nextHash && curHash && nextHash === curHash) return
    } catch {
      void 0
    }

    const currentGraph = get().graphData
    const currentGraphKey = buildGraphMetaKeyIgnoringPending(currentGraph)
    const collapsedKey = buildGraphMetaKeyIgnoringPending(nextGraphData)
    const carryForwardSameSourceUiState =
      !!collapsedKey &&
      !!currentGraphKey &&
      collapsedKey !== currentGraphKey &&
      hasStableSameSourceTopology(currentGraph, nextGraphData)
    const carryForwardSameSourceWidgetOverlayState =
      carryForwardSameSourceUiState &&
      hasStableSameSourceNodeLayout(currentGraph, nextGraphData)
    set(s => {
      const nextRevision = (s.graphDataRevision || 0) + 1
      const byKey = (s.collapsedGroupIdsByGraphMetaKey || {}) as Record<string, string[]>
      const collapsedKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(byKey, collapsedKey) : false
      const nextCollapsed =
        collapsedKey && carryForwardSameSourceUiState && collapsedKeyMissing
          ? (s.collapsedGroupIds || [])
          : collapsedKey ? (byKey[collapsedKey] || []) : (s.collapsedGroupIds || [])
      const designByKey = (s.designLayerStateByGraphMetaKey || {}) as Record<string, import('@/features/design/designLayersState').DesignLayerState>
      const designKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designByKey, collapsedKey) : false
      const nextDesignLayerState =
        collapsedKey && carryForwardSameSourceUiState && designKeyMissing
          ? cloneDesignLayerState(s.designLayerState)
          : collapsedKey ? (designByKey[collapsedKey] || { order: [], hiddenById: {} }) : s.designLayerState
      const designFramePosByKey = (s.designFramePosByIdByGraphMetaKey || {}) as Record<string, Record<string, { x: number; y: number }>>
      const designFrameSizeByKey = (s.designFrameSizeByIdByGraphMetaKey || {}) as Record<string, Record<string, { w: number; h: number }>>
      const designFramePosKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designFramePosByKey, collapsedKey) : false
      const designFrameSizeKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(designFrameSizeByKey, collapsedKey) : false
      const nextDesignFramePos =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFramePosKeyMissing
          ? { ...(s.designFramePosById || {}) }
          : collapsedKey ? (designFramePosByKey[collapsedKey] || {}) : s.designFramePosById
      const nextDesignFrameSize =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFrameSizeKeyMissing
          ? { ...(s.designFrameSizeById || {}) }
          : collapsedKey ? (designFrameSizeByKey[collapsedKey] || {}) : s.designFrameSizeById
      const pinnedByKey = (s.flowWidgetPinnedByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, boolean>>
      const posByKey = (s.flowWidgetPosByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, { top: number; left: number }>>
      const worldByKey = (s.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}) as Record<string, Record<string, { x: number; y: number }>>
      const pinnedKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(pinnedByKey, collapsedKey) : false
      const posKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(posByKey, collapsedKey) : false
      const worldKeyMissing = collapsedKey ? !Object.prototype.hasOwnProperty.call(worldByKey, collapsedKey) : false
      const nextPinned =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && pinnedKeyMissing
          ? { ...(s.flowWidgetPinnedByNodeId || {}) }
          : collapsedKey ? (pinnedByKey[collapsedKey] || {}) : s.flowWidgetPinnedByNodeId
      const nextPos =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && posKeyMissing
          ? { ...(s.flowWidgetPosByNodeId || {}) }
          : collapsedKey ? (posByKey[collapsedKey] || {}) : s.flowWidgetPosByNodeId
      const nextWorld =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && worldKeyMissing
          ? { ...(s.flowWidgetWorldPosByNodeId || {}) }
          : collapsedKey ? (worldByKey[collapsedKey] || {}) : s.flowWidgetWorldPosByNodeId
      const nextCollapsedByKey =
        collapsedKey && carryForwardSameSourceUiState && collapsedKeyMissing
          ? { ...byKey, [collapsedKey]: nextCollapsed }
          : byKey
      const nextDesignByKey =
        collapsedKey && carryForwardSameSourceUiState && designKeyMissing
          ? { ...designByKey, [collapsedKey]: cloneDesignLayerState(nextDesignLayerState) }
          : designByKey
      const nextDesignFramePosByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFramePosKeyMissing
          ? { ...designFramePosByKey, [collapsedKey]: nextDesignFramePos }
          : designFramePosByKey
      const nextDesignFrameSizeByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && designFrameSizeKeyMissing
          ? { ...designFrameSizeByKey, [collapsedKey]: nextDesignFrameSize }
          : designFrameSizeByKey
      const nextPinnedByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && pinnedKeyMissing
          ? { ...pinnedByKey, [collapsedKey]: nextPinned }
          : pinnedByKey
      const nextPosByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && posKeyMissing
          ? { ...posByKey, [collapsedKey]: nextPos }
          : posByKey
      const nextWorldByKey =
        collapsedKey && carryForwardSameSourceWidgetOverlayState && worldKeyMissing
          ? { ...worldByKey, [collapsedKey]: nextWorld }
          : worldByKey
      return {
        graphData: withGraphDataRevision(nextGraphData, nextRevision),
        graphDataRevision: nextRevision,
        graphValidationStatus: null,
        graphValidationTimestamp: null,
        ...(collapsedKey ? { collapsedGroupIds: nextCollapsed } : {}),
        ...(collapsedKey ? { collapsedGroupIdsByGraphMetaKey: nextCollapsedByKey } : {}),
        ...(collapsedKey ? { designLayerState: nextDesignLayerState } : {}),
        ...(collapsedKey ? { designLayerStateByGraphMetaKey: nextDesignByKey } : {}),
        ...(collapsedKey ? { designFramePosById: nextDesignFramePos } : {}),
        ...(collapsedKey ? { designFramePosByIdByGraphMetaKey: nextDesignFramePosByKey } : {}),
        ...(collapsedKey ? { designFrameSizeById: nextDesignFrameSize } : {}),
        ...(collapsedKey ? { designFrameSizeByIdByGraphMetaKey: nextDesignFrameSizeByKey } : {}),
        ...(collapsedKey ? { flowWidgetPinnedByNodeId: nextPinned } : {}),
        ...(collapsedKey ? { flowWidgetPinnedByNodeIdByGraphMetaKey: nextPinnedByKey } : {}),
        ...(collapsedKey ? { flowWidgetPosByNodeId: nextPos } : {}),
        ...(collapsedKey ? { flowWidgetPosByNodeIdByGraphMetaKey: nextPosByKey } : {}),
        ...(collapsedKey ? { flowWidgetWorldPosByNodeId: nextWorld } : {}),
        ...(collapsedKey ? { flowWidgetWorldPosByNodeIdByGraphMetaKey: nextWorldByKey } : {}),
      }
    })
    const stateNow = get()
    const committed = stateNow.graphData as GraphData

    try {
      const { selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = get()
      const edgeIds = new Set<string>((nextGraphData.edges || []).map(e => e.id))
      const nextSelectedNodeId = selectedNodeId && nodeIds.has(selectedNodeId) ? selectedNodeId : null
      const nextSelectedEdgeId = selectedEdgeId && edgeIds.has(selectedEdgeId) ? selectedEdgeId : null
      const nextSelectedNodeIds = (selectedNodeIds || []).filter(id => nodeIds.has(id))
      const nextSelectedEdgeIds = (selectedEdgeIds || []).filter(id => edgeIds.has(id))
      if (
        nextSelectedNodeId !== selectedNodeId ||
        nextSelectedEdgeId !== selectedEdgeId ||
        nextSelectedNodeIds.length !== (selectedNodeIds || []).length ||
        nextSelectedEdgeIds.length !== (selectedEdgeIds || []).length
      ) {
        set({
          selectedNodeId: nextSelectedNodeId,
          selectedEdgeId: nextSelectedEdgeId,
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: nextSelectedEdgeIds,
        })
      }
    } catch {
      void 0
    }
    try {
      get().setOpenWidgetNodeIds(get().openWidgetNodeIds || [])
    } catch { void 0 }

    try {
      const nextWorkflowText = readGraphRagWorkflowJsonTextFromGraphData(committed)
      const currentWorkflowText = get().graphRagWorkflowJsonText
      if (nextWorkflowText !== currentWorkflowText) {
        set({ graphRagWorkflowJsonText: nextWorkflowText })
      }
    } catch { void 0 }
    try {
      syncGraphFieldsWithGraphData(get, committed)
    } catch { void 0 }
    try {
      applyLayoutAutosuggestFromMetadata(get, committed.metadata)
    } catch { void 0 }
    try {
      applyWidgetRegistryFromMetadata(get, committed.metadata, committed)
    } catch { void 0 }

    set({ lifecycleStage: 'committed' })
    try {
      persistGraphDataToLocalStorage(get().graphData)
    } catch {
      void 0
    }
  },

  clearGraphData: () => {
    composedPendingPositionWrites = {}
    composedPendingPositionWriteGraphKey = ''
    get().cancelMinimapWorker?.();
    set(s => ({
      graphData: null,
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      docLocationRevision: (s.docLocationRevision || 0) + 1,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      openWidgetNodeIds: [],
      aiKgTraversalRan: false,
      layoutPositionCacheByMode: {},
      minimapPreview: { nodesPath: '', edgesPath: '', sx: 1, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 } },
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }));
    set({ graphRagWorkflowJsonText: null })
    set({ lifecycleStage: 'reset' });
    lsRemove(LS_KEYS.graphData)

    try {
      const currentOrder = get().graphDataTableColumnOrder || []
      const nextOrder = currentOrder.filter(k => !isGraphDataTablePropertyColumnKey(k))
      get().setGraphDataTableColumnOrder(nextOrder as GraphDataTableColumnKey[])

      get().setGraphDataTableVisibleColumns(buildDefaultVisibleColumns())

      get().setGraphFieldSettingsById({})
      set({ selectedGraphFieldId: null })
    } catch { void 0 }
  },

  updateNode: (id: string, updates: Partial<GraphNode>) => {
    const { graphData, schema } = get();
    if (!graphData) return;
    if (isComposedGraphData(graphData)) {
      const parsed = parseComposedId(id)
      if (parsed && !Object.prototype.hasOwnProperty.call(updates, 'id')) {
        if (isPureComposedNodePositionUpdate(updates)) {
          const nodes = graphData.nodes.map(n => (n.id === id ? mergeNodeForUpdate(n, updates) : n))
          const nextGraphDataBase = { ...graphData, nodes }
          const nextRevision = (get().graphDataRevision || 0) + 1
          const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
          set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })

          const layerId = parsed.layerId
          const innerId = parsed.innerId
          const keyNow = readComposedPositionWriteGraphKey(graphData)
          if (!composedPendingPositionWriteGraphKey) {
            composedPendingPositionWriteGraphKey = keyNow
          } else if (keyNow && composedPendingPositionWriteGraphKey !== keyNow) {
            composedPendingPositionWrites = {}
            composedPendingPositionWriteGraphKey = keyNow
          }
          const byLayer = composedPendingPositionWrites[layerId] || (composedPendingPositionWrites[layerId] = {})
          byLayer[innerId] = { ...(byLayer[innerId] || {}), ...updates }
          return
        }
        const sourceFiles = get().sourceFiles || []
        const idx = sourceFiles.findIndex(f => String(f.id || '') === parsed.layerId)
        const file = idx >= 0 ? sourceFiles[idx] : null
        const pg = file?.parsedGraphData || null
        if (file && pg && Array.isArray(pg.nodes)) {
          const nextNodes = pg.nodes.map(n => (String(n.id || '') === parsed.innerId ? { ...n, ...updates } : n))
          const nextParsedGraphData = { ...pg, nodes: nextNodes }
          let nextSourceFiles = sourceFiles.slice()
          nextSourceFiles[idx] = {
            ...file,
            parsedGraphData: nextParsedGraphData,
            parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
          }
          const textSync = syncSourceFileTextFromParsedGraph({
            state: get(),
            sourceFiles: nextSourceFiles,
            fileIndex: idx,
            parsedGraphData: nextParsedGraphData,
          })
          nextSourceFiles = textSync.sourceFiles
          const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
          const nextRevision = (get().graphDataRevision || 0) + 1
          const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
          set(s => ({
            sourceFiles: nextSourceFiles,
            graphData: nextGraphData,
            graphDataRevision: nextRevision,
            graphContentRevision: (s.graphContentRevision || 0) + 1,
            ...(Object.prototype.hasOwnProperty.call(updates, 'metadata') ? { docLocationRevision: (s.docLocationRevision || 0) + 1 } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
              ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
              : {}),
            graphValidationStatus: null,
            graphValidationTimestamp: null,
          }))
          if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
            writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
          }
          if (Object.prototype.hasOwnProperty.call(updates, 'properties')) {
            try {
              syncGraphFieldsWithGraphData(get, nextGraphData)
            } catch { void 0 }
          }
          const fields = Object.keys(updates || {}).join(',') || 'none';
          get().scheduleHistory(`Update Node: ${id} [${fields}]`);
          return
        }
      }
    }
    const current = graphData.nodes.find(n => n.id === id);
    const nextNode = current ? mergeNodeForUpdate(current, updates) : null;
    if (!validateNodeProperties(schema, id, nextNode, graphData)) return;
    const nodes = graphData.nodes.map(n => (n.id === id ? mergeNodeForUpdate(n, updates) : n))
    const nextGraphDataBase = { ...graphData, nodes }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    const positionOnly = isPositionOnlyNodeUpdate(updates)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      ...(positionOnly ? {} : { graphContentRevision: (s.graphContentRevision || 0) + 1 }),
      ...(Object.prototype.hasOwnProperty.call(updates, 'metadata') ? { docLocationRevision: (s.docLocationRevision || 0) + 1 } : {}),
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }))
    if (Object.prototype.hasOwnProperty.call(updates, 'properties')) {
      try {
        syncGraphFieldsWithGraphData(get, nextGraphData)
      } catch { void 0 }
    }
    const fields = Object.keys(updates || {}).join(',') || 'none';
    get().scheduleHistory(`Update Node: ${id} [${fields}]`);
  },

  flushComposedPositionWritesNow: () => {
    try {
      flushComposedPositionWritesNow({ set, get })
    } catch {
      void 0
    }
  },

  addNode: (node: GraphNode) => {
    let { graphData, schema } = get();
    if (!graphData) {
      get().setGraphData({ context: '', type: 'Graph', nodes: [], edges: [] })
      ;({ graphData, schema } = get())
    }
    if (!graphData) return
    const tpl = schema.templates?.node?.[node.type] || {};
    const withTpl = { ...node, properties: { ...(node.properties || {}), ...tpl } };
    const parsedId = parseComposedId(withTpl.id)
    const layerId = resolvePreferredComposedLayerId({ get, explicitLayerId: parsedId?.layerId }) || ''
    const innerId = parsedId?.innerId || String(withTpl.id || '').trim()
    if (layerId && innerId) {
      const sourceFiles = get().sourceFiles || []
      const idx = sourceFiles.findIndex(f => String(f.id || '') === layerId)
      const file = idx >= 0 ? sourceFiles[idx] : null
      if (file) {
        const pg = ensureSourceFileGraphData(file)
        const layerNode: GraphNode = { ...withTpl, id: innerId }
        const nextParsedGraphData = { ...pg, nodes: [...pg.nodes, layerNode] }
        let nextSourceFiles = sourceFiles.slice()
        nextSourceFiles[idx] = {
          ...file,
          parsedGraphData: nextParsedGraphData,
          parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
        }
        const textSync = syncSourceFileTextFromParsedGraph({
          state: get(),
          sourceFiles: nextSourceFiles,
          fileIndex: idx,
          parsedGraphData: nextParsedGraphData,
        })
        nextSourceFiles = textSync.sourceFiles
        const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
        const nextRevision = (get().graphDataRevision || 0) + 1
        const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
        set(s => ({
          sourceFiles: nextSourceFiles,
          graphData: nextGraphData,
          graphDataRevision: nextRevision,
          graphContentRevision: (s.graphContentRevision || 0) + 1,
          docLocationRevision: (s.docLocationRevision || 0) + 1,
          ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
          ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
            ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
            : {}),
          graphValidationStatus: null,
          graphValidationTimestamp: null,
        }))
        if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
          writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
        }
        try {
          syncGraphFieldsWithGraphData(get, nextGraphData)
        } catch { void 0 }
        const composedId = `${layerId}::${innerId}`
        const extras = `label=${withTpl.label ?? node.label},type=${node.type}`;
        get().scheduleHistory(`Add Node: ${composedId} [${extras}]`);
        return
      }
    }
    const nodes = [...graphData.nodes, withTpl]
    const nextGraphDataBase = { ...graphData, nodes }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      docLocationRevision: (s.docLocationRevision || 0) + 1,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }))
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    const extras = `label=${withTpl.label ?? node.label},type=${node.type}`;
    get().scheduleHistory(`Add Node: ${withTpl.id} [${extras}]`);
  },

  removeNode: (id: string) => {
    const { graphData } = get();
    if (!graphData) return;
    if (isComposedGraphData(graphData)) {
      const parsed = parseComposedId(id)
      if (parsed) {
        const sourceFiles = get().sourceFiles || []
        const idx = sourceFiles.findIndex(f => String(f.id || '') === parsed.layerId)
        const file = idx >= 0 ? sourceFiles[idx] : null
        const pg = file?.parsedGraphData || null
        if (file && pg && Array.isArray(pg.nodes) && Array.isArray(pg.edges)) {
          const nextNodes = pg.nodes.filter(n => String(n.id || '') !== parsed.innerId)
          const nextEdges = pg.edges.filter(e => String(e.source || '') !== parsed.innerId && String(e.target || '') !== parsed.innerId)
          const nextParsedGraphData =
            nextNodes.length === pg.nodes.length && nextEdges.length === pg.edges.length
              ? pg
              : { ...pg, nodes: nextNodes, edges: nextEdges }
          let nextSourceFiles = sourceFiles.slice()
          nextSourceFiles[idx] = {
            ...file,
            parsedGraphData: nextParsedGraphData,
            parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
          }
          const textSync = syncSourceFileTextFromParsedGraph({
            state: get(),
            sourceFiles: nextSourceFiles,
            fileIndex: idx,
            parsedGraphData: nextParsedGraphData,
          })
          nextSourceFiles = textSync.sourceFiles
          const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
          const nextRevision = (get().graphDataRevision || 0) + 1
          const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
          const state = get()
          const selectedEdgeId = state.selectedEdgeId
          const nextSelectedEdgeId =
            selectedEdgeId && (nextGraphData.edges || []).some(e => String(e.id || '') === selectedEdgeId) ? selectedEdgeId : null
          const nextSelectedNodeIds = (state.selectedNodeIds || []).filter(nodeId => nodeId !== id)
          const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId =>
            (nextGraphData.edges || []).some(e => String(e.id || '') === edgeId),
          )
          set(s => ({
            sourceFiles: nextSourceFiles,
            graphData: nextGraphData,
            graphDataRevision: nextRevision,
            graphContentRevision: (s.graphContentRevision || 0) + 1,
            docLocationRevision: (s.docLocationRevision || 0) + 1,
            selectedNodeId: null,
            selectedEdgeId: nextSelectedEdgeId,
            selectedNodeIds: nextSelectedNodeIds,
            selectedEdgeIds: nextSelectedEdgeIds,
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
              ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
              : {}),
            graphValidationStatus: null,
            graphValidationTimestamp: null,
          }))
          if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
            writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
          }
          try {
            get().updateOpenWidgetNodeIds(prev => prev.filter(nodeId => nodeId !== id))
          } catch { void 0 }
          try {
            syncGraphFieldsWithGraphData(get, nextGraphData)
          } catch { void 0 }
          const removedEdges = (pg.edges || []).filter(e => String(e.source || '') === parsed.innerId || String(e.target || '') === parsed.innerId).length;
          get().scheduleHistory(`Remove Node: ${id} [edges=${removedEdges}]`);
          return
        }
      }
    }
    const nodes = graphData.nodes.filter(n => n.id !== id);
    const edges = graphData.edges.filter(e => e.source !== id && e.target !== id);
    const nextGraphDataBase = { ...graphData, nodes, edges }
    const state = get()
    const selectedEdgeId = state.selectedEdgeId
    const nextSelectedEdgeId = selectedEdgeId && edges.some(e => e.id === selectedEdgeId) ? selectedEdgeId : null
    const nextSelectedNodeIds = (state.selectedNodeIds || []).filter(nodeId => nodeId !== id)
    const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId =>
      edges.some(e => e.id === edgeId),
    )
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      docLocationRevision: (s.docLocationRevision || 0) + 1,
      selectedNodeId: null,
      selectedEdgeId: nextSelectedEdgeId,
      selectedNodeIds: nextSelectedNodeIds,
      selectedEdgeIds: nextSelectedEdgeIds,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }));
    try {
      get().updateOpenWidgetNodeIds(prev => prev.filter(nodeId => nodeId !== id))
    } catch { void 0 }
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    const removedEdges = graphData.edges.filter(e => e.source === id || e.target === id).length;
    get().scheduleHistory(`Remove Node: ${id} [edges=${removedEdges}]`);
  },

  addEdge: (edge: GraphEdge) => {
    let { graphData, schema } = get();
    if (!graphData) {
      get().setGraphData({ context: '', type: 'Graph', nodes: [], edges: [] })
      ;({ graphData, schema } = get())
    }
    if (!graphData) return
    if (isComposedGraphData(graphData)) {
      const srcParsed = parseComposedId(String(edge.source || ''))
      const tgtParsed = parseComposedId(String(edge.target || ''))
      if ((srcParsed && tgtParsed && srcParsed.layerId !== tgtParsed.layerId) || (!srcParsed && !tgtParsed)) {
        const preferredLayerId = resolvePreferredComposedLayerId({ get })
        if (!preferredLayerId) return
      }
      const layerId =
        srcParsed?.layerId || tgtParsed?.layerId || resolvePreferredComposedLayerId({ get }) || ''
      const innerSource = srcParsed?.innerId || String(edge.source || '').trim()
      const innerTarget = tgtParsed?.innerId || String(edge.target || '').trim()
      if (!layerId || !innerSource || !innerTarget) return
      const parsedId = parseComposedId(edge.id)
      const innerId = parsedId?.innerId || String(edge.id || '').trim()
      const viewEdge: GraphEdge = {
        ...edge,
        id: `${layerId}::${innerId}`,
        source: `${layerId}::${innerSource}`,
        target: `${layerId}::${innerTarget}`,
      }
      if (!canAddEdge(schema, graphData, viewEdge)) return
      const tpl = schema.templates?.edge?.[edge.label] || {};
      const withTpl = { ...viewEdge, properties: { ...(edge.properties || {}), ...tpl } };
      const sourceFiles = get().sourceFiles || []
      const idx = sourceFiles.findIndex(f => String(f.id || '') === layerId)
      const file = idx >= 0 ? sourceFiles[idx] : null
      const pg = file?.parsedGraphData || null
      if (!file || !pg || !Array.isArray(pg.edges)) return
      const layerEdge: GraphEdge = {
        ...withTpl,
        id: innerId,
        source: innerSource,
        target: innerTarget,
      }
      const nextParsedGraphData = { ...pg, edges: [...pg.edges, layerEdge] }
      let nextSourceFiles = sourceFiles.slice()
      nextSourceFiles[idx] = {
        ...file,
        parsedGraphData: nextParsedGraphData,
        parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
      }
      const textSync = syncSourceFileTextFromParsedGraph({
        state: get(),
        sourceFiles: nextSourceFiles,
        fileIndex: idx,
        parsedGraphData: nextParsedGraphData,
      })
      nextSourceFiles = textSync.sourceFiles
      const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
      const nextRevision = (get().graphDataRevision || 0) + 1
      const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
      set(s => ({
        sourceFiles: nextSourceFiles,
        graphData: nextGraphData,
        graphDataRevision: nextRevision,
        graphContentRevision: (s.graphContentRevision || 0) + 1,
        docLocationRevision: (s.docLocationRevision || 0) + 1,
        ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
          ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
          : {}),
        graphValidationStatus: null,
        graphValidationTimestamp: null,
      }))
      if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
        writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
      }
      try {
        syncGraphFieldsWithGraphData(get, nextGraphData)
      } catch { void 0 }
      set({ lifecycleStage: 'edgeMutate' });
      const extras = `source=${viewEdge.source},target=${viewEdge.target},label=${viewEdge.label}`;
      get().scheduleHistory(`Add Edge: ${viewEdge.id} [${extras}]`);
      return
    }
    if (!canAddEdge(schema, graphData, edge)) return;
    const tpl = schema.templates?.edge?.[edge.label] || {};
    const withTpl = { ...edge, properties: { ...(edge.properties || {}), ...tpl } };
    const edges = [...graphData.edges, withTpl]
    const nextGraphDataBase = { ...graphData, edges }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      docLocationRevision: (s.docLocationRevision || 0) + 1,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }))
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    set({ lifecycleStage: 'edgeMutate' });
    const extras = `source=${withTpl.source},target=${withTpl.target},label=${withTpl.label}`;
    get().scheduleHistory(`Add Edge: ${withTpl.id} [${extras}]`);
  },

  updateEdge: (id: string, updates: Partial<GraphEdge>) => {
    const { graphData, schema } = get();
    if (!graphData) return;
    if (isComposedGraphData(graphData)) {
      const parsed = parseComposedId(id)
      if (parsed && !Object.prototype.hasOwnProperty.call(updates, 'id')) {
        const srcParsed = Object.prototype.hasOwnProperty.call(updates, 'source') ? parseComposedId(String((updates as any).source || '')) : null
        const tgtParsed = Object.prototype.hasOwnProperty.call(updates, 'target') ? parseComposedId(String((updates as any).target || '')) : null
        if ((srcParsed && srcParsed.layerId !== parsed.layerId) || (tgtParsed && tgtParsed.layerId !== parsed.layerId)) return
        const sourceFiles = get().sourceFiles || []
        const idx = sourceFiles.findIndex(f => String(f.id || '') === parsed.layerId)
        const file = idx >= 0 ? sourceFiles[idx] : null
        const pg = file?.parsedGraphData || null
        if (file && pg && Array.isArray(pg.edges)) {
          const normalizedUpdates: Partial<GraphEdge> = { ...updates }
          if (typeof (normalizedUpdates as any).source === 'string') {
            const v = String((normalizedUpdates as any).source || '').trim()
            ;(normalizedUpdates as any).source = (parseComposedId(v)?.innerId || v)
          }
          if (typeof (normalizedUpdates as any).target === 'string') {
            const v = String((normalizedUpdates as any).target || '').trim()
            ;(normalizedUpdates as any).target = (parseComposedId(v)?.innerId || v)
          }
          const nextEdges = pg.edges.map(e => (String(e.id || '') === parsed.innerId ? { ...e, ...normalizedUpdates } : e))
          const nextParsedGraphData = { ...pg, edges: nextEdges }
          let nextSourceFiles = sourceFiles.slice()
          nextSourceFiles[idx] = {
            ...file,
            parsedGraphData: nextParsedGraphData,
            parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
          }
          const textSync = syncSourceFileTextFromParsedGraph({
            state: get(),
            sourceFiles: nextSourceFiles,
            fileIndex: idx,
            parsedGraphData: nextParsedGraphData,
          })
          nextSourceFiles = textSync.sourceFiles
          const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
          const nextRevision = (get().graphDataRevision || 0) + 1
          const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
          set(s => ({
            sourceFiles: nextSourceFiles,
            graphData: nextGraphData,
            graphDataRevision: nextRevision,
            graphContentRevision: (s.graphContentRevision || 0) + 1,
            ...(Object.prototype.hasOwnProperty.call(updates, 'metadata') ? { docLocationRevision: (s.docLocationRevision || 0) + 1 } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
              ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
              : {}),
            graphValidationStatus: null,
            graphValidationTimestamp: null,
          }))
          if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
            writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
          }
          if (Object.prototype.hasOwnProperty.call(updates, 'properties')) {
            try {
              syncGraphFieldsWithGraphData(get, nextGraphData)
            } catch { void 0 }
          }
          set({ lifecycleStage: 'edgeMutate' });
          const fields = Object.keys(updates || {}).join(',') || 'none';
          get().scheduleHistory(`Update Edge: ${id} [${fields}]`);
          return
        }
      }
    }
    const current = graphData.edges.find(e => e.id === id);
    const normalizedUpdates: Partial<GraphEdge> = { ...updates }
    if (typeof normalizedUpdates.source === 'string') normalizedUpdates.source = normalizedUpdates.source.trim()
    if (typeof normalizedUpdates.target === 'string') normalizedUpdates.target = normalizedUpdates.target.trim()
    const nextEdge = current ? { ...current, ...normalizedUpdates } : null;
    if (!validateEdgeProperties(schema, id, nextEdge)) return;
    if (nextEdge && (
      Object.prototype.hasOwnProperty.call(normalizedUpdates, 'source') ||
      Object.prototype.hasOwnProperty.call(normalizedUpdates, 'target') ||
      Object.prototype.hasOwnProperty.call(normalizedUpdates, 'label')
    )) {
      const dataWithoutEdge = { ...graphData, edges: graphData.edges.filter(e => e.id !== id) }
      if (!canAddEdge(schema, dataWithoutEdge, nextEdge)) return
    }
    const edges = graphData.edges.map(e => (e.id === id ? { ...e, ...normalizedUpdates } : e))
    const nextGraphDataBase = { ...graphData, edges }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      ...(Object.prototype.hasOwnProperty.call(updates, 'metadata') ? { docLocationRevision: (s.docLocationRevision || 0) + 1 } : {}),
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }))
    if (Object.prototype.hasOwnProperty.call(updates, 'properties')) {
      try {
        syncGraphFieldsWithGraphData(get, nextGraphData)
      } catch { void 0 }
    }
    set({ lifecycleStage: 'edgeMutate' });
    const fields = Object.keys(updates || {}).join(',') || 'none';
    get().scheduleHistory(`Update Edge: ${id} [${fields}]`);
  },

  removeEdge: (id: string) => {
    const { graphData } = get();
    if (!graphData) return;
    if (isComposedGraphData(graphData)) {
      const parsed = parseComposedId(id)
      if (parsed) {
        const sourceFiles = get().sourceFiles || []
        const idx = sourceFiles.findIndex(f => String(f.id || '') === parsed.layerId)
        const file = idx >= 0 ? sourceFiles[idx] : null
        const pg = file?.parsedGraphData || null
        if (file && pg && Array.isArray(pg.edges)) {
          const nextEdges = pg.edges.filter(e => String(e.id || '') !== parsed.innerId)
          const nextParsedGraphData = nextEdges.length === pg.edges.length ? pg : { ...pg, edges: nextEdges }
          let nextSourceFiles = sourceFiles.slice()
          nextSourceFiles[idx] = {
            ...file,
            parsedGraphData: nextParsedGraphData,
            parsedGraphRevision: (file.parsedGraphRevision || 0) + 1,
          }
          const textSync = syncSourceFileTextFromParsedGraph({
            state: get(),
            sourceFiles: nextSourceFiles,
            fileIndex: idx,
            parsedGraphData: nextParsedGraphData,
          })
          nextSourceFiles = textSync.sourceFiles
          const { graphData: recomposed } = composeGraphFromSourceLayers({ layers: buildLayersFromSourceFiles(nextSourceFiles) })
          const nextRevision = (get().graphDataRevision || 0) + 1
          const nextGraphData = withGraphDataRevision(recomposed, nextRevision)
          const state = get()
          const selectedEdgeId = state.selectedEdgeId
          const nextSelectedEdgeId = selectedEdgeId === id ? null : selectedEdgeId
          const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId => edgeId !== id)
          set(s => ({
            sourceFiles: nextSourceFiles,
            graphData: nextGraphData,
            graphDataRevision: nextRevision,
            graphContentRevision: (s.graphContentRevision || 0) + 1,
            docLocationRevision: (s.docLocationRevision || 0) + 1,
            selectedEdgeId: nextSelectedEdgeId,
            selectedEdgeIds: nextSelectedEdgeIds,
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') ? { markdownDocumentText: textSync.markdownDocumentText ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText') && file?.source?.path
              ? { markdownDocumentName: String(file.source.path || '') || s.markdownDocumentName }
              : {}),
            graphValidationStatus: null,
            graphValidationTimestamp: null,
          }))
          if (Object.prototype.hasOwnProperty.call(textSync, 'markdownDocumentText')) {
            writeWorkspaceSourceTextIfPresent(nextSourceFiles[idx], textSync.markdownDocumentText ?? '')
          }
          try {
            syncGraphFieldsWithGraphData(get, nextGraphData)
          } catch { void 0 }
          set({ lifecycleStage: 'edgeMutate' });
          get().scheduleHistory(`Remove Edge: ${id}`);
          return
        }
      }
    }
    const edges = graphData.edges.filter(e => e.id !== id);
    const nextGraphDataBase = { ...graphData, edges }
    const state = get()
    const selectedEdgeId = state.selectedEdgeId
    const nextSelectedEdgeId = selectedEdgeId === id ? null : selectedEdgeId
    const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId => edgeId !== id)
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      graphContentRevision: (s.graphContentRevision || 0) + 1,
      docLocationRevision: (s.docLocationRevision || 0) + 1,
      selectedEdgeId: nextSelectedEdgeId,
      selectedEdgeIds: nextSelectedEdgeIds,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    }));
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    set({ lifecycleStage: 'edgeMutate' });
    get().scheduleHistory(`Remove Edge: ${id}`);
  },

  createUserSubgraph: (
    args: { label?: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' },
  ): { ok: true; id: string } | { ok: false; message: string } => {
    let { graphData } = get()
    if (!graphData) {
      get().setGraphData({ context: '', type: 'Graph', nodes: [], edges: [] } as never)
      ;({ graphData } = get())
    }
    if (!graphData) return { ok: false, message: 'No graph loaded.' }

    const nodeIdSet = new Set<string>((graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
    const memberNodeIds = Array.from(new Set((args.memberNodeIds || []).map(v => String(v || '').trim()).filter(Boolean))).filter(id => nodeIdSet.has(id))
    if (memberNodeIds.length === 0) return { ok: false, message: 'Select at least one node.' }

    const existing = readSubgraphs(graphData)
    const existingIdSet = new Set(existing.map(sg => sg.id))
    const rawParent = args.parentId == null ? null : String(args.parentId || '').trim() || null
    const parentId = rawParent && existingIdSet.has(rawParent) ? rawParent : null

    const { subgraph, graphData: nextGraphDataBase } = createSubgraph(graphData, {
      nodeIds: memberNodeIds,
      label: args.label,
      parentId,
      kind: args.kind === 'cluster' ? 'cluster' : 'subgraph',
    })
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
    set({ lifecycleStage: 'committed' })
    try {
      const nextWorkflowText = readGraphRagWorkflowJsonTextFromGraphData(nextGraphData)
      const currentWorkflowText = get().graphRagWorkflowJsonText
      if (nextWorkflowText !== currentWorkflowText) set({ graphRagWorkflowJsonText: nextWorkflowText })
    } catch { void 0 }
    try {
      applyLayoutAutosuggestFromMetadata(get, nextGraphData.metadata)
    } catch { void 0 }
    try {
      applyWidgetRegistryFromMetadata(get, nextGraphData.metadata, nextGraphData)
    } catch { void 0 }
    try {
      persistGraphDataToLocalStorage(nextGraphData)
    } catch {
      void 0
    }
    get().scheduleHistory(`Create Subgraph: ${subgraph.id} [nodes=${memberNodeIds.length}]`)
    return { ok: true, id: subgraph.id }
  },

  updateUserSubgraph: (
    rawId: string,
    patch: { label?: string; memberNodeIds?: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' },
  ): { ok: true } | { ok: false; message: string } => {
    const id = String(rawId || '').trim()
    if (!id) return { ok: false, message: 'Missing subgraph id.' }
    const { graphData } = get()
    if (!graphData) return { ok: false, message: 'No graph loaded.' }

    const current = readSubgraphs(graphData)
    const exists = current.find(sg => sg.id === id) || null
    if (!exists) return { ok: false, message: 'Subgraph not found.' }

    const nodeIdSet = new Set<string>((graphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
    const nextMemberNodeIds = patch.memberNodeIds
      ? Array.from(new Set((patch.memberNodeIds || []).map(v => String(v || '').trim()).filter(Boolean))).filter(nid => nodeIdSet.has(nid))
      : undefined

    const rawParent = patch.parentId === undefined ? undefined : patch.parentId == null ? null : String(patch.parentId || '').trim() || null
    const parentId = rawParent === undefined ? undefined : rawParent

    if (parentId != null) {
      if (parentId === id) return { ok: false, message: 'A subgraph cannot be its own parent.' }
      const sgById = new Map(current.map(sg => [sg.id, sg] as const))
      if (!sgById.has(parentId)) return { ok: false, message: 'Parent subgraph not found.' }
      let cur: string | null = parentId
      for (let i = 0; i < 200 && cur; i += 1) {
        if (cur === id) return { ok: false, message: 'Parent assignment would create a cycle.' }
        cur = sgById.get(cur)?.parentId ?? null
      }
    }

    const nextGraphDataBase = updateSubgraphInGraphData(graphData, id, {
      ...(patch.label != null ? { label: patch.label } : {}),
      ...(nextMemberNodeIds ? { memberNodeIds: nextMemberNodeIds } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(patch.kind != null ? { kind: patch.kind === 'cluster' ? 'cluster' : 'subgraph' } : {}),
    })
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
    set({ lifecycleStage: 'committed' })
    try {
      const nextWorkflowText = readGraphRagWorkflowJsonTextFromGraphData(nextGraphData)
      const currentWorkflowText = get().graphRagWorkflowJsonText
      if (nextWorkflowText !== currentWorkflowText) set({ graphRagWorkflowJsonText: nextWorkflowText })
    } catch { void 0 }
    try {
      applyLayoutAutosuggestFromMetadata(get, nextGraphData.metadata)
    } catch { void 0 }
    try {
      applyWidgetRegistryFromMetadata(get, nextGraphData.metadata, nextGraphData)
    } catch { void 0 }
    try {
      persistGraphDataToLocalStorage(nextGraphData)
    } catch {
      void 0
    }
    get().scheduleHistory(`Update Subgraph: ${id}`)
    return { ok: true }
  },

  addNodesToUserSubgraph: (rawId: string, rawNodeIds: string[]): { ok: true } | { ok: false; message: string } => {
    const id = String(rawId || '').trim()
    if (!id) return { ok: false, message: 'Missing subgraph id.' }
    const { graphData } = get()
    if (!graphData) return { ok: false, message: 'No graph loaded.' }
    const current = readSubgraphs(graphData)
    const sg = current.find(s => s.id === id) || null
    if (!sg) return { ok: false, message: 'Subgraph not found.' }
    const merged = Array.from(new Set([...(sg.memberNodeIds || []), ...(rawNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)]))
    return get().updateUserSubgraph(id, { memberNodeIds: merged })
  },

  removeNodesFromUserSubgraph: (rawId: string, rawNodeIds: string[]): { ok: true } | { ok: false; message: string } => {
    const id = String(rawId || '').trim()
    if (!id) return { ok: false, message: 'Missing subgraph id.' }
    const { graphData } = get()
    if (!graphData) return { ok: false, message: 'No graph loaded.' }
    const current = readSubgraphs(graphData)
    const sg = current.find(s => s.id === id) || null
    if (!sg) return { ok: false, message: 'Subgraph not found.' }
    const removeSet = new Set((rawNodeIds || []).map(v => String(v || '').trim()).filter(Boolean))
    const filtered = (sg.memberNodeIds || []).filter(nid => !removeSet.has(nid))
    return get().updateUserSubgraph(id, { memberNodeIds: filtered })
  },

  removeUserSubgraph: (rawId: string) => {
    const id = String(rawId || '').trim()
    if (!id) return
    const { graphData } = get()
    if (!graphData) return

    const nextGraphDataBase = removeSubgraphFromGraphData(graphData, id)
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)

    const gid = subgraphGroupId(id)
    const state = get()
    const nextCollapsed = gid ? (state.collapsedGroupIds || []).filter(x => x !== gid) : (state.collapsedGroupIds || [])
    const nextSelectedGroupId = state.selectedGroupId === gid ? null : state.selectedGroupId
    const nextSelectedGroupIds = (state.selectedGroupIds || []).filter(x => x !== gid)

    set({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      collapsedGroupIds: nextCollapsed,
      selectedGroupId: nextSelectedGroupId,
      selectedGroupIds: nextSelectedGroupIds,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    })
    set({ lifecycleStage: 'committed' })
    try {
      const nextWorkflowText = readGraphRagWorkflowJsonTextFromGraphData(nextGraphData)
      const currentWorkflowText = get().graphRagWorkflowJsonText
      if (nextWorkflowText !== currentWorkflowText) set({ graphRagWorkflowJsonText: nextWorkflowText })
    } catch { void 0 }
    try {
      applyLayoutAutosuggestFromMetadata(get, nextGraphData.metadata)
    } catch { void 0 }
    try {
      applyWidgetRegistryFromMetadata(get, nextGraphData.metadata, nextGraphData)
    } catch { void 0 }
    try {
      persistGraphDataToLocalStorage(nextGraphData)
    } catch {
      void 0
    }
    get().scheduleHistory(`Remove Subgraph: ${id}`)
  },
});
