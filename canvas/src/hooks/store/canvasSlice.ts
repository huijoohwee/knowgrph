import type { GraphState, CanvasSnapshotFns } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'

type SetGraph = StoreApi<GraphState>['setState']

export const createCanvasSlice = (set: SetGraph, get: () => GraphState) => ({
  canvasDims: { w: 800, h: 600 } as { w: number; h: number },
  canvasPos: { x: 0, y: 0 } as { x: number; y: number },
  setCanvasDims: (d: { w: number; h: number }) => set({ canvasDims: { w: Math.max(1, d.w), h: Math.max(1, d.h) } }),
  setCanvasPos: (p: { x: number; y: number }) => set({ canvasPos: { x: Math.max(0, p.x), y: Math.max(0, p.y) } }),
  polygonGroupsVisible: true as boolean,
  setPolygonGroupsVisible: (v: boolean) => set({ polygonGroupsVisible: !!v }),
  togglePolygonGroupsVisible: () => set(state => ({ polygonGroupsVisible: !(state.polygonGroupsVisible || false) })),
  fitToScreenMode: false as boolean,
  setFitToScreenMode: (v: boolean) => set({ fitToScreenMode: !!v }),
  toggleFitToScreenMode: () => set(state => ({ fitToScreenMode: !state.fitToScreenMode })),
  zoomToSelectionMode: false as boolean,
  setZoomToSelectionMode: (v: boolean) => set({ zoomToSelectionMode: !!v }),
  toggleZoomToSelectionMode: () => set(state => ({ zoomToSelectionMode: !state.zoomToSelectionMode })),
  zoomRequest: null as null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection' | 'transform'; at: number; payload?: { k: number; x: number; y: number } },
  requestZoom: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => set({ zoomRequest: { type, at: Date.now() } }),
  requestZoomTransform: (payload: { k: number; x: number; y: number }) => set({ zoomRequest: { type: 'transform', at: Date.now(), payload } }),
  zoomState: null as null | { k: number; x: number; y: number; graphDataRevision?: number },
  setZoomState: (z: { k: number; x: number; y: number; graphDataRevision?: number }) => set({ zoomState: z }),
  threeCameraRequest: null as null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number },
  requestThreeCamera: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => set({ threeCameraRequest: { type, at: Date.now() } }),
  clearThreeCameraRequest: () => set({ threeCameraRequest: null }),
  edgeCreationRequest: null as null | { type: 'create' | 'update-source' | 'update-target'; fromId: string; at: number },
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => set({ edgeCreationRequest: { ...req, at: Date.now() } }),
  clearEdgeCreationRequest: () => set({ edgeCreationRequest: null }),
  canvasRenderMode: '2d' as '2d' | '3d',
  setCanvasRenderMode: (m: '2d' | '3d') => set({ canvasRenderMode: m }),
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
