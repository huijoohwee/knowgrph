import type { GraphState, CanvasSnapshotFns } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import type { ZoomCommandType, ZoomFitIntent, ZoomRequest } from '@/lib/zoom/requests'

type SetGraph = StoreApi<GraphState>['setState']

export const createCanvasSlice = (set: SetGraph, get: () => GraphState) => ({
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
  viewPinned: false as boolean,
  setViewPinned: (v: boolean) =>
    set(state => {
      const nextPinned = !!v
      if (nextPinned) {
        return {
          viewPinned: true,
          fitToScreenMode: false,
          zoomToSelectionMode: false,
          zoomRequest: null,
        }
      }
      const z = state.zoomState
      const nextZoomState = z ? { ...z, graphDataRevision: state.graphDataRevision } : z
      return { viewPinned: false, zoomState: nextZoomState }
    }),
  toggleViewPinned: () => {
    const current = get().viewPinned
    get().setViewPinned(!current)
  },
  fitToScreenMode: true as boolean,
  setFitToScreenMode: (v: boolean) =>
    set(state => {
      const next = !!v
      if (!next) {
        if (!state.fitToScreenMode) return {}
        return { fitToScreenMode: false }
      }
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
  zoomToSelectionMode: false as boolean,
  setZoomToSelectionMode: (v: boolean) =>
    set(state => {
      const next = !!v
      if (!next) {
        if (!state.zoomToSelectionMode) return {}
        return { zoomToSelectionMode: false }
      }
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
      if (state.viewPinned && type === 'selection') return {}
      if (type === 'fit') {
        const intent: ZoomFitIntent = opts?.intent || 'fitToView'
        return { zoomRequest: { type: 'fit', intent, at: Date.now() } }
      }
      return { zoomRequest: { type, at: Date.now() } as ZoomRequest }
    }),
  requestZoomTransform: (payload: { k: number; x: number; y: number }) =>
    set({ zoomRequest: { type: 'transform', at: Date.now(), payload } }),
  clearZoomRequest: () => set({ zoomRequest: null }),
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
    set(state => {
      if (state.viewPinned && type === 'selection') return {}
      return { threeCameraRequest: { type, at: Date.now() } }
    }),
  clearThreeCameraRequest: () => set({ threeCameraRequest: null }),
  edgeCreationRequest: null as null | { type: 'create' | 'update-source' | 'update-target'; fromId: string; at: number },
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => set({ edgeCreationRequest: { ...req, at: Date.now() } }),
  clearEdgeCreationRequest: () => set({ edgeCreationRequest: null }),
  canvasRenderMode: '2d' as '2d' | '3d',
  canvasRenderModeLastFree: '2d' as '2d' | '3d',
  canvasRenderModeIsAuto: false as boolean,
  setCanvasRenderMode: (m: '2d' | '3d') =>
    set(state => {
      const requested = m === '3d' ? '3d' : '2d'
      const layoutMode = state.schema?.layout?.mode
      const enforce2d = layoutMode === 'radial' || layoutMode === 'stratify'
      if (enforce2d) {
        if (requested === '3d') {
          const nextLastFree = state.canvasRenderMode === '3d' ? '3d' : (state.canvasRenderModeLastFree || '2d')
          return { canvasRenderMode: '2d', canvasRenderModeLastFree: nextLastFree, canvasRenderModeIsAuto: true }
        }
        return { canvasRenderMode: '2d', canvasRenderModeIsAuto: false }
      }
      return { canvasRenderMode: requested, canvasRenderModeLastFree: requested, canvasRenderModeIsAuto: false }
    }),
  canvasSnapshotFns: {} as { '2d'?: CanvasSnapshotFns; '3d'?: CanvasSnapshotFns },
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: CanvasSnapshotFns | null) =>
    set(state => ({
      canvasSnapshotFns: {
        ...state.canvasSnapshotFns,
        [mode]: fns || undefined,
      },
    })),
  captureCanvasPngSnapshot: async (mode?: '2d' | '3d') => {
    const state = get();
    const m = mode || state.canvasRenderMode;
    const fns = state.canvasSnapshotFns?.[m];
    if (fns?.capturePng) {
      return fns.capturePng();
    }
    return null;
  },
  captureCanvasSvgSnapshot: async () => {
    const state = get();
    const fns = state.canvasSnapshotFns?.['2d'];
    if (fns?.captureSvg) {
      return fns.captureSvg();
    }
    return null;
  },
});
