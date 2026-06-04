
import type { StoreApi } from 'zustand'
import type { BottomSurfaceTab, DocumentSemanticMode, GraphState } from './types'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { UI_COPY } from '@/lib/config-copy/uiCopy'
import { lsSetInt } from '@/lib/persistence'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import type { GraphData } from '@/lib/graph/types'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { isFrontmatterOnlyPolicyActive, resolveTableGraphCanvas2dRenderer } from '@/lib/config.render'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

type KeywordDefaults = {
  previewDebounceMs: number
  fullDebounceMs: number
}

const nodeHasMediaLikeProps = (node: { properties?: unknown } | null): boolean => {
  if (!node) return false
  const props = node.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false
  const rec = props as Record<string, unknown>
  const keys = ['iframe_url', 'media_url', 'image', 'video', 'media']
  for (let i = 0; i < keys.length; i += 1) {
    const v = rec[keys[i]!]
    if (typeof v === 'string' && v.trim()) return true
  }
  return false
}

const nodeIdExistsInGraph = (graph: unknown, nodeId: string): boolean => {
  if (!nodeId) return false
  if (!graph || typeof graph !== 'object') return false
  const g = graph as { nodes?: unknown }
  const nodes = Array.isArray(g.nodes) ? (g.nodes as Array<{ id?: unknown }>) : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!n) continue
    if (String(n.id || '') === nodeId) return true
  }
  return false
}

export const createUiSettingsModeActions = (
  set: SetGraph,
  get: GetGraph,
  keywordDefaults: KeywordDefaults,
)=> ({
  setBottomSurfaceHeightRatio: (v: number) => set({ bottomSurfaceHeightRatio: v }),
  setFloatingPanelWidthRatio: (v: number) => set({ floatingPanelWidthRatio: v }),
  setFloatingPanelZIndex: (v: number) => set({ floatingPanelZIndex: v }),
  setBottomSurfaceTab: (tab: BottomSurfaceTab) => set({ bottomSurfaceTab: tab }),
  setFrontmatterModeEnabled: (v: boolean) => {
    const stateNow = get()
    if (v !== true && isFrontmatterOnlyPolicyActive({ canvasRenderMode: stateNow.canvasRenderMode, canvas2dRenderer: stateNow.canvas2dRenderer })) {
      return
    }
    set(state => {
      const nextEnabled = v === true
      const prevEnabled = state.frontmatterModeEnabled === true
      if (nextEnabled === prevEnabled) return {}

      const nextTable = nextEnabled ? false : state.multiDimTableModeEnabled === true

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: prevEnabled,
        multiDimTableModeEnabled: state.multiDimTableModeEnabled === true,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: nextEnabled,
        multiDimTableModeEnabled: nextTable,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const zoomStateByKey =
        prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const zoomRequest: ZoomRequest | null =
        nextEnabled && state.canvasRenderMode === '2d' && state.canvas2dRenderer !== 'flowEditor'
          ? { type: 'fit', intent: 'fitToView', at: Date.now() }
          : null

      return zoomRequest
        ? { frontmatterModeEnabled: nextEnabled, multiDimTableModeEnabled: nextTable, zoomStateByKey, zoomRequest }
        : { frontmatterModeEnabled: nextEnabled, multiDimTableModeEnabled: nextTable, zoomStateByKey }
    })
  },

  setMultiDimTableModeEnabled: (v: boolean) => {
    set(state => {
      const nextEnabled = v === true
      const prevEnabled = state.multiDimTableModeEnabled === true
      const nextCanvasRenderMode = nextEnabled ? '2d' : state.canvasRenderMode
      const nextCanvas2dRenderer = nextEnabled
        ? resolveTableGraphCanvas2dRenderer(state.canvas2dRenderer)
        : state.canvas2dRenderer
      const rendererChanged =
        state.canvasRenderMode !== nextCanvasRenderMode ||
        state.canvas2dRenderer !== nextCanvas2dRenderer
      if (nextEnabled === prevEnabled && !rendererChanged) return {}

      const nextFrontmatter = nextEnabled ? false : state.frontmatterModeEnabled === true

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        multiDimTableModeEnabled: prevEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: nextCanvasRenderMode,
        canvas2dRenderer: nextCanvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: nextFrontmatter,
        multiDimTableModeEnabled: nextEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const zoomStateByKey =
        prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const zoomRequest: ZoomRequest | null =
        nextEnabled && nextCanvasRenderMode === '2d' && nextCanvas2dRenderer !== 'flowEditor'
          ? { type: 'fit', intent: 'fitToView', at: Date.now() }
          : null

      return zoomRequest
        ? {
            canvasRenderMode: nextCanvasRenderMode,
            canvas2dRenderer: nextCanvas2dRenderer,
            multiDimTableModeEnabled: nextEnabled,
            frontmatterModeEnabled: nextFrontmatter,
            zoomStateByKey,
            zoomRequest,
          }
        : {
            canvasRenderMode: nextCanvasRenderMode,
            canvas2dRenderer: nextCanvas2dRenderer,
            multiDimTableModeEnabled: nextEnabled,
            frontmatterModeEnabled: nextFrontmatter,
            zoomStateByKey,
          }
    })
  },
  setDocumentSemanticMode: (v: DocumentSemanticMode) => {
    if (get().documentStructureBaselineLock === true) {
      get().upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    const stateNow = get()
    const keywordBlockedForRenderer = v === 'keyword' && isFrontmatterOnlyPolicyActive({
      canvasRenderMode: stateNow.canvasRenderMode,
      canvas2dRenderer: stateNow.canvas2dRenderer,
    })
    const nextMode: DocumentSemanticMode = keywordBlockedForRenderer ? 'document' : (v === 'keyword' ? 'keyword' : 'document')
    const prevMode: DocumentSemanticMode = (get().documentSemanticMode || 'document') as DocumentSemanticMode
    if (nextMode === prevMode) return
    let selectionClearedOnSwitch = false
    set(state => {
      const prevSchemaByMode = state.schemaBySemanticMode
      const schemaByMode = {
        document: prevSchemaByMode?.document || state.schema,
        keyword: prevSchemaByMode?.keyword || state.schema,
        [prevMode]: state.schema,
      }
      const nextSchema = schemaByMode[nextMode] || state.schema

      const prevZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: state.schema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: prevMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const nextZoomKey = buildActive2dZoomViewKey({
        canvasRenderMode: state.canvasRenderMode,
        canvas2dRenderer: state.canvas2dRenderer,
        schema: nextSchema,
        graphData: (state.graphData as unknown as GraphData | null),
        documentSemanticMode: nextMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      })
      const prevZoom = prevZoomKey ? state.zoomStateByKey?.[prevZoomKey] ?? null : null
      const nextZoomExists = nextZoomKey ? Boolean(state.zoomStateByKey?.[nextZoomKey]) : false
      const shouldCopyZoom = true
      const zoomStateByKey =
        shouldCopyZoom && prevZoom && nextZoomKey && !nextZoomExists
          ? { ...(state.zoomStateByKey || {}), [nextZoomKey]: prevZoom }
          : state.zoomStateByKey

      const selectedNodeId = String(state.selectedNodeId || '')
      const selectedEdgeId = String(state.selectedEdgeId || '')
      const selectedGroupId = String(state.selectedGroupId || '')
      const selectedNodeIds = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds.map(String) : []
      const selectedEdgeIds = Array.isArray(state.selectedEdgeIds) ? state.selectedEdgeIds.map(String) : []
      const selectedGroupIds = Array.isArray(state.selectedGroupIds) ? state.selectedGroupIds.map(String) : []

      const prevHadNodeSelection = Boolean(selectedNodeId) || selectedNodeIds.length > 0
      const prevHadOtherSelection = Boolean(selectedEdgeId || selectedGroupId) || selectedEdgeIds.length > 0 || selectedGroupIds.length > 0

      const baseGraph = state.graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
      const keepSelectedNode = (() => {
        if (!selectedNodeId) return ''
        if (nextMode === 'document') return nodeIdExistsInGraph(baseGraph, selectedNodeId) ? selectedNodeId : ''
        if (nextMode !== 'keyword') return ''
        if (!nodeIdExistsInGraph(baseGraph, selectedNodeId)) return ''
        const nodes = baseGraph && Array.isArray(baseGraph.nodes) ? (baseGraph.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          if (!n) continue
          if (String(n.id || '') !== selectedNodeId) continue
          return nodeHasMediaLikeProps(n) ? selectedNodeId : ''
        }
        return ''
      })()

      const keepSelectedNodeIds = (() => {
        if (keepSelectedNode) return [keepSelectedNode]
        const kept: string[] = []
        if (nextMode === 'document') {
          for (let i = 0; i < selectedNodeIds.length; i += 1) {
            const id = selectedNodeIds[i]!
            if (nodeIdExistsInGraph(baseGraph, id)) kept.push(id)
          }
          return kept
        }
        if (nextMode === 'keyword') {
          for (let i = 0; i < selectedNodeIds.length; i += 1) {
            const id = selectedNodeIds[i]!
            if (!nodeIdExistsInGraph(baseGraph, id)) continue
            const nodes = baseGraph && Array.isArray(baseGraph.nodes) ? (baseGraph.nodes as Array<{ id?: unknown; properties?: unknown }>) : []
            let found = false
            for (let j = 0; j < nodes.length; j += 1) {
              const n = nodes[j]
              if (!n) continue
              if (String(n.id || '') !== id) continue
              if (nodeHasMediaLikeProps(n)) {
                kept.push(id)
              }
              found = true
              break
            }
            if (!found) continue
          }
          return kept
        }
        return []
      })()

      const shouldClearNonNodeSelection = nextMode !== 'document'
      const nextSelectedEdgeId = shouldClearNonNodeSelection ? null : (selectedEdgeId && state.selectedEdgeId)
      const nextSelectedGroupId = shouldClearNonNodeSelection ? null : (selectedGroupId && state.selectedGroupId)
      const nextSelectedEdgeIds = shouldClearNonNodeSelection ? [] : selectedEdgeIds
      const nextSelectedGroupIds = shouldClearNonNodeSelection ? [] : selectedGroupIds

      const disableZoomModes = state.viewPinned !== true && (state.fitToScreenMode === true || state.zoomToSelectionMode === true)

      const nextHadNodeSelection = Boolean(keepSelectedNode) || keepSelectedNodeIds.length > 0
      const nextHadOtherSelection = Boolean(nextSelectedEdgeId || nextSelectedGroupId) || nextSelectedEdgeIds.length > 0 || nextSelectedGroupIds.length > 0
      selectionClearedOnSwitch = (prevHadNodeSelection || prevHadOtherSelection) && !nextHadNodeSelection && !nextHadOtherSelection

      return {
        documentSemanticMode: nextMode,
        schema: nextSchema,
        schemaBySemanticMode: schemaByMode,
        zoomStateByKey,
        fitToScreenMode: disableZoomModes ? false : state.fitToScreenMode,
        zoomToSelectionMode: disableZoomModes ? false : state.zoomToSelectionMode,
        selectedNodeId: keepSelectedNode ? keepSelectedNode : null,
        selectedNodeIds: keepSelectedNodeIds,
        selectedEdgeId: nextSelectedEdgeId ?? null,
        selectedGroupId: nextSelectedGroupId ?? null,
        selectedEdgeIds: nextSelectedEdgeIds,
        selectedGroupIds: nextSelectedGroupIds,
        collapsedGroupIds: nextMode === 'keyword' ? [] : state.collapsedGroupIds,
      } as Partial<GraphState>
    })

    if (selectionClearedOnSwitch) {
      try {
        get().upsertUiToast({
          id: 'selection-cleared-mode',
          kind: 'neutral',
          message: UI_COPY.selectionClearedOnModeSwitchToast,
          ttlMs: 4500,
        })
      } catch {
        void 0
      }
    }
  },
  setKeywordSourceMaxLines: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 8000
    const clamped = Math.max(200, Math.min(100_000, n))
    lsSetInt(LS_KEYS.keywordSourceMaxLines, clamped, { min: 200, max: 100_000 })
    set({ keywordSourceMaxLines: clamped })
  },
  setKeywordSourceMaxChars: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 120_000
    const clamped = Math.max(10_000, Math.min(2_000_000, n))
    lsSetInt(LS_KEYS.keywordSourceMaxChars, clamped, { min: 10_000, max: 2_000_000 })
    set({ keywordSourceMaxChars: clamped })
  },
  setKeywordGraphPreviewDebounceMs: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : keywordDefaults.previewDebounceMs
    const clamped = Math.max(0, Math.min(10_000, n))
    lsSetInt(LS_KEYS.keywordGraphPreviewDebounceMs, clamped, { min: 0, max: 10_000 })
    set({ keywordGraphPreviewDebounceMs: clamped })
  },
  setKeywordGraphFullDebounceMs: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : keywordDefaults.fullDebounceMs
    const clamped = Math.max(0, Math.min(30_000, n))
    lsSetInt(LS_KEYS.keywordGraphFullDebounceMs, clamped, { min: 0, max: 30_000 })
    set({ keywordGraphFullDebounceMs: clamped })
  },
  setKeywordGraphEdgesPerNode: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 6
    const clamped = Math.max(1, Math.min(60, n))
    lsSetInt(LS_KEYS.keywordGraphEdgesPerNode, clamped, { min: 1, max: 60 })
    set({ keywordGraphEdgesPerNode: clamped })
  },
  setKeywordGraphMaxEdgesCap: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 2400
    const clamped = Math.max(0, Math.min(25_000, n))
    lsSetInt(LS_KEYS.keywordGraphMaxEdgesCap, clamped, { min: 0, max: 25_000 })
    set({ keywordGraphMaxEdgesCap: clamped })
  },
  setKeywordGraphMentionEdgesPerSourceNode: (v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 6
    const clamped = Math.max(0, Math.min(30, n))
    lsSetInt(LS_KEYS.keywordGraphMentionEdgesPerSourceNode, clamped, { min: 0, max: 30 })
    set({ keywordGraphMentionEdgesPerSourceNode: clamped })
  },
})
