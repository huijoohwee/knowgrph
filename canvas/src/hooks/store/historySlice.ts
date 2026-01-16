import { GraphData } from '@/lib/graph/types';
import type { GraphState, RecentFileEntry } from '@/hooks/store/types'
import type { GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import type { StoreApi } from 'zustand';

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

type HistoryEntry = {
  id: string
  label: string
  timestamp: number
  graphData: GraphData
  graphFieldSettingsById?: GraphFieldSettingsById
}

export const createHistorySlice = (set: SetGraph, get: GetGraph) => ({
  history: [] as HistoryEntry[],
  historyIndex: -1,
  recentFiles: [] as RecentFileEntry[],
  historyDebounceMs: 500,
  historyTimer: null as ReturnType<typeof setTimeout> | null,

  addRecentFile: (entry: Omit<RecentFileEntry, 'id' | 'timestamp'>) => {
    const { recentFiles } = get()
    const newEntry: RecentFileEntry = {
      ...entry,
      id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }
    const filtered = recentFiles.filter(f => {
      if (entry.path && f.path === entry.path) return false
      if (entry.url && f.url === entry.url) return false
      if (!entry.path && !entry.url && f.name === entry.name) return false
      return true
    })
    set({ recentFiles: [newEntry, ...filtered].slice(0, 50) })
  },

  addHistory: (label: string = 'Snapshot') => {
    const { graphData, graphFieldSettingsById, history, historyIndex } = get();
    if (!graphData) return;
    const graphCopy: GraphData = JSON.parse(JSON.stringify(graphData));
    const fieldSettingsCopy: GraphFieldSettingsById = JSON.parse(JSON.stringify(graphFieldSettingsById || {}));
    const trimmed = history.slice(0, historyIndex + 1);
    const entry = {
      id: `h-${Date.now().toString(36)}`,
      label,
      timestamp: Date.now(),
      graphData: graphCopy,
      graphFieldSettingsById: fieldSettingsCopy,
    };
    set({ history: [...trimmed, entry], historyIndex: trimmed.length });
  },

  restoreHistory: (index: number) => {
    const { history, setGraphFieldSettingsById } = get();
    const entry = (history as HistoryEntry[])[index];
    if (!entry) return;
    const graphCopy: GraphData = JSON.parse(JSON.stringify(entry.graphData));
    const fieldSettingsCopy: GraphFieldSettingsById = JSON.parse(JSON.stringify(entry.graphFieldSettingsById || {}));
    set({ graphData: graphCopy, historyIndex: index });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
  },

  undoHistory: () => {
    const { historyIndex, history, setGraphFieldSettingsById } = get();
    const nextIndex = historyIndex - 1;
    if (nextIndex < 0) return;
    const entry = (history as HistoryEntry[])[nextIndex];
    if (!entry) return;
    const graphCopy: GraphData = JSON.parse(JSON.stringify(entry.graphData));
    const fieldSettingsCopy: GraphFieldSettingsById = JSON.parse(JSON.stringify(entry.graphFieldSettingsById || {}));
    set({ graphData: graphCopy, historyIndex: nextIndex });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
  },

  redoHistory: () => {
    const { historyIndex, history, setGraphFieldSettingsById } = get();
    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) return;
    const entry = (history as HistoryEntry[])[nextIndex];
    if (!entry) return;
    const graphCopy: GraphData = JSON.parse(JSON.stringify(entry.graphData));
    const fieldSettingsCopy: GraphFieldSettingsById = JSON.parse(JSON.stringify(entry.graphFieldSettingsById || {}));
    set({ graphData: graphCopy, historyIndex: nextIndex });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
  },

  scheduleHistory: (label: string) => {
    const { historyTimer, historyDebounceMs } = get();
    if (historyTimer) {
      clearTimeout(historyTimer as ReturnType<typeof setTimeout>);
    }
    const t: ReturnType<typeof setTimeout> = setTimeout(() => {
      const { graphData, graphFieldSettingsById, history, historyIndex } = get();
      if (!graphData) return;
      const graphCopy: GraphData = JSON.parse(JSON.stringify(graphData));
      const fieldSettingsCopy: GraphFieldSettingsById = JSON.parse(JSON.stringify(graphFieldSettingsById || {}));
      const trimmed = history.slice(0, historyIndex + 1);
      const entry = {
        id: `h-${Date.now().toString(36)}`,
        label,
        timestamp: Date.now(),
        graphData: graphCopy,
        graphFieldSettingsById: fieldSettingsCopy,
      };
      set({ history: [...trimmed, entry], historyIndex: trimmed.length, historyTimer: null });
    }, historyDebounceMs);
    set({ historyTimer: t });
  },

  setHistoryDebounceMs: (ms: number) => {
    const val = Math.max(0, Math.floor(ms));
    set({ historyDebounceMs: val });
  },

  replaceHistoryState: (
    history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>,
    historyIndex: number,
  ) => {
    const { historyTimer, graphData, setGraphFieldSettingsById } = get();
    if (historyTimer) {
      clearTimeout(historyTimer as ReturnType<typeof setTimeout>);
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(h => h && typeof h.id === 'string' && typeof h.label === 'string' && typeof h.timestamp === 'number' && !!h.graphData)
          .map(h => ({
            id: String(h.id),
            label: String(h.label),
            timestamp: Math.floor(h.timestamp),
            graphData: JSON.parse(JSON.stringify(h.graphData)) as GraphData,
            graphFieldSettingsById: JSON.parse(JSON.stringify(h.graphFieldSettingsById || {})) as GraphFieldSettingsById,
          }))
      : [];

    const boundedIndex = (() => {
      if (!Number.isFinite(historyIndex)) return safeHistory.length ? safeHistory.length - 1 : -1;
      const idx = Math.floor(historyIndex);
      if (idx < 0) return safeHistory.length ? safeHistory.length - 1 : -1;
      if (idx >= safeHistory.length) return safeHistory.length ? safeHistory.length - 1 : -1;
      return idx;
    })();

    const nextGraphData = boundedIndex >= 0 && safeHistory[boundedIndex] ? safeHistory[boundedIndex].graphData : graphData;
    const nextFieldSettings = boundedIndex >= 0 && safeHistory[boundedIndex] ? safeHistory[boundedIndex].graphFieldSettingsById : get().graphFieldSettingsById || {};
    set({ history: safeHistory, historyIndex: boundedIndex, historyTimer: null, graphData: nextGraphData });
    setGraphFieldSettingsById(JSON.parse(JSON.stringify(nextFieldSettings || {})) as GraphFieldSettingsById);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
  },
});
