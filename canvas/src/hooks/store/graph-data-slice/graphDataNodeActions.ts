import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GetGraph, SetGraph } from './graphDataSliceAccess'
import { validateNodeProperties } from '@/features/schema/validation'
import { composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'
import { syncGraphFieldsWithGraphData, withGraphDataRevision } from '@/hooks/store/graphDataSliceUtils'
import {
  buildLayersFromSourceFiles,
  ensureSourceFileGraphData,
  flushComposedPositionWritesNow,
  isComposedGraphData,
  isPositionOnlyNodeUpdate,
  isPureComposedNodePositionUpdate,
  mergeNodeForUpdate,
  parseComposedId,
  queueComposedPositionWrite,
  resolvePreferredComposedLayerId,
} from './graphDataComposedSource'
import { syncSourceFileTextFromParsedGraph, writeWorkspaceSourceTextIfPresent } from './graphDataFrontmatterFlowSync'
import { buildUpdatedSourceFileParsedGraphState } from '@/features/source-files/sourceFileParsedState'

export function createGraphDataNodeActions(set: SetGraph, get: GetGraph) {
  return ({
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

          queueComposedPositionWrite({ graphData, layerId: parsed.layerId, innerId: parsed.innerId, updates })
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
            ...buildUpdatedSourceFileParsedGraphState({
              previousParsedState: file,
              graphData: nextParsedGraphData,
            }),
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
          ...buildUpdatedSourceFileParsedGraphState({
            previousParsedState: file,
            graphData: nextParsedGraphData,
          }),
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
            ...buildUpdatedSourceFileParsedGraphState({
              previousParsedState: file,
              graphData: nextParsedGraphData,
            }),
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
  })
}
