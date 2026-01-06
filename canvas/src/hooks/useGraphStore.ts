import { create } from 'zustand';
import { defaultSchema } from '@/lib/graph/schema';
import { createGraphDataSlice } from '@/hooks/store/graphDataSlice';
import { createMinimapSlice } from '@/features/minimap/store';
import { createSelectionSlice } from '@/hooks/store/selectionSlice';
import { createHistorySlice } from '@/hooks/store/historySlice';
import { createUiSlice } from '@/hooks/store/uiSlice';
import { createCanvasSlice } from '@/hooks/store/canvasSlice';
import { createSchemaSlice, readSchemaFromStorage } from '@/hooks/store/schemaSlice';
import { getLocalStorage } from '@/lib/persistence';
import type { GraphState } from '@/hooks/store/types';

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
  lifecycleStage: 'idle',
  setLifecycleStage: (v) => set({ lifecycleStage: v }),
  resetAll: () => {
    set({
      graphData: { nodes: [], edges: [], type: 'application/json' },
      schema: defaultSchema,
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
  ...createGraphDataSlice(set, get),
  ...createMinimapSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createHistorySlice(set, get),
  ...createUiSlice(set, get),
  ...createCanvasSlice(set, get),
  ...createSchemaSlice(set, get),
}));
