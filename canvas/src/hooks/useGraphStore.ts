import { create } from 'zustand';
import { defaultSchema } from '@/lib/graph/schema';
import { createGraphDataSlice } from '@/hooks/store/graphDataSlice';
import { createMinimapSlice } from '@/features/minimap/store';
import { createSelectionSlice } from '@/hooks/store/selectionSlice';
import { createHistorySlice } from '@/hooks/store/historySlice';
import { createUiSlice } from '@/hooks/store/uiSlice';
import { createCanvasSlice } from '@/hooks/store/canvasSlice';
import { createSchemaSlice, readSchemaFromStorage } from '@/hooks/store/schemaSlice';
import { createUiSettingsSlice } from '@/hooks/store/uiSettingsSlice';
import { getLocalStorage } from '@/lib/persistence';
import type { GraphState, LayoutPositionCacheKey, NodePosition2d } from '@/hooks/store/types';

export type { GraphState } from '@/hooks/store/types';

export const useGraphStore = create<GraphState>((set, get) => ({
  schema: (() => {
    try {
      const storage = getLocalStorage();
      return readSchemaFromStorage(storage) || defaultSchema;
    } catch {
      return defaultSchema;
    }
  })(),
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
  setLayoutPositionsForMode: (key: LayoutPositionCacheKey, positions: Record<string, NodePosition2d> | null) => {
    set(s => {
      const prev = s.layoutPositionCacheByMode || {}
      if (!positions || Object.keys(positions).length === 0) {
        if (!prev || !prev[key]) return { layoutPositionCacheByMode: prev }
        const next: typeof prev = { ...prev }
        delete next[key]
        return { layoutPositionCacheByMode: next }
      }
      const next: typeof prev = { ...prev, [key]: positions }
      return { layoutPositionCacheByMode: next }
    })
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
    set({
      graphData: { nodes: [], edges: [], type: 'application/json' },
      schema: defaultSchema,
      layoutPositionCacheByMode: {},
      history: [],
      historyIndex: -1,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      graphFieldsOpOk: null,
      graphFieldsOpMsg: '',
      orchestratorOpOk: null,
      orchestratorOpMsg: '',
      renderOpOk: null,
      renderOpMsg: '',
      lifecycleStage: 'idle',
    });
  },
  ...createUiSettingsSlice(set),
  ...createGraphDataSlice(set, get),
  ...createMinimapSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createHistorySlice(set, get),
  ...createUiSlice(set),
  ...createCanvasSlice(set, get),
  ...createSchemaSlice(set, get),
}));
