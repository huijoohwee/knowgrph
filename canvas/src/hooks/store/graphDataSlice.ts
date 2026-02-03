import { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types';
import { validateNodeProperties, validateEdgeProperties, canAddEdge } from '@/features/schema/validation';
import type { StoreApi } from 'zustand';
import type { GraphState } from '@/hooks/store/types'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson, lsRemove } from '@/lib/persistence'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import { isJsonValue } from '@/lib/graph/jsonValue'
import {
  applyLayoutAutosuggestFromMetadata,
  syncGraphFieldsWithGraphData,
  readGraphRagWorkflowJsonTextFromGraphData,
  withGraphDataRevision,
} from './graphDataSliceUtils'
import { containsFrontmatterMermaid, isMarkdownLikeFileName } from 'grph-shared/markdown/mermaidInput'
import {
  buildDefaultVisibleColumns,
  isGraphDataTablePropertyColumnKey,
  type GraphDataTableColumnKey,
} from '@/features/graph-data-table/graphDataTable'

type SetGraph = StoreApi<GraphState>['setState']
export type GetGraph = StoreApi<GraphState>['getState']

export const createGraphDataSlice = (set: SetGraph, get: GetGraph) => ({
  graphData: null as GraphData | null,
  graphDataRevision: 0,
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

  setMarkdownDocument: (name: string | null, text: string | null) => {
    const nextText = String(text || '')
    const hasFrontmatterMermaid = containsFrontmatterMermaid(nextText)
    set({
      markdownDocumentName: name,
      markdownDocumentText: text,
      markdownTokens: null, // Invalidate tokens
      markdownTokensPath: null,
      markdownTokensKey: null,
      markdownTokensMeta: null,
      markdownTokensStartLineOffset: null,
      ...(hasFrontmatterMermaid ? { frontmatterModeEnabled: true } : {}),
    })
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

    const { loadGraphDataFromTextViaParser } = (await import('@/features/parsers/loader')) as typeof import('@/features/parsers/loader')
    const res = await loadGraphDataFromTextViaParser(nextName, nextText, { applyToStore: true })
    return !!(res?.graphData && ((res.graphData.nodes || []).length > 0 || (res.graphData.edges || []).length > 0))
  },

  setMarkdownTokens: (args: {
    tokens: import('@/features/markdown/ui/markdownPreviewLex').TokenWithLines[] | null
    path?: string | null
    key?: string | null
    meta?: import('@/lib/markdown').MarkdownFrontmatter | null
    startLineOffset?: number | null
  }) => {
    set({
      markdownTokens: args.tokens,
      markdownTokensPath: args.path ?? null,
      markdownTokensKey: args.key ?? null,
      markdownTokensMeta: args.meta ?? null,
      markdownTokensStartLineOffset: args.startLineOffset ?? null,
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

    const nextGraphDataBase: GraphData = {
      ...graphData,
      metadata: nextMetadata,
    }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision })
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
    const nextGraphDataBase = filteredEdges.length === (graphData.edges || []).length ? graphData : { ...graphData, edges: filteredEdges }

    set(s => {
      const nextRevision = (s.graphDataRevision || 0) + 1
      const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
      return {
        graphData: nextGraphData,
        graphDataRevision: nextRevision,
        layoutPositionCacheByMode: {},
        graphValidationStatus: null,
        graphValidationTimestamp: null,
      }
    })
    const stateNow = get()
    const nextGraphData = stateNow.graphData as GraphData

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
        if (mode === 'radial') {
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

  setGraphDataPreservingLayout: (graphData: GraphData) => {
    const nodeIds = new Set<string>((graphData.nodes || []).map(n => n.id))
    const filteredEdges = (graphData.edges || []).filter(e => {
      const src = String(e.source || '')
      const tgt = String(e.target || '')
      if (!src || !tgt) return false
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false
      return true
    })
    const nextGraphData =
      filteredEdges.length === (graphData.edges || []).length ? graphData : { ...graphData, edges: filteredEdges }

    set(s => {
      const nextRevision = (s.graphDataRevision || 0) + 1
      return {
        graphData: withGraphDataRevision(nextGraphData, nextRevision),
        graphDataRevision: nextRevision,
        graphValidationStatus: null,
        graphValidationTimestamp: null,
      }
    })

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

    set({ lifecycleStage: 'committed' })
    try {
      lsSetJson(LS_KEYS.graphData, get().graphData)
    } catch {
      void 0
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
    const current = graphData.nodes.find(n => n.id === id);
    const nextNode = current ? { ...current, ...updates } : null;
    if (!validateNodeProperties(schema, id, nextNode, graphData)) return;
    const nodes = graphData.nodes.map(n => (n.id === id ? { ...n, ...updates } : n))
    const nextGraphDataBase = { ...graphData, nodes }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
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
    const nodes = [...graphData.nodes, withTpl]
    const nextGraphDataBase = { ...graphData, nodes }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
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
    set({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      selectedNodeId: null,
      selectedEdgeId: nextSelectedEdgeId,
      selectedNodeIds: nextSelectedNodeIds,
      selectedEdgeIds: nextSelectedEdgeIds,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
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
    const edges = [...graphData.edges, withTpl]
    const nextGraphDataBase = { ...graphData, edges }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
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
    const edges = graphData.edges.map(e => (e.id === id ? { ...e, ...normalizedUpdates } : e))
    const nextGraphDataBase = { ...graphData, edges }
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({ graphData: nextGraphData, graphDataRevision: nextRevision, graphValidationStatus: null, graphValidationTimestamp: null })
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
    const nextGraphDataBase = { ...graphData, edges }
    const state = get()
    const selectedEdgeId = state.selectedEdgeId
    const nextSelectedEdgeId = selectedEdgeId === id ? null : selectedEdgeId
    const nextSelectedEdgeIds = (state.selectedEdgeIds || []).filter(edgeId => edgeId !== id)
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData = withGraphDataRevision(nextGraphDataBase, nextRevision)
    set({
      graphData: nextGraphData,
      graphDataRevision: nextRevision,
      selectedEdgeId: nextSelectedEdgeId,
      selectedEdgeIds: nextSelectedEdgeIds,
      graphValidationStatus: null,
      graphValidationTimestamp: null,
    });
    try {
      syncGraphFieldsWithGraphData(get, nextGraphData)
    } catch { void 0 }
    set({ lifecycleStage: 'edgeMutate' });
    get().scheduleHistory(`Remove Edge: ${id}`);
  },
});
