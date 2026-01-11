import { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types';
import { validateNodeProperties, validateEdgeProperties, canAddEdge } from '@/features/schema/validation';
import type { GraphSchema } from '@/lib/graph/schema'
import type { StoreApi } from 'zustand';
import type { GraphState } from '@/hooks/useGraphStore'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson, lsRemove } from '@/lib/persistence'
import { computeDerivedFields, parseGraphFieldId } from '@/features/graph-fields/graphFields'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import { isJsonValue } from '@/lib/graph/jsonValue'
import {
  buildDefaultVisibleColumns,
  isGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
} from '@/features/graph-data-table/graphDataTable'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseLayoutMode(raw: unknown): NonNullable<NonNullable<GraphSchema['layout']>['mode']> | null {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return null
  const normalized = text.toLowerCase()
  if (normalized === 'force') return 'force'
  if (normalized === 'radial' || normalized === 'radial-cluster' || normalized === 'cluster') return 'radial'
  if (normalized === 'tidy-tree' || normalized === 'tidytree' || normalized === 'tree' || normalized === 'tidy') return 'tidy-tree'
  return null
}

function parseEdgeLabels(raw: unknown): string[] | null {
  if (typeof raw === 'string') {
    const parts = raw
      .split(/[,;\n]+/g)
      .map(x => x.trim())
      .filter(Boolean)
    const unique = Array.from(new Set(parts))
    return unique.length > 0 ? unique : null
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map(x => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
    const unique = Array.from(new Set(parts))
    return unique.length > 0 ? unique : null
  }
  return null
}

function parseTidyTreeMetadata(raw: unknown): Partial<NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>> | null {
  if (!isRecord(raw)) return null
  const out: Partial<NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>> = {}
  if ('edgeLabels' in raw) {
    const parsed = parseEdgeLabels(raw.edgeLabels)
    if (parsed) out.edgeLabels = parsed
  }
  if ('direction' in raw) {
    const dir = typeof raw.direction === 'string' ? raw.direction.trim() : ''
    if (dir === 'auto' || dir === 'source-target' || dir === 'target-source') out.direction = dir
  }
  if ('orientation' in raw) {
    const ori = typeof raw.orientation === 'string' ? raw.orientation.trim() : ''
    if (ori === 'horizontal' || ori === 'vertical') out.orientation = ori
  }
  if ('nodeSize' in raw && isRecord(raw.nodeSize)) {
    const x = typeof raw.nodeSize.x === 'number' && Number.isFinite(raw.nodeSize.x) ? raw.nodeSize.x : undefined
    const y = typeof raw.nodeSize.y === 'number' && Number.isFinite(raw.nodeSize.y) ? raw.nodeSize.y : undefined
    if (x != null || y != null) out.nodeSize = { x, y }
  }
  if ('separation' in raw) {
    const sep = typeof raw.separation === 'number' && Number.isFinite(raw.separation) ? raw.separation : undefined
    if (sep != null) out.separation = sep
  }
  if ('sortBy' in raw) {
    const s = typeof raw.sortBy === 'string' ? raw.sortBy.trim() : ''
    if (s === 'none' || s === 'label' || s === 'id' || s === 'type') out.sortBy = s
  }
  if ('curve' in raw) {
    const c = typeof raw.curve === 'string' ? raw.curve.trim() : ''
    if (c === 'bump' || c === 'linear' || c === 'step') out.curve = c
  }
  if ('colorMode' in raw) {
    const cm = typeof raw.colorMode === 'string' ? raw.colorMode.trim() : ''
    if (cm === 'observable' || cm === 'schema') out.colorMode = cm
  }
  if ('stroke' in raw && typeof raw.stroke === 'string' && raw.stroke.trim()) {
    out.linkStroke = raw.stroke.trim()
  } else if ('linkStroke' in raw && typeof raw.linkStroke === 'string' && raw.linkStroke.trim()) {
    out.linkStroke = raw.linkStroke.trim()
  }
  if ('strokeOpacity' in raw && typeof raw.strokeOpacity === 'number' && Number.isFinite(raw.strokeOpacity)) {
    out.linkOpacity = raw.strokeOpacity
  } else if ('linkOpacity' in raw && typeof raw.linkOpacity === 'number' && Number.isFinite(raw.linkOpacity)) {
    out.linkOpacity = raw.linkOpacity
  }
  if ('strokeWidth' in raw && typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth)) {
    out.linkWidth = raw.strokeWidth
  } else if ('linkWidth' in raw && typeof raw.linkWidth === 'number' && Number.isFinite(raw.linkWidth)) {
    out.linkWidth = raw.linkWidth
  }
  if ('r' in raw && typeof raw.r === 'number' && Number.isFinite(raw.r)) {
    out.nodeRadius = raw.r
  } else if ('nodeRadius' in raw && typeof raw.nodeRadius === 'number' && Number.isFinite(raw.nodeRadius)) {
    out.nodeRadius = raw.nodeRadius
  }
  if ('internalFill' in raw && typeof raw.internalFill === 'string' && raw.internalFill.trim()) {
    out.internalFill = raw.internalFill.trim()
  }
  if ('fill' in raw && typeof raw.fill === 'string' && raw.fill.trim()) {
    out.leafFill = raw.fill.trim()
  } else if ('leafFill' in raw && typeof raw.leafFill === 'string' && raw.leafFill.trim()) {
    out.leafFill = raw.leafFill.trim()
  }
  if ('labelFontSize' in raw && typeof raw.labelFontSize === 'number' && Number.isFinite(raw.labelFontSize)) {
    out.labelFontSize = raw.labelFontSize
  }
  if ('fontSize' in raw && typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)) {
    out.labelFontSize = raw.fontSize
  }
  if ('labelFontFamily' in raw && typeof raw.labelFontFamily === 'string' && raw.labelFontFamily.trim()) {
    out.labelFontFamily = raw.labelFontFamily.trim()
  }
  if ('fontFamily' in raw && typeof raw.fontFamily === 'string' && raw.fontFamily.trim()) {
    out.labelFontFamily = raw.fontFamily.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

function applyLayoutAutosuggestFromMetadata(get: GetGraph, metadata: unknown) {
  if (!isRecord(metadata)) return
  const rawMode =
    metadata['canvas:layoutMode'] ??
    metadata['canvas:layout.mode'] ??
    metadata['layoutMode'] ??
    (isRecord(metadata['canvas:layout']) ? metadata['canvas:layout'].mode : undefined)

  const modeSuggestion = parseLayoutMode(rawMode)

  const tidyRaw = metadata['canvas:tidyTree'] ?? metadata['canvas:tidy-tree'] ?? metadata['tidyTree']
  const tidySuggestion = parseTidyTreeMetadata(tidyRaw)

  if (!modeSuggestion && !tidySuggestion) return

  const schema = get().schema
  const curLayout = schema.layout || {}
  let nextLayout = curLayout
  let changed = false

  if (modeSuggestion && (curLayout.mode || 'force') === 'force' && modeSuggestion !== 'force') {
    nextLayout = { ...nextLayout, mode: modeSuggestion }
    changed = true
  }

  if (tidySuggestion && !modeSuggestion && (curLayout.mode || 'force') === 'force') {
    nextLayout = { ...nextLayout, mode: 'tidy-tree' }
    changed = true
  }

  if (tidySuggestion) {
    const curTidy = curLayout.tidyTree || {}
    const nextTidy: typeof curTidy = { ...curTidy }
    if ((curTidy.edgeLabels || []).length === 0 && (tidySuggestion.edgeLabels || []).length > 0) {
      nextTidy.edgeLabels = tidySuggestion.edgeLabels
    }
    if (curTidy.direction == null && tidySuggestion.direction != null) nextTidy.direction = tidySuggestion.direction
    if (curTidy.orientation == null && tidySuggestion.orientation != null) nextTidy.orientation = tidySuggestion.orientation
    if (curTidy.nodeSize == null && tidySuggestion.nodeSize != null) nextTidy.nodeSize = tidySuggestion.nodeSize
    if (curTidy.separation == null && tidySuggestion.separation != null) nextTidy.separation = tidySuggestion.separation
    if (curTidy.sortBy == null && tidySuggestion.sortBy != null) nextTidy.sortBy = tidySuggestion.sortBy
    if (curTidy.curve == null && tidySuggestion.curve != null) nextTidy.curve = tidySuggestion.curve
    if (curTidy.colorMode == null && tidySuggestion.colorMode != null) nextTidy.colorMode = tidySuggestion.colorMode
    if (!String(curTidy.linkStroke || '').trim() && tidySuggestion.linkStroke != null) nextTidy.linkStroke = tidySuggestion.linkStroke
    if (curTidy.linkOpacity == null && tidySuggestion.linkOpacity != null) nextTidy.linkOpacity = tidySuggestion.linkOpacity
    if (curTidy.linkWidth == null && tidySuggestion.linkWidth != null) nextTidy.linkWidth = tidySuggestion.linkWidth
    if (curTidy.nodeRadius == null && tidySuggestion.nodeRadius != null) nextTidy.nodeRadius = tidySuggestion.nodeRadius
    if (!String(curTidy.internalFill || '').trim() && tidySuggestion.internalFill != null) nextTidy.internalFill = tidySuggestion.internalFill
    if (!String(curTidy.leafFill || '').trim() && tidySuggestion.leafFill != null) nextTidy.leafFill = tidySuggestion.leafFill
    if (curTidy.labelFontSize == null && tidySuggestion.labelFontSize != null) nextTidy.labelFontSize = tidySuggestion.labelFontSize
    if (!String(curTidy.labelFontFamily || '').trim() && tidySuggestion.labelFontFamily != null) {
      nextTidy.labelFontFamily = tidySuggestion.labelFontFamily
    }
    const tidyChanged = JSON.stringify(curTidy) !== JSON.stringify(nextTidy)
    if (tidyChanged) {
      nextLayout = { ...nextLayout, tidyTree: nextTidy }
      changed = true
    }
  }

  if (!changed) return
  get().setSchema({ ...schema, layout: nextLayout })
  if ((nextLayout.mode || schema.layout?.mode) === 'radial' || (nextLayout.mode || schema.layout?.mode) === 'tidy-tree') {
    const setCanvasRenderMode = get().setCanvasRenderMode
    if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode('2d')
  }
}

function readGraphRagWorkflowJsonTextFromGraphData(graphData: GraphData): string | null {
  const meta = graphData.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const rawText = (meta as Record<string, unknown>).graphRagWorkflowJsonText as unknown
  if (typeof rawText === 'string') {
    const trimmed = rawText.trim()
    return trimmed ? rawText : null
  }
  const rawDoc = (meta as Record<string, unknown>).graphRagWorkflowJsonLd as unknown
  if (!rawDoc || typeof rawDoc !== 'object') return null
  if (Array.isArray(rawDoc)) return null
  try {
    const text = JSON.stringify(rawDoc, null, 2)
    return text && text.trim() ? text : null
  } catch {
    return null
  }
}

function syncGraphFieldsWithGraphData(
  get: GetGraph,
  graphData: GraphData,
  options?: { resetVisibleColumns?: boolean },
) {
  const derived = computeDerivedFields(graphData)
  const derivedFieldIds = new Set<string>(derived.map(f => f.id))
  const derivedPropColumnKeys = new Set<string>(derived.map(f => `prop:${f.scope}:${f.key}`))

  const currentSettings = get().graphFieldSettingsById || {}
  const customPropColumnKeys = new Set<string>()
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!v || v.isCustom !== true) continue
    const parsed = parseGraphFieldId(k)
    if (parsed) customPropColumnKeys.add(`prop:${parsed.scope}:${parsed.key}`)
  }

  const activePropColumnKeys = new Set<string>([...derivedPropColumnKeys, ...customPropColumnKeys])

  const currentOrder = get().graphDataTableColumnOrder || []
  const baseAndActiveOrder = currentOrder.filter(
    k => !isGraphDataTablePropertyColumnKey(k) || activePropColumnKeys.has(k),
  )
  const missingPropKeys: GraphDataTableColumnKey[] = []
  for (const key of activePropColumnKeys) {
    const colKey = key as GraphDataTableColumnKey
    if (!baseAndActiveOrder.includes(colKey)) {
      missingPropKeys.push(colKey)
    }
  }
  const nextOrder = [...baseAndActiveOrder, ...missingPropKeys]
  get().setGraphDataTableColumnOrder(nextOrder)

  const currentVisible = (get().graphDataTableVisibleColumns || {}) as Record<
    string,
    boolean | undefined
  >
  const nextVisible: Record<string, boolean | undefined> = options?.resetVisibleColumns
    ? { ...buildDefaultVisibleColumns() }
    : { ...currentVisible }
  for (const rawKey of Object.keys(nextVisible)) {
    if (!isGraphDataTablePropertyColumnKey(rawKey as GraphDataTableColumnKey)) continue
    if (!activePropColumnKeys.has(rawKey)) delete nextVisible[rawKey]
  }
  for (const key of activePropColumnKeys) {
    if (options?.resetVisibleColumns || nextVisible[key] === undefined) {
      const parsed = key.startsWith('prop:node:')
        ? { scope: 'node', id: `node:${key.slice('prop:node:'.length)}` }
        : key.startsWith('prop:edge:')
          ? { scope: 'edge', id: `edge:${key.slice('prop:edge:'.length)}` }
          : null
      const fieldId = parsed?.id
      const hidden = fieldId ? currentSettings[fieldId as keyof typeof currentSettings]?.isHidden : undefined
      nextVisible[key] = typeof hidden === 'boolean' ? !hidden : true
    }
  }
  get().setGraphDataTableVisibleColumns(nextVisible as GraphDataTableColumnVisibilityByKey)

  const nextSettings: typeof currentSettings = {}
  for (const [k, v] of Object.entries(currentSettings)) {
    if (!v) continue
    const isDerived = derivedFieldIds.has(k)
    if (!isDerived && v.isCustom !== true) continue
    nextSettings[k as keyof typeof currentSettings] = v
  }
  get().setGraphFieldSettingsById(nextSettings)
}

export const createGraphDataSlice = (set: SetGraph, get: GetGraph) => ({
  graphData: null as GraphData | null,
  graphDataRevision: 0,
  markdownDocumentName: null as string | null,
  markdownDocumentText: null as string | null,
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

  setMarkdownDocument: (name: string | null, text: string | null) => {
    set({
      markdownDocumentName: name,
      markdownDocumentText: text,
    })
  },

  setJsonSourceDocument: (name: string | null, text: string | null) => {
    const trimmed = typeof text === 'string' ? text.trim() : ''
    const nextText = trimmed ? text : null
    set(state => ({
      ...state,
      jsonSourceDocumentText: nextText,
      markdownDocumentName: name ?? null,
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

    const nextGraphData: GraphData = {
      ...graphData,
      metadata: nextMetadata,
    }
    set({ graphData: nextGraphData })
    try {
      lsSetJson(LS_KEYS.graphData, nextGraphData)
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
    const nodeIds = new Set<string>((graphData.nodes || []).map(n => n.id))
    const filteredEdges = (graphData.edges || []).filter(e => {
      const src = String(e.source || '')
      const tgt = String(e.target || '')
      if (!src || !tgt) return false
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false
      return true
    })
    const nextGraphData = filteredEdges.length === (graphData.edges || []).length ? graphData : { ...graphData, edges: filteredEdges }

    set(s => ({
      graphData: nextGraphData,
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      layoutPositionCacheByMode: {},
    }));
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
    set({ lifecycleStage: 'committed' });
    set({ aiKgTraversalRan: false });
    set({ minimapPreview: { nodesPath: '', edgesPath: '', sx: 1, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 } }, minimapWorkerRef: null });
    get().cancelMinimapWorker?.();
    get().scheduleHistory('Set Data');
    lsSetJson(LS_KEYS.graphData, nextGraphData)

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

      try {
        applyLayoutAutosuggestFromMetadata(get, nextGraphData.metadata)
      } catch {
        void 0
      }
      try {
        const mode = get().schema.layout?.mode
        if (mode === 'radial' || mode === 'tidy-tree') {
          const setCanvasRenderMode = get().setCanvasRenderMode
          if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode('2d')
        }
      } catch {
        void 0
      }
    }

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(runHeavyGraphDataSideEffects, 0)
    } else {
      runHeavyGraphDataSideEffects()
    }
  },

  clearGraphData: () => {
    get().cancelMinimapWorker?.();
    set(s => ({
      graphData: null,
      graphDataRevision: (s.graphDataRevision || 0) + 1,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      aiKgTraversalRan: false,
      layoutPositionCacheByMode: {},
      minimapPreview: { nodesPath: '', edgesPath: '', sx: 1, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 } },
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
    const current = graphData.nodes.find(n => n.id === id);
    const nextNode = current ? { ...current, ...updates } : null;
    if (!validateNodeProperties(schema, id, nextNode, graphData)) return;
    const nodes = graphData.nodes.map(n => (n.id === id ? { ...n, ...updates } : n));
    const nextGraphData = { ...graphData, nodes }
    set({ graphData: nextGraphData });
    if (Object.prototype.hasOwnProperty.call(updates, 'properties')) {
      try {
        syncGraphFieldsWithGraphData(get, nextGraphData)
      } catch { void 0 }
    }
    const fields = Object.keys(updates || {}).join(',') || 'none';
    get().scheduleHistory(`Update Node: ${id} [${fields}]`);
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
    const nodes = [...graphData.nodes, withTpl];
    const nextGraphData = { ...graphData, nodes }
    set({ graphData: nextGraphData });
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    const extras = `label=${withTpl.label ?? node.label},type=${node.type}`;
    get().scheduleHistory(`Add Node: ${withTpl.id} [${extras}]`);
  },

  removeNode: (id: string) => {
    const { graphData } = get();
    if (!graphData) return;
    const nodes = graphData.nodes.filter(n => n.id !== id);
    const edges = graphData.edges.filter(e => e.source !== id && e.target !== id);
    const nextGraphData = { ...graphData, nodes, edges }
    const state = get()
    const selectedEdgeId = state.selectedEdgeId
    const nextSelectedEdgeId = selectedEdgeId && edges.some(e => e.id === selectedEdgeId) ? selectedEdgeId : null
    const nextSelectedNodeIds = (state.selectedNodeIds || []).filter(nodeId => nodeId !== id)
    const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId =>
      edges.some(e => e.id === edgeId),
    )
    set({
      graphData: nextGraphData,
      selectedNodeId: null,
      selectedEdgeId: nextSelectedEdgeId,
      selectedNodeIds: nextSelectedNodeIds,
      selectedEdgeIds: nextSelectedEdgeIds,
    });
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
    if (!canAddEdge(schema, graphData, edge)) return;
    const tpl = schema.templates?.edge?.[edge.label] || {};
    const withTpl = { ...edge, properties: { ...(edge.properties || {}), ...tpl } };
    const edges = [...graphData.edges, withTpl];
    const nextGraphData = { ...graphData, edges }
    set({ graphData: nextGraphData });
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
    const edges = graphData.edges.map(e => (e.id === id ? { ...e, ...normalizedUpdates } : e));
    const nextGraphData = { ...graphData, edges }
    set({ graphData: nextGraphData });
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
    const edges = graphData.edges.filter(e => e.id !== id);
    const nextGraphData = { ...graphData, edges }
    const state = get()
    const selectedEdgeId = state.selectedEdgeId
    const nextSelectedEdgeId = selectedEdgeId === id ? null : selectedEdgeId
    const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId => edgeId !== id)
    set({
      graphData: nextGraphData,
      selectedEdgeId: nextSelectedEdgeId,
      selectedEdgeIds: nextSelectedEdgeIds,
    });
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    set({ lifecycleStage: 'edgeMutate' });
    get().scheduleHistory(`Remove Edge: ${id}`);
  },
});
