import type { GraphState, CanvasSnapshotFns, ThreeCameraPose, ThreeCameraSnapshotFns, ThreeGlbSnapshotFns, ThreeLayoutSnapshotFns } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import type { ZoomCommandType, ZoomFitIntent, ZoomRequest } from '@/lib/zoom/requests'
import {
  LS_KEYS,
  DEFAULT_CANVAS_2D_RENDERER,
  DEFAULT_VIEWPORT_CONTROLS_PRESET,
  DEFAULT_INFINITE_CANVAS_INTERACTION_MODE,
  DEFAULT_CANVAS_WORKSPACE_SYNC_MODE,
  UI_COPY,
} from '@/lib/config'
import { getLocalStorage, lsBool, lsFloat, lsInt, lsJson, lsSetBool, lsSetFloat, lsSetInt, lsSetJson } from '@/lib/persistence'
import { coerceViewportControlsPreset } from '@/lib/canvas/viewport-controls'
import type { Canvas2dRendererId, CanvasWorkspaceSyncMode, InfiniteCanvasInteractionMode } from '@/lib/config'
import {
  FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS,
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MAX,
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MIN,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
  clampFlowWheelZoomSmoothDurationMs,
  clampFlowWheelZoomIncrementMultiplier,
  clampFlowWheelZoomSpeedMultiplier,
  coerceFlowWheelZoomSmoothRange,
} from '@/lib/canvas/flow-zoom-tuning'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { buildSchemaLayoutEngineJson2d } from '@/lib/canvas/schema-layout-engine-json'
import { buildLayoutPositionCacheKey, buildLayoutViewKey, computeLayoutDatasetKey } from '@/lib/canvas/layoutPositioning'
import { pickSeedFromOtherRendererCache } from '@/lib/canvas/layoutSeed'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { readLayoutMode2d } from '@/lib/graph/layoutMode'
import {
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
  CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
  clampCanvasWheelZoomCtrlMetaBoostMultiplier,
} from '@/lib/canvas/zoom-input'
import {
  CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT,
  CANVAS_INTERACTION_SPEED_MULTIPLIER_MAX,
  CANVAS_INTERACTION_SPEED_MULTIPLIER_MIN,
  CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT,
  CANVAS_PAN_SPEED_MULTIPLIER_MAX,
  CANVAS_PAN_SPEED_MULTIPLIER_MIN,
  clampCanvasInteractionSpeedMultiplier,
  clampCanvasPanSpeedMultiplier,
} from '@/lib/canvas/camera-options-2d'

type SetGraph = StoreApi<GraphState>['setState']

export const createCanvasSlice = (set: SetGraph, get: () => GraphState) => {
  const storage = getLocalStorage()
  const flowZoomDefaultsVersion = lsInt(LS_KEYS.flowWheelZoomDefaultsVersion, 0)
  if (flowZoomDefaultsVersion < 3) {
    const rawFlowSpeed = storage?.getItem(LS_KEYS.flowWheelZoomSpeedMultiplier)
    const parsedFlowSpeed = rawFlowSpeed != null ? parseFloat(rawFlowSpeed) : null
    if (
      rawFlowSpeed == null
      || (
        parsedFlowSpeed != null
        && Number.isFinite(parsedFlowSpeed)
        && (Math.abs(parsedFlowSpeed - 0.25) < 1e-6 || Math.abs(parsedFlowSpeed - 0.333) < 1e-6 || Math.abs(parsedFlowSpeed - 0.6) < 1e-6)
      )
    ) {
      lsSetFloat(LS_KEYS.flowWheelZoomSpeedMultiplier, FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT, {
        min: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
        max: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
      })
    }

    const rawCtrlMetaBoost = storage?.getItem(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier)
    const parsedCtrlMetaBoost = rawCtrlMetaBoost != null ? parseFloat(rawCtrlMetaBoost) : null
    if (
      rawCtrlMetaBoost == null
      || (
        parsedCtrlMetaBoost != null
        && Number.isFinite(parsedCtrlMetaBoost)
        && (Math.abs(parsedCtrlMetaBoost - 12) < 1e-6 || Math.abs(parsedCtrlMetaBoost - 16) < 1e-6 || Math.abs(parsedCtrlMetaBoost - 80) < 1e-6)
      )
    ) {
      lsSetFloat(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT, {
        min: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
        max: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
      })
    }

    lsSetInt(LS_KEYS.flowWheelZoomDefaultsVersion, 3)
  }

  const initialCanvas2dRenderer = lsJson(LS_KEYS.canvas2dRenderer, DEFAULT_CANVAS_2D_RENDERER, (v): Canvas2dRendererId =>
    v === 'flow' || v === 'd3' || v === 'd3Bipartite' || v === 'flowEditor' || v === 'design' ? v : DEFAULT_CANVAS_2D_RENDERER,
  )
  const initialViewportControlsPresetStored = lsJson(
    LS_KEYS.viewportControlsPreset,
    DEFAULT_VIEWPORT_CONTROLS_PRESET,
    v => coerceViewportControlsPreset(v),
  )
  const initialViewportControlsPreset = initialViewportControlsPresetStored

  const initialFlowEditorSelectionOnDrag = lsBool(LS_KEYS.flowEditorSelectionOnDrag, false)
  const initialFlowEditorOverlayWheelProxyEnabled = lsBool(LS_KEYS.flowEditorOverlayWheelProxyEnabled, true)

  const initialInfiniteCanvasInteractionMode = lsJson(
    LS_KEYS.infiniteCanvasInteractionMode,
    DEFAULT_INFINITE_CANVAS_INTERACTION_MODE,
    (v): InfiniteCanvasInteractionMode => (v === 'interactive' ? 'interactive' : 'static'),
  )
  const initialCanvasWorkspaceSyncMode = lsJson(
    LS_KEYS.canvasWorkspaceSyncMode,
    DEFAULT_CANVAS_WORKSPACE_SYNC_MODE,
    (v): CanvasWorkspaceSyncMode => (v === 'realtime' ? 'realtime' : 'manual'),
  )

  const initialPinnedStored = lsBool(LS_KEYS.viewportPinned, false)
  const initialFitToScreenStored = lsBool(LS_KEYS.viewportFitToScreen, true)
  const initialZoomToSelectionStored = lsBool(LS_KEYS.viewportZoomToSelection, false)
  const initialZoomModes = (() => {
    if (initialPinnedStored) {
      return { viewPinned: true, fitToScreenMode: false, zoomToSelectionMode: false }
    }
    if (initialZoomToSelectionStored) {
      return { viewPinned: false, fitToScreenMode: false, zoomToSelectionMode: true }
    }
    if (initialFitToScreenStored) {
      return { viewPinned: false, fitToScreenMode: true, zoomToSelectionMode: false }
    }
    return { viewPinned: false, fitToScreenMode: false, zoomToSelectionMode: false }
  })()

  const initialFlowWheelZoomSpeedMultiplier = clampFlowWheelZoomSpeedMultiplier(
    lsFloat(LS_KEYS.flowWheelZoomSpeedMultiplier, FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT, {
      min: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
      max: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
    }),
  )
  const initialFlowWheelZoomIncrementMultiplier = clampFlowWheelZoomIncrementMultiplier(
    lsFloat(LS_KEYS.flowWheelZoomIncrementMultiplier, FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT, {
      min: FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MIN,
      max: FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MAX,
    }),
  )
  const initialSmooth = coerceFlowWheelZoomSmoothRange({
    minMs: clampFlowWheelZoomSmoothDurationMs(lsInt(LS_KEYS.flowWheelZoomSmoothMinDurationMs, FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS)),
    maxMs: clampFlowWheelZoomSmoothDurationMs(lsInt(LS_KEYS.flowWheelZoomSmoothMaxDurationMs, FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS)),
  })
  const initialFlowWheelZoomSmoothMinDurationMs = initialSmooth.minMs
  const initialFlowWheelZoomSmoothMaxDurationMs = initialSmooth.maxMs

  const initialZoomDurationFitMs = Math.max(0, Math.min(2000, lsInt(LS_KEYS.zoomDurationFitMs, 300)))
  const initialZoomDurationSelectionMs = Math.max(0, Math.min(2000, lsInt(LS_KEYS.zoomDurationSelectionMs, 300)))
  const initialWheelZoomCtrlMetaBoostMultiplier = clampCanvasWheelZoomCtrlMetaBoostMultiplier(
    lsFloat(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_DEFAULT, {
      min: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
      max: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
    }),
  )
  const initialCanvasInteractionSpeedMultiplier = clampCanvasInteractionSpeedMultiplier(
    lsFloat(LS_KEYS.canvasInteractionSpeedMultiplier, CANVAS_INTERACTION_SPEED_MULTIPLIER_DEFAULT, {
      min: CANVAS_INTERACTION_SPEED_MULTIPLIER_MIN,
      max: CANVAS_INTERACTION_SPEED_MULTIPLIER_MAX,
    }),
  )
  const initialCanvasPanSpeedMultiplier = clampCanvasPanSpeedMultiplier(
    lsFloat(LS_KEYS.canvasPanSpeedMultiplier, CANVAS_PAN_SPEED_MULTIPLIER_DEFAULT, {
      min: CANVAS_PAN_SPEED_MULTIPLIER_MIN,
      max: CANVAS_PAN_SPEED_MULTIPLIER_MAX,
    }),
  )

  return {
  canvasDims: { w: 800, h: 600 } as { w: number; h: number },
  canvasPos: { x: 0, y: 0 } as { x: number; y: number },
  setCanvasDims: (d: { w: number; h: number }) => {
    const next = { w: Math.max(1, d.w), h: Math.max(1, d.h) }
    const cur = get().canvasDims
    if (cur.w === next.w && cur.h === next.h) return
    set({ canvasDims: next })
  },
  setCanvasPos: (p: { x: number; y: number }) => {
    const next = { x: Math.max(0, p.x), y: Math.max(0, p.y) }
    const cur = get().canvasPos
    if (cur.x === next.x && cur.y === next.y) return
    set({ canvasPos: next })
  },
  viewPinned: initialZoomModes.viewPinned as boolean,
  setViewPinned: (v: boolean) =>
    set(state => {
      const nextPinned = !!v
      if (nextPinned) {
        lsSetBool(LS_KEYS.viewportPinned, true)
        lsSetBool(LS_KEYS.viewportFitToScreen, false)
        lsSetBool(LS_KEYS.viewportZoomToSelection, false)
        return {
          viewPinned: true,
          fitToScreenMode: false,
          zoomToSelectionMode: false,
          zoomRequest: null,
        }
      }
      lsSetBool(LS_KEYS.viewportPinned, false)
      const z = state.zoomState
      const nextZoomState = z ? { ...z, graphDataRevision: state.graphDataRevision } : z
      return { viewPinned: false, zoomState: nextZoomState }
    }),
  toggleViewPinned: () => {
    const current = get().viewPinned
    get().setViewPinned(!current)
  },
  fitToScreenMode: initialZoomModes.fitToScreenMode as boolean,
  setFitToScreenMode: (v: boolean) =>
    set(state => {
      const next = !!v
      if (!next) {
        if (!state.fitToScreenMode) return {}
        lsSetBool(LS_KEYS.viewportFitToScreen, false)
        return { fitToScreenMode: false }
      }
      lsSetBool(LS_KEYS.viewportPinned, false)
      lsSetBool(LS_KEYS.viewportFitToScreen, true)
      lsSetBool(LS_KEYS.viewportZoomToSelection, false)
      return {
        viewPinned: false,
        fitToScreenMode: true,
        zoomToSelectionMode: false,
      }
    }),
  toggleFitToScreenMode: () => {
    const current = get().fitToScreenMode
    get().setFitToScreenMode(!current)
  },
  zoomToSelectionMode: initialZoomModes.zoomToSelectionMode as boolean,
  setZoomToSelectionMode: (v: boolean) =>
    set(state => {
      const next = !!v
      if (!next) {
        if (!state.zoomToSelectionMode) return {}
        lsSetBool(LS_KEYS.viewportZoomToSelection, false)
        return { zoomToSelectionMode: false }
      }
      lsSetBool(LS_KEYS.viewportPinned, false)
      lsSetBool(LS_KEYS.viewportFitToScreen, false)
      lsSetBool(LS_KEYS.viewportZoomToSelection, true)
      return {
        viewPinned: false,
        zoomToSelectionMode: true,
        fitToScreenMode: false,
      }
    }),
  toggleZoomToSelectionMode: () => {
    const current = get().zoomToSelectionMode
    get().setZoomToSelectionMode(!current)
  },
  zoomRequest: null as ZoomRequest | null,
  requestZoom: (type: ZoomCommandType, opts?: { intent?: ZoomFitIntent }) =>
    set(state => {
      const isAutoFit = type === 'fit' && (opts?.intent || 'fitToView') === 'fitToScreen'
      const shouldDisableAutoModes = !state.viewPinned && !isAutoFit && (type === 'in' || type === 'out' || type === 'reset' || type === 'selection' || type === 'fit')
      const modePatch = (() => {
        if (!shouldDisableAutoModes) return {}
        if (!state.fitToScreenMode && !state.zoomToSelectionMode) return {}
        try {
          lsSetBool(LS_KEYS.viewportFitToScreen, false)
          lsSetBool(LS_KEYS.viewportZoomToSelection, false)
        } catch {
          void 0
        }
        return { fitToScreenMode: false, zoomToSelectionMode: false }
      })()
      if (type === 'fit') {
        const intent: ZoomFitIntent = opts?.intent || 'fitToView'
        return { ...modePatch, zoomRequest: { type: 'fit', intent, at: Date.now() } }
      }
      return { ...modePatch, zoomRequest: { type, at: Date.now() } as ZoomRequest }
    }),
  requestZoomTransform: (payload: { k: number; x: number; y: number }) =>
    set({ zoomRequest: { type: 'transform', at: Date.now(), payload } }),
  requestZoomBounds: (payload: { bounds: { x: number; y: number; w: number; h: number }; insetPx?: number; origin?: { x: number; y: number } }) =>
    set({ zoomRequest: { type: 'bounds', at: Date.now(), payload } }),
  clearZoomRequest: () => set({ zoomRequest: null }),

  canvasPointerMode2d: 'select' as 'select' | 'pan',
  canvasPointerMode2dByRenderer: { [initialCanvas2dRenderer]: 'select' } as Partial<Record<Canvas2dRendererId, 'select' | 'pan'>>,
  setCanvasPointerMode2d: (mode: 'select' | 'pan') => {
    const next = mode === 'pan' ? 'pan' : 'select'
    const cur = get().canvasPointerMode2d
    if (cur === next) return
    set(state => {
      const renderer = state.canvas2dRenderer
      const by = state.canvasPointerMode2dByRenderer || {}
      const nextBy = renderer ? { ...by, [renderer]: next } : by
      return { canvasPointerMode2d: next, canvasPointerMode2dByRenderer: nextBy }
    })
  },

  graphCanvasArrangeRequest: null as null | (
    | { type: 'center'; scope: 'selection' | 'all'; at: number }
    | { type: 'distribute'; axis: 'x' | 'y'; at: number }
  ),
  requestGraphCanvasArrange: (req: { type: 'center'; scope: 'selection' | 'all' } | { type: 'distribute'; axis: 'x' | 'y' }) =>
    set({ graphCanvasArrangeRequest: { ...req, at: Date.now() } }),
  clearGraphCanvasArrangeRequest: () => set({ graphCanvasArrangeRequest: null }),
  zoomState: null as null | { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number },
  setZoomState: (z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }) => set({ zoomState: z }),
  zoomStateByKey: {} as Record<string, { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }>,
  setZoomStateForKey: (
    key: string,
    z: { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number } | null,
  ) =>
    set(state => {
      const k = String(key || '')
      if (!k) return {}
      if (!z) {
        if (!state.zoomStateByKey[k]) return {}
        const next = { ...state.zoomStateByKey }
        delete next[k]
        return { zoomStateByKey: next }
      }
      const prev = state.zoomStateByKey[k]
      if (prev && prev.k === z.k && prev.x === z.x && prev.y === z.y && prev.graphDataRevision === z.graphDataRevision && prev.viewportW === z.viewportW && prev.viewportH === z.viewportH) {
        return {}
      }
      return { zoomStateByKey: { ...state.zoomStateByKey, [k]: z } }
    }),
  threeCameraRequest: null as null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number },
  requestThreeCamera: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') =>
    set({ threeCameraRequest: { type, at: Date.now() } }),
  clearThreeCameraRequest: () => set({ threeCameraRequest: null }),
  edgeCreationRequest: null as null | { type: 'create' | 'update-source' | 'update-target'; fromId: string; at: number },
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => set({ edgeCreationRequest: { ...req, at: Date.now() } }),
  clearEdgeCreationRequest: () => set({ edgeCreationRequest: null }),
  canvasRenderMode: '2d' as '2d' | '3d',
  canvas2dRenderer: initialCanvas2dRenderer,
  viewportControlsPreset: initialViewportControlsPreset,
  infiniteCanvasInteractionMode: initialInfiniteCanvasInteractionMode,
  canvasWorkspaceSyncMode: initialCanvasWorkspaceSyncMode,
  flowEditorSelectionOnDrag: initialFlowEditorSelectionOnDrag,
  flowEditorOverlayWheelProxyEnabled: initialFlowEditorOverlayWheelProxyEnabled,
  flowWheelZoomSpeedMultiplier: initialFlowWheelZoomSpeedMultiplier,
  flowWheelZoomIncrementMultiplier: initialFlowWheelZoomIncrementMultiplier,
  flowWheelZoomSmoothMinDurationMs: initialFlowWheelZoomSmoothMinDurationMs,
  flowWheelZoomSmoothMaxDurationMs: initialFlowWheelZoomSmoothMaxDurationMs,
  zoomDurationFitMs: initialZoomDurationFitMs,
  zoomDurationSelectionMs: initialZoomDurationSelectionMs,
  wheelZoomCtrlMetaBoostMultiplier: initialWheelZoomCtrlMetaBoostMultiplier,
  canvasInteractionSpeedMultiplier: initialCanvasInteractionSpeedMultiplier,
  canvasPanSpeedMultiplier: initialCanvasPanSpeedMultiplier,
  canvasRenderModeLastFree: '2d' as '2d' | '3d',
  canvasRenderModeIsAuto: false as boolean,
  setCanvasRenderMode: (m: '2d' | '3d') => {
    const prevMode = get().canvasRenderMode
    const cur = get()
    if (cur.documentStructureBaselineLock === true) {
      if (cur.canvasRenderMode !== '2d') {
        set({ canvasRenderMode: '2d', canvasRenderModeLastFree: '2d', canvasRenderModeIsAuto: false })
        return
      }
      cur.upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    set(state => {
      const requested = m === '3d' ? '3d' : '2d'
      const layoutMode = state.schema?.layout?.mode
      const enforce2d = layoutMode === 'radial'
      if (enforce2d) {
        if (requested === '3d') {
          const nextLastFree = state.canvasRenderMode === '3d' ? '3d' : (state.canvasRenderModeLastFree || '2d')
          if (
            state.canvasRenderMode === '2d' &&
            state.canvasRenderModeLastFree === nextLastFree &&
            state.canvasRenderModeIsAuto === true
          ) {
            return {}
          }
          return { canvasRenderMode: '2d', canvasRenderModeLastFree: nextLastFree, canvasRenderModeIsAuto: true }
        }
        if (state.canvasRenderMode === '2d' && state.canvasRenderModeIsAuto === false) return {}
        return { canvasRenderMode: '2d', canvasRenderModeIsAuto: false }
      }
      if (
        state.canvasRenderMode === requested &&
        state.canvasRenderModeLastFree === requested &&
        state.canvasRenderModeIsAuto === false
      ) {
        return {}
      }
      return { canvasRenderMode: requested, canvasRenderModeLastFree: requested, canvasRenderModeIsAuto: false }
    })

    const nextMode = get().canvasRenderMode
    if (prevMode === '3d' && nextMode === '2d') {
      const st = get()
      const nodes = Array.isArray(st.graphData?.nodes) ? st.graphData.nodes : []
      if (nodes.length > 0) {
        const posPatch: Record<string, { x: number; y: number }> = {}
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i] as any
          const id = String(n?.id || '').trim()
          if (!id) continue
          const p = (n?.properties || {})['pos3d']
          if (!Array.isArray(p) || p.length !== 3) continue
          const x = typeof p[0] === 'number' ? p[0] : Number.NaN
          const y = typeof p[1] === 'number' ? p[1] : Number.NaN
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue
          posPatch[id] = { x, y }
        }

        if (Object.keys(posPatch).length > 0) {
          const semanticMode = String(st.documentSemanticMode || 'document')
          const graphDataForView = (st.graphData as unknown as { metadata?: unknown; nodes?: Array<{ type?: unknown; properties?: unknown; metadata?: unknown }> } | null) || null
          const frontmatter = computeEffectiveFrontmatterMode({
            frontmatterModeEnabled: st.frontmatterModeEnabled === true && st.documentStructureBaselineLock !== true,
            documentSemanticMode: semanticMode,
            graphData: (st.graphData as any) || null,
          })
          const datasetKey = computeLayoutDatasetKey({ graphData: graphDataForView, graphDataRevision: st.graphDataRevision || 0 })
          const mode = st.schema ? readLayoutMode2d(st.schema) : 'force'
          const graphMetaKey = buildGraphMetaKeyIgnoringPending((st.graphData as any) || null)
          const collapsedGroupIdsKey = buildCollapsedGroupIdsKey(st.collapsedGroupIds)
          const schemaLayoutEngineJson = buildSchemaLayoutEngineJson2d(st.schema || null)
          const viewKey = buildLayoutViewKey({
            schemaLayoutEngineJson,
            frontmatterModeEnabled: frontmatter,
            documentSemanticMode: semanticMode,
            graphMetaKey,
            renderMediaAsNodes: st.renderMediaAsNodes === true,
            mediaPanelDensity: String(st.mediaPanelDensity),
            collapsedGroupIdsKey,
          })
          const baseKey = buildLayoutPositionCacheKey({
            datasetKey,
            mode,
            frontmatterMode: frontmatter,
            semanticMode,
            renderMode: '2d',
            viewKey,
          })
          const seed = pickSeedFromOtherRendererCache({
            nodes: nodes as any,
            cache: (st.layoutPositionCacheByMode as any) || null,
            baseKey,
          })
          const merged = { ...(seed || {}) }
          for (const [id, p] of Object.entries(posPatch)) {
            merged[id] = p
          }
          try {
            st.setLayoutPositionsForMode(baseKey as any, merged)
          } catch {
            void 0
          }
        }
      }
    }
  },
  setCanvas2dRenderer: (id: Canvas2dRendererId) => {
    const cur = get()
    if (cur.documentStructureBaselineLock === true) {
      cur.upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    set(state => {
      const next: Canvas2dRendererId =
        id === 'flow' || id === 'flowEditor' || id === 'design' || id === 'd3Bipartite' ? id : 'd3'
      if (state.canvas2dRenderer === next) return {}
      lsSetJson(LS_KEYS.canvas2dRenderer, next)

      const common = {
        canvasRenderMode: state.canvasRenderMode,
        schema: state.schema,
        graphData: state.graphData,
        documentSemanticMode: state.documentSemanticMode,
        frontmatterModeEnabled: state.frontmatterModeEnabled,
        documentStructureBaselineLock: state.documentStructureBaselineLock,
        renderMediaAsNodes: state.renderMediaAsNodes,
        mediaPanelDensity: state.mediaPanelDensity,
        collapsedGroupIds: state.collapsedGroupIds,
      }
      const prevZoomKey = buildActive2dZoomViewKey({ ...common, canvas2dRenderer: state.canvas2dRenderer })
      const nextZoomKey = buildActive2dZoomViewKey({ ...common, canvas2dRenderer: next })
      void prevZoomKey
      void nextZoomKey
      const zoomStateByKey = state.zoomStateByKey

      const pointerBy = state.canvasPointerMode2dByRenderer || {}
      const nextPointerBy = { ...pointerBy, [state.canvas2dRenderer]: state.canvasPointerMode2d }
      const nextPointer = nextPointerBy[next] || 'select'

      const quickEditorBy = state.openQuickEditorNodeIdsByRenderer || {}
      const nextQuickEditorBy = { ...quickEditorBy, [state.canvas2dRenderer]: state.openQuickEditorNodeIds || [] }
      const nextQuickEditors = nextQuickEditorBy[next] || []

      return {
        canvas2dRenderer: next,
        zoomStateByKey,
        canvasPointerMode2d: nextPointer,
        canvasPointerMode2dByRenderer: nextPointerBy,
        openQuickEditorNodeIds: nextQuickEditors,
        openQuickEditorNodeIdsByRenderer: nextQuickEditorBy,
      }
    })
  },
  setViewportControlsPreset: (preset) => {
    const next = coerceViewportControlsPreset(preset)
    const cur = get().viewportControlsPreset
    if (cur === next) return
    lsSetJson(LS_KEYS.viewportControlsPreset, next)
    set({ viewportControlsPreset: next })
  },
  setInfiniteCanvasInteractionMode: (mode: InfiniteCanvasInteractionMode) => {
    const next: InfiniteCanvasInteractionMode = mode === 'interactive' ? 'interactive' : 'static'
    const cur = get().infiniteCanvasInteractionMode
    if (cur === next) return
    try {
      lsSetJson(LS_KEYS.infiniteCanvasInteractionMode, next)
    } catch {
      void 0
    }
    set({ infiniteCanvasInteractionMode: next })
  },
  setCanvasWorkspaceSyncMode: (mode: CanvasWorkspaceSyncMode) => {
    const next: CanvasWorkspaceSyncMode = mode === 'realtime' ? 'realtime' : 'manual'
    const cur = get().canvasWorkspaceSyncMode
    if (cur === next) return
    try {
      lsSetJson(LS_KEYS.canvasWorkspaceSyncMode, next)
    } catch {
      void 0
    }
    set({ canvasWorkspaceSyncMode: next })
  },
  setFlowEditorSelectionOnDrag: (v: boolean) => {
    const next = Boolean(v)
    const cur = get().flowEditorSelectionOnDrag === true
    if (cur === next) return
    lsSetBool(LS_KEYS.flowEditorSelectionOnDrag, next)
    set({ flowEditorSelectionOnDrag: next })
  },
  setFlowEditorOverlayWheelProxyEnabled: (v: boolean) => {
    const next = Boolean(v)
    const cur = get().flowEditorOverlayWheelProxyEnabled === true
    if (cur === next) return
    lsSetBool(LS_KEYS.flowEditorOverlayWheelProxyEnabled, next)
    set({ flowEditorOverlayWheelProxyEnabled: next })
  },
  setFlowWheelZoomSpeedMultiplier: (v: number) => {
    const next = clampFlowWheelZoomSpeedMultiplier(
      lsSetFloat(LS_KEYS.flowWheelZoomSpeedMultiplier, Number(v), {
        min: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MIN,
        max: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_MAX,
      }),
    )
    const cur = get().flowWheelZoomSpeedMultiplier
    if (cur === next) return
    set({ flowWheelZoomSpeedMultiplier: next })
  },
  setFlowWheelZoomIncrementMultiplier: (v: number) => {
    const next = clampFlowWheelZoomIncrementMultiplier(
      lsSetFloat(LS_KEYS.flowWheelZoomIncrementMultiplier, Number(v), {
        min: FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MIN,
        max: FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_MAX,
      }),
    )
    const cur = get().flowWheelZoomIncrementMultiplier
    if (cur === next) return
    set({ flowWheelZoomIncrementMultiplier: next })
  },
  setFlowWheelZoomSmoothMinDurationMs: (v: number) => {
    const curMax = get().flowWheelZoomSmoothMaxDurationMs
    const nextMin = clampFlowWheelZoomSmoothDurationMs(
      lsSetInt(LS_KEYS.flowWheelZoomSmoothMinDurationMs, Number(v), {
        min: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS,
        max: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS,
      }),
    )
    const clampedMin = Math.min(nextMin, curMax)
    if (clampedMin !== nextMin) {
      lsSetInt(LS_KEYS.flowWheelZoomSmoothMinDurationMs, clampedMin, {
        min: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS,
        max: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS,
      })
    }
    const curMin = get().flowWheelZoomSmoothMinDurationMs
    if (curMin === clampedMin) return
    set({ flowWheelZoomSmoothMinDurationMs: clampedMin })
  },
  setFlowWheelZoomSmoothMaxDurationMs: (v: number) => {
    const curMin = get().flowWheelZoomSmoothMinDurationMs
    const nextMax = clampFlowWheelZoomSmoothDurationMs(
      lsSetInt(LS_KEYS.flowWheelZoomSmoothMaxDurationMs, Number(v), {
        min: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS,
        max: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS,
      }),
    )
    const clampedMax = Math.max(nextMax, curMin)
    if (clampedMax !== nextMax) {
      lsSetInt(LS_KEYS.flowWheelZoomSmoothMaxDurationMs, clampedMax, {
        min: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MIN_MS,
        max: FLOW_WHEEL_ZOOM_SMOOTH_DURATION_MAX_MS,
      })
    }
    const curMax = get().flowWheelZoomSmoothMaxDurationMs
    if (curMax === clampedMax) return
    set({ flowWheelZoomSmoothMaxDurationMs: clampedMax })
  },
  setZoomDurationFitMs: (v: number) => {
    const next = lsSetInt(LS_KEYS.zoomDurationFitMs, Number(v), { min: 0, max: 2000 })
    const cur = get().zoomDurationFitMs
    if (cur === next) return
    set({ zoomDurationFitMs: next })
  },
  setZoomDurationSelectionMs: (v: number) => {
    const next = lsSetInt(LS_KEYS.zoomDurationSelectionMs, Number(v), { min: 0, max: 2000 })
    const cur = get().zoomDurationSelectionMs
    if (cur === next) return
    set({ zoomDurationSelectionMs: next })
  },
  setWheelZoomCtrlMetaBoostMultiplier: (v: number) => {
    const next = clampCanvasWheelZoomCtrlMetaBoostMultiplier(
      lsSetFloat(LS_KEYS.wheelZoomCtrlMetaBoostMultiplier, Number(v), {
        min: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MIN,
        max: CANVAS_WHEEL_ZOOM_CTRL_META_BOOST_MULTIPLIER_MAX,
      }),
    )
    const cur = get().wheelZoomCtrlMetaBoostMultiplier
    if (cur === next) return
    set({ wheelZoomCtrlMetaBoostMultiplier: next })
  },
  setCanvasInteractionSpeedMultiplier: (v: number) => {
    const next = clampCanvasInteractionSpeedMultiplier(
      lsSetFloat(LS_KEYS.canvasInteractionSpeedMultiplier, Number(v), {
        min: CANVAS_INTERACTION_SPEED_MULTIPLIER_MIN,
        max: CANVAS_INTERACTION_SPEED_MULTIPLIER_MAX,
      }),
    )
    const cur = get().canvasInteractionSpeedMultiplier
    if (cur === next) return
    set({ canvasInteractionSpeedMultiplier: next })
  },
  setCanvasPanSpeedMultiplier: (v: number) => {
    const next = clampCanvasPanSpeedMultiplier(
      lsSetFloat(LS_KEYS.canvasPanSpeedMultiplier, Number(v), {
        min: CANVAS_PAN_SPEED_MULTIPLIER_MIN,
        max: CANVAS_PAN_SPEED_MULTIPLIER_MAX,
      }),
    )
    const cur = get().canvasPanSpeedMultiplier
    if (cur === next) return
    set({ canvasPanSpeedMultiplier: next })
  },
  canvasSnapshotFns: {} as { '2d'?: CanvasSnapshotFns; '3d'?: CanvasSnapshotFns },
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: CanvasSnapshotFns | null) =>
    set(state => ({
      canvasSnapshotFns: {
        ...state.canvasSnapshotFns,
        [mode]: fns || undefined,
      },
    })),
  captureCanvasPngSnapshot: async (mode?: '2d' | '3d', pixelRatio?: number) => {
    const state = get();
    const m = mode || state.canvasRenderMode;
    const fns = state.canvasSnapshotFns?.[m];
    if (fns?.capturePng) {
      return fns.capturePng(pixelRatio);
    }
    return null;
  },
  captureCanvasSvgSnapshot: async (mode?: '2d' | '3d') => {
    const state = get();
    const m = mode || state.canvasRenderMode;
    if (m !== '2d') return null;
    const fns = state.canvasSnapshotFns?.['2d'];
    if (fns?.captureSvg) return fns.captureSvg();
    return null;
  },
  threeCameraSnapshotFns: null as ThreeCameraSnapshotFns | null,
  registerThreeCameraSnapshotFns: (fns: ThreeCameraSnapshotFns | null) => set({ threeCameraSnapshotFns: fns || null }),
  captureThreeCameraPose: (): ThreeCameraPose | null => {
    const fns = get().threeCameraSnapshotFns
    if (!fns) return null
    try {
      return fns.capturePose()
    } catch {
      return null
    }
  },
  restoreThreeCameraPose: (pose: ThreeCameraPose | null) => {
    if (!pose) return
    const fns = get().threeCameraSnapshotFns
    if (!fns) return
    try {
      fns.restorePose(pose)
    } catch {
      void 0
    }
  },
  threeGlbSnapshotFns: null as ThreeGlbSnapshotFns | null,
  registerThreeGlbSnapshotFns: (fns: ThreeGlbSnapshotFns | null) => set({ threeGlbSnapshotFns: fns || null }),
  captureThreeGlbSnapshot: async (): Promise<Blob | null> => {
    const fns = get().threeGlbSnapshotFns
    if (!fns) return null
    try {
      return await fns.captureGlb()
    } catch {
      return null
    }
  },

  threeLayoutSnapshotFns: null,
  registerThreeLayoutSnapshotFns: (fns) => set({ threeLayoutSnapshotFns: fns || null }),
  captureThreeLayoutPositions: () => {
    const fns = get().threeLayoutSnapshotFns
    if (!fns) return null
    try {
      return fns.capturePositions()
    } catch {
      return null
    }
  },
  }
};
