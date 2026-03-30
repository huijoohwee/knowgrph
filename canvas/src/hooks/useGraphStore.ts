import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware'
import { defaultSchema } from '@/lib/graph/schema';
import { createGraphDataSlice } from '@/hooks/store/graphDataSlice';
import { createMinimapSlice } from '@/features/minimap/store';
import { createSelectionSlice } from '@/hooks/store/selectionSlice';
import { createHistorySlice } from '@/hooks/store/historySlice';
import { createUiSlice } from '@/hooks/store/uiSlice';
import { createCanvasSlice } from '@/hooks/store/canvasSlice';
import { createGraphViewSlice } from '@/hooks/store/graphViewSlice';
import { createSchemaSlice, readSchemaFromStorage } from '@/hooks/store/schemaSlice';
import { createUiSettingsSlice } from '@/hooks/store/uiSettingsSlice';
import { createUiToastSlice } from '@/hooks/store/uiToastSlice';
import { createUiLogSlice } from '@/hooks/store/uiLogSlice'
import { createFlowEditorManagerSlice } from '@/hooks/store/flowEditorManagerSlice'
import { createDesignRendererSlice } from '@/hooks/store/designRendererSlice'
import { createDesignSystemSlice } from '@/hooks/store/designSystemSlice'
import { createSourceFilesSlice } from '@/hooks/store/sourceFilesSlice';
import { createLocalMarkdownFolderSlice } from '@/hooks/store/localMarkdownFolderSlice'
import { createHtmlCanvasPublishSlice } from '@/hooks/store/htmlCanvasPublishSlice'
import { getLocalStorage } from '@/lib/persistence';
import type { GraphState, NodePosition2d } from '@/hooks/store/types';
import type { GraphSchema } from '@/lib/graph/schema'
import { DEFAULT_BBOX_COLLIDE_PADDING, DEFAULT_FIT_PADDING, DEFAULT_GROUP_BBOX_COLLIDE_PADDING } from '@/lib/graph/layoutDefaults'
import { buildDocumentKey, buildDocumentRef, readPerDocumentUiState, writePerDocumentUiState } from '@/lib/persistence/perDocumentUiState'

const positionsMatch = (
  a: Record<string, NodePosition2d> | null | undefined,
  b: Record<string, NodePosition2d> | null | undefined,
): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]
    const aPos = a[key]
    const bPos = b[key]
    if (!bPos) return false
    if (aPos.x !== bPos.x || aPos.y !== bPos.y) return false
  }
  return true
}

export type { GraphState } from '@/hooks/store/types';

const applyCanvasDefaultInitSchema = (schema: GraphSchema): GraphSchema => {
  const behavior = schema.behavior || { allowEdgeCreation: true, allowNodeDrag: true }
  const portHandles = behavior.portHandles
    ? { ...behavior.portHandles }
    : { enabled: false, placement: 'cardinal' as const, size: 4, offset: 2, strokeWidth: 1.5 }
  const rawNodeShapeMode = behavior.nodeShapeMode
  const nodeShapeMode: NonNullable<GraphSchema['behavior']>['nodeShapeMode'] =
    rawNodeShapeMode === 'rect' || rawNodeShapeMode === 'diamond' || rawNodeShapeMode === 'hex'
      ? rawNodeShapeMode
      : 'circle'
  const nextBehavior = { ...behavior, nodeShapeMode, portHandles }
  const nextLayout = { ...(schema.layout || {}), mode: 'radial' as const }
  return { ...schema, behavior: nextBehavior, layout: nextLayout }
}

const buildKeywordSchemaPreset = (schema: GraphSchema): GraphSchema => {
  const layout = schema.layout || {}
  const forces = layout.forces || {}

  const forcesWithMaybeCharge = forces as typeof forces & { charge?: number }
  const forcesWithoutCharge: typeof forces = (() => {
    const { charge, ...rest } = forcesWithMaybeCharge
    void charge
    return rest
  })()

  const baseBBoxPaddingRaw = (forces as typeof forces & { bboxCollidePadding?: number }).bboxCollidePadding
  const baseGroupPaddingRaw = (forces as typeof forces & { groupBboxCollidePadding?: number }).groupBboxCollidePadding
  const baseFitPaddingRaw = layout.fitPadding
  const baseAntiLineStrengthRaw = (forces as typeof forces & { antiLineStrength?: number }).antiLineStrength
  const basePostFitStrengthRaw = (forces as typeof forces & { postFitStrength?: number }).postFitStrength
  const basePostFitAlphaMaxRaw = (forces as typeof forces & { postFitAlphaMax?: number }).postFitAlphaMax

  const baseBBoxPadding = typeof baseBBoxPaddingRaw === 'number' && Number.isFinite(baseBBoxPaddingRaw)
    ? baseBBoxPaddingRaw
    : DEFAULT_BBOX_COLLIDE_PADDING
  const baseGroupPadding = typeof baseGroupPaddingRaw === 'number' && Number.isFinite(baseGroupPaddingRaw)
    ? baseGroupPaddingRaw
    : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  const baseFitPadding = typeof baseFitPaddingRaw === 'number' && Number.isFinite(baseFitPaddingRaw)
    ? baseFitPaddingRaw
    : DEFAULT_FIT_PADDING
  const baseAntiLineStrength = typeof baseAntiLineStrengthRaw === 'number' && Number.isFinite(baseAntiLineStrengthRaw)
    ? baseAntiLineStrengthRaw
    : 0.06
  const basePostFitStrength = typeof basePostFitStrengthRaw === 'number' && Number.isFinite(basePostFitStrengthRaw)
    ? basePostFitStrengthRaw
    : 0.34
  const basePostFitAlphaMax = typeof basePostFitAlphaMaxRaw === 'number' && Number.isFinite(basePostFitAlphaMaxRaw)
    ? basePostFitAlphaMaxRaw
    : 0.12

  const keywordBBoxPadding = Math.round(baseBBoxPadding * 1.15)
  const keywordGroupPadding = Math.round(baseGroupPadding * 1.15)
  const keywordFitPadding = Math.round(baseFitPadding * 0.9)
  const keywordAntiLineStrength = Math.max(0.02, Math.min(0.12, baseAntiLineStrength * 1.5))
  const keywordPostFitStrength = Math.max(0.1, Math.min(0.6, basePostFitStrength * 1.3))
  const keywordPostFitAlphaMax = Math.max(0.05, Math.min(0.25, basePostFitAlphaMax * 1.25))

  const nextLayout: GraphSchema['layout'] = {
    ...layout,
    forces: {
      ...forcesWithoutCharge,
      bboxCollidePadding: keywordBBoxPadding,
      groupBboxCollidePadding: keywordGroupPadding,
      antiLineStrength: keywordAntiLineStrength,
      postFitStrength: keywordPostFitStrength,
      postFitAlphaMax: keywordPostFitAlphaMax,
    },
    fitPadding: keywordFitPadding,
  }

  return { ...schema, layout: nextLayout }
}

const initialSchemaBase: GraphSchema = (() => {
  try {
    const storage = getLocalStorage();
    const fromStorage = readSchemaFromStorage(storage)
    return applyCanvasDefaultInitSchema(fromStorage || defaultSchema);
  } catch {
    return applyCanvasDefaultInitSchema(defaultSchema);
  }
})()

const initialKeywordSchema: GraphSchema = buildKeywordSchemaPreset(initialSchemaBase)
const initialSchema: GraphSchema = initialSchemaBase

export const useGraphStore = create<GraphState>()(
  subscribeWithSelector((set, get, api) => ({
  schema: initialSchema,
  schemaBySemanticMode: { document: initialSchema, keyword: initialKeywordSchema },
  layoutPositionCacheByMode: {},
  graphFieldsOpOk: null,
  graphFieldsOpMsg: '',
  orchestratorOpOk: null,
  orchestratorOpMsg: '',
  renderOpOk: null,
  renderOpMsg: '',
  graphValidationStatus: null,
  graphValidationTimestamp: null,
  setGraphValidationResult: (status, timestamp) => {
    set({
      graphValidationStatus: status,
      graphValidationTimestamp: timestamp,
    })
  },
  setLayoutPositionsForMode: (key: string, positions: Record<string, NodePosition2d> | null) => {
    const prev = get().layoutPositionCacheByMode || {}
    const prevEntry = prev[key] || null
    if (!positions || Object.keys(positions).length === 0) {
      if (!prevEntry) return
      const next: typeof prev = { ...prev }
      delete next[key]
      set({ layoutPositionCacheByMode: next })
      return
    }
    if (positionsMatch(prevEntry, positions)) return
    set({ layoutPositionCacheByMode: { ...prev, [key]: positions } })
  },
  setGraphFieldsOpStatus: (ok, msg) => {
    set({ graphFieldsOpOk: ok, graphFieldsOpMsg: String(msg || '') })
  },
  setOrchestratorOpStatus: (ok, msg) => {
    set({ orchestratorOpOk: ok, orchestratorOpMsg: String(msg || '') })
  },
  setRenderOpStatus: (ok, msg) => {
    set({ renderOpOk: ok, renderOpMsg: String(msg || '') })
  },
  lifecycleStage: 'idle',
  setLifecycleStage: (v) => set({ lifecycleStage: v }),
  resetAll: () => {
    const schema = applyCanvasDefaultInitSchema(defaultSchema)
    const keywordSchema = buildKeywordSchemaPreset(schema)
    set({
      graphData: { nodes: [], edges: [], type: 'application/json' },
      schema,
      schemaBySemanticMode: { document: schema, keyword: keywordSchema },
      layoutPositionCacheByMode: {},
      history: [],
      historyIndex: -1,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedGroupId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: [],
      collapsedGroupIds: [],
      openQuickEditorNodeIds: [],
      designLayerState: { order: [], hiddenById: {} },
      designFramePosById: {},
      graphFieldsOpOk: null,
      graphFieldsOpMsg: '',
      orchestratorOpOk: null,
      orchestratorOpMsg: '',
      renderOpOk: null,
      renderOpMsg: '',
      lifecycleStage: 'idle',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: true,
      uiLogEntries: [],
    });
  },
  ...createUiSettingsSlice(set, get),
  ...createGraphDataSlice(set, get),
  ...createMinimapSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createGraphViewSlice(set, get),
  ...createHistorySlice(set, get),
  ...createUiSlice(set),
  ...createUiToastSlice(set),
  ...createUiLogSlice(set),
  ...createDesignSystemSlice(set, get),
  ...createFlowEditorManagerSlice(set, get),
  ...createDesignRendererSlice(set, get),
  ...createSourceFilesSlice(set, get, api),
  ...createLocalMarkdownFolderSlice(set, get, api),
  ...createHtmlCanvasPublishSlice(set, get, api),
  ...createCanvasSlice(set, get),
  ...createSchemaSlice(set, get),
})),
)

try {
  const w = typeof window !== 'undefined' ? (window as unknown as { localStorage?: Storage; __KG_MARKDOWN_EMPTY_TRACE__?: unknown; __KG_MARKDOWN_EMPTY_TRACE_SUB__?: unknown }) : null
  const enabled = !!(w?.localStorage && w.localStorage.getItem('kg:debug:markdownEmptyTrace') === '1')
  if (w && enabled && !w.__KG_MARKDOWN_EMPTY_TRACE_SUB__) {
    w.__KG_MARKDOWN_EMPTY_TRACE_SUB__ = true
    const buf: Array<{ ts: number; prevName: string; nextName: string; prevLen: number; nextLen: number; stack: string }> = []
    w.__KG_MARKDOWN_EMPTY_TRACE__ = buf
    let prevName = String(useGraphStore.getState().markdownDocumentName || '')
    let prevText = String(useGraphStore.getState().markdownDocumentText || '')
    useGraphStore.subscribe(
      s => [s.markdownDocumentName, s.markdownDocumentText] as const,
      next => {
        const nextName = String(next[0] || '')
        const nextText = String(next[1] || '')
        const prevLen = prevText.trim().length
        const nextLen = nextText.trim().length
        if (prevLen > 0 && nextLen === 0) {
          const stack = String(new Error('markdownDocumentText emptied').stack || '')
          buf.push({ ts: Date.now(), prevName, nextName, prevLen, nextLen, stack })
          if (buf.length > 20) buf.splice(0, buf.length - 20)
        }
        prevName = nextName
        prevText = nextText
      },
    )
  }
} catch {
  void 0
}

try {
  const w = typeof window !== 'undefined' ? (window as unknown as { localStorage?: Storage; __KG_DOC_UI_SUB__?: unknown }) : null
  if (w?.localStorage && !w.__KG_DOC_UI_SUB__) {
    w.__KG_DOC_UI_SUB__ = true
    let restoring = false
    let persistTimer: number | null = null
    let pending: { key: string; ref: string; state: Parameters<typeof writePerDocumentUiState>[0]['state'] } | null = null

    const schedulePersist = () => {
      if (persistTimer != null) return
      persistTimer = window.setTimeout(() => {
        persistTimer = null
        const next = pending
        pending = null
        if (!next) return
        writePerDocumentUiState({
          documentKey: next.key,
          documentRef: next.ref,
          state: next.state,
        })
      }, 250)
    }

    useGraphStore.subscribe(
      s => {
        const docKey = buildDocumentKey({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl })
        const docRef = buildDocumentRef({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl })
        return {
          docKey,
          docRef,
          documentStructureBaselineLock: s.documentStructureBaselineLock,
          canvasRenderMode: s.canvasRenderMode,
          canvas3dMode: s.canvas3dMode,
          canvas2dRenderer: s.canvas2dRenderer,
          documentSemanticMode: s.documentSemanticMode,
          frontmatterModeEnabled: s.frontmatterModeEnabled,
          viewPinned: s.viewPinned,
          fitToScreenMode: s.fitToScreenMode,
          zoomToSelectionMode: s.zoomToSelectionMode,
          selectedNodeId: s.selectedNodeId,
          selectedEdgeId: s.selectedEdgeId,
          selectedGroupId: s.selectedGroupId,
          selectedNodeIds: s.selectedNodeIds,
          selectedEdgeIds: s.selectedEdgeIds,
          selectedGroupIds: s.selectedGroupIds,
        }
      },
      (next, prev) => {
        if (restoring) return

        if (prev?.docKey && prev.docKey !== next.docKey) {
          pending = {
            key: prev.docKey,
            ref: prev.docRef,
            state: {
              canvasRenderMode: prev.canvasRenderMode,
              canvas3dMode: prev.canvas3dMode,
              canvas2dRenderer: prev.canvas2dRenderer,
              documentSemanticMode: prev.documentSemanticMode,
              frontmatterModeEnabled: prev.frontmatterModeEnabled,
              viewPinned: prev.viewPinned,
              fitToScreenMode: prev.fitToScreenMode,
              zoomToSelectionMode: prev.zoomToSelectionMode,
              selectedNodeId: prev.selectedNodeId,
              selectedEdgeId: prev.selectedEdgeId,
              selectedGroupId: prev.selectedGroupId,
              selectedNodeIds: prev.selectedNodeIds,
              selectedEdgeIds: prev.selectedEdgeIds,
              selectedGroupIds: prev.selectedGroupIds,
            },
          }
          schedulePersist()
        }

        if (next.documentStructureBaselineLock === true) return
        if (prev?.docKey === next.docKey) {
          pending = {
            key: next.docKey,
            ref: next.docRef,
            state: {
              canvasRenderMode: next.canvasRenderMode,
              canvas3dMode: next.canvas3dMode,
              canvas2dRenderer: next.canvas2dRenderer,
              documentSemanticMode: next.documentSemanticMode,
              frontmatterModeEnabled: next.frontmatterModeEnabled,
              viewPinned: next.viewPinned,
              fitToScreenMode: next.fitToScreenMode,
              zoomToSelectionMode: next.zoomToSelectionMode,
              selectedNodeId: next.selectedNodeId,
              selectedEdgeId: next.selectedEdgeId,
              selectedGroupId: next.selectedGroupId,
              selectedNodeIds: next.selectedNodeIds,
              selectedEdgeIds: next.selectedEdgeIds,
              selectedGroupIds: next.selectedGroupIds,
            },
          }
          schedulePersist()
        }
      },
    )

    useGraphStore.subscribe(
      s => ({
        docKey: buildDocumentKey({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
        docRef: buildDocumentRef({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
        documentStructureBaselineLock: s.documentStructureBaselineLock,
      }),
      (next, prev) => {
        if (next.docKey === prev?.docKey) return
        if (next.documentStructureBaselineLock === true) return
        const saved = readPerDocumentUiState({ documentKey: next.docKey })
        if (!saved) return

        const api = useGraphStore.getState()
        restoring = true
        try {
          if (saved.documentSemanticMode) api.setDocumentSemanticMode(saved.documentSemanticMode)
          if (typeof saved.frontmatterModeEnabled === 'boolean') api.setFrontmatterModeEnabled(saved.frontmatterModeEnabled)
          if (saved.canvasRenderMode) api.setCanvasRenderMode(saved.canvasRenderMode)
          if (saved.canvas3dMode) api.setCanvas3dMode(saved.canvas3dMode)
          if (saved.canvas2dRenderer) api.setCanvas2dRenderer(saved.canvas2dRenderer)

          const pinned = saved.viewPinned === true
          api.setViewPinned(pinned)
          if (!pinned) {
            const zoomSel = saved.zoomToSelectionMode === true
            const fit = !zoomSel && saved.fitToScreenMode === true
            api.setZoomToSelectionMode(zoomSel)
            api.setFitToScreenMode(fit)
            if (!zoomSel && !fit) {
              api.setZoomToSelectionMode(false)
              api.setFitToScreenMode(false)
            }
          }

          const nodeIds = Array.isArray(saved.selectedNodeIds) ? saved.selectedNodeIds : []
          const edgeIds = Array.isArray(saved.selectedEdgeIds) ? saved.selectedEdgeIds : []
          const groupIds = Array.isArray(saved.selectedGroupIds) ? saved.selectedGroupIds : []
          if (nodeIds.length > 0 || edgeIds.length > 0 || groupIds.length > 0) {
            api.setSelectionSource('canvas')
            api.selectNodesExpanded({
              nodeIds,
              edgeIds,
              groupIds,
              activeNodeId: typeof saved.selectedNodeId === 'string' ? saved.selectedNodeId : null,
            })
          } else {
            api.selectNode(null)
          }
        } finally {
          restoring = false
        }

        const current = useGraphStore.getState()

        pending = {
          key: next.docKey,
          ref: next.docRef,
          state: {
            documentRef: next.docRef,
            canvasRenderMode: current.canvasRenderMode,
            canvas3dMode: current.canvas3dMode,
            canvas2dRenderer: current.canvas2dRenderer,
            documentSemanticMode: current.documentSemanticMode,
            frontmatterModeEnabled: current.frontmatterModeEnabled,
            viewPinned: current.viewPinned,
            fitToScreenMode: current.fitToScreenMode,
            zoomToSelectionMode: current.zoomToSelectionMode,
            selectedNodeId: current.selectedNodeId,
            selectedEdgeId: current.selectedEdgeId,
            selectedGroupId: current.selectedGroupId,
            selectedNodeIds: current.selectedNodeIds,
            selectedEdgeIds: current.selectedEdgeIds,
            selectedGroupIds: current.selectedGroupIds,
          },
        }
        schedulePersist()
      },
    )
  }
} catch {
  void 0
}
