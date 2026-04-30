import { GraphData } from '@/lib/graph/types';
import type { GraphState, RecentFileEntry } from '@/hooks/store/types'
import type { GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import type { StoreApi } from 'zustand';
import { withGraphDataRevision } from './graphDataSliceUtils'
import { deepClone } from '@/lib/data/deepClone'
import { debounce } from '@/lib/async/debounce'
import { persistGraphDataToLocalStorage } from './graphDataPersistence'
import { hashArrayOfObjectsSignature, hashRecordSignature } from '@/lib/hash/signature'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

type HistoryEntry = {
  id: string
  label: string
  timestamp: number
  graphData: GraphData
  graphFieldSettingsById?: GraphFieldSettingsById
  signature?: string
}

const getHistorySnapshotSignature = (
  graphData: GraphData | null,
  graphFieldSettingsById: GraphFieldSettingsById | null | undefined,
): string => {
  const safeGraph = graphData || { nodes: [], edges: [], metadata: null }
  return [
    `nodes:${hashArrayOfObjectsSignature(safeGraph.nodes || [], { maxItems: 80, maxKeysPerItem: 8 })}`,
    `edges:${hashArrayOfObjectsSignature(safeGraph.edges || [], { maxItems: 80, maxKeysPerItem: 8 })}`,
    `meta:${hashRecordSignature(safeGraph.metadata || {}, { maxEntries: 40 })}`,
    `fields:${hashRecordSignature(graphFieldSettingsById || {}, { maxEntries: 80 })}`,
  ].join('|')
}

const buildHistoryEntry = (args: {
  label: string
  timestamp: number
  graphData: GraphData
  graphFieldSettingsById: GraphFieldSettingsById
}): HistoryEntry => {
  const signature = getHistorySnapshotSignature(args.graphData, args.graphFieldSettingsById)
  return {
    id: `h-${Date.now().toString(36)}`,
    label: args.label,
    timestamp: args.timestamp,
    graphData: args.graphData,
    graphFieldSettingsById: args.graphFieldSettingsById,
    signature,
  }
}

const shouldSkipHistoryCommit = (history: HistoryEntry[], nextSignature: string): boolean => {
  const last = history.length > 0 ? history[history.length - 1] : null
  return !!last && String(last.signature || '') === nextSignature
}

export const createHistorySlice = (set: SetGraph, get: GetGraph) => ({
  
  history: [] as HistoryEntry[],
  historyIndex: -1,
  recentFiles: [] as RecentFileEntry[],
  historyDebounceMs: 500,

  

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
    const nextSignature = getHistorySnapshotSignature(graphData, graphFieldSettingsById)
    const trimmed = history.slice(0, historyIndex + 1);
    if (shouldSkipHistoryCommit(trimmed as HistoryEntry[], nextSignature)) return
    const graphCopy: GraphData = deepClone(graphData)
    const fieldSettingsCopy: GraphFieldSettingsById = deepClone(graphFieldSettingsById || {})
    const entry = buildHistoryEntry({
      label,
      timestamp: Date.now(),
      graphData: graphCopy,
      graphFieldSettingsById: fieldSettingsCopy,
    })
    set({ history: [...trimmed, entry], historyIndex: trimmed.length });
  },

  restoreHistory: (index: number) => {
    const { history, setGraphFieldSettingsById } = get();
    const entry = (history as HistoryEntry[])[index];
    if (!entry) return;
    const graphCopy: GraphData = deepClone(entry.graphData)
    const fieldSettingsCopy: GraphFieldSettingsById = deepClone(entry.graphFieldSettingsById || {})
    const nextRevision = (get().graphDataRevision || 0) + 1
    set({ graphData: withGraphDataRevision(graphCopy, nextRevision), graphDataRevision: nextRevision, historyIndex: index });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
    try {
      const persisted = get().graphData
      if (persisted) persistGraphDataToLocalStorage(persisted)
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
    const graphCopy: GraphData = deepClone(entry.graphData)
    const fieldSettingsCopy: GraphFieldSettingsById = deepClone(entry.graphFieldSettingsById || {})
    const nextRevision = (get().graphDataRevision || 0) + 1
    set({ graphData: withGraphDataRevision(graphCopy, nextRevision), graphDataRevision: nextRevision, historyIndex: nextIndex });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
    try {
      const persisted = get().graphData
      if (persisted) persistGraphDataToLocalStorage(persisted)
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
    const graphCopy: GraphData = deepClone(entry.graphData)
    const fieldSettingsCopy: GraphFieldSettingsById = deepClone(entry.graphFieldSettingsById || {})
    const nextRevision = (get().graphDataRevision || 0) + 1
    set({ graphData: withGraphDataRevision(graphCopy, nextRevision), graphDataRevision: nextRevision, historyIndex: nextIndex });
    setGraphFieldSettingsById(fieldSettingsCopy);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
    try {
      const persisted = get().graphData
      if (persisted) persistGraphDataToLocalStorage(persisted)
    } catch {
      void 0
    }
  },

  scheduleHistory: (label: string) => {
    const global = globalThis as unknown as Record<string, unknown>
    type Committer = ((label: string) => void) & { cancel: () => void }
    const key = '__KG_HISTORY_COMMITTER__'
    const state = (global[key] && typeof global[key] === 'object') ? (global[key] as { waitMs: number; fn: Committer }) : null
    const waitMs = Math.max(0, Math.floor(get().historyDebounceMs || 0))
    const fn: Committer = (() => {
      if (state && state.waitMs === waitMs) return state.fn
      try {
        state?.fn?.cancel?.()
      } catch {
        void 0
      }
      const next = debounce((l: string) => {
        const { graphData, graphFieldSettingsById, history, historyIndex } = get();
        if (!graphData) return;
        const nextSignature = getHistorySnapshotSignature(graphData, graphFieldSettingsById)
        const trimmed = history.slice(0, historyIndex + 1);
        if (shouldSkipHistoryCommit(trimmed as HistoryEntry[], nextSignature)) return
        const graphCopy: GraphData = deepClone(graphData)
        const fieldSettingsCopy: GraphFieldSettingsById = deepClone(graphFieldSettingsById || {})
        const entry = buildHistoryEntry({
          label: l,
          timestamp: Date.now(),
          graphData: graphCopy,
          graphFieldSettingsById: fieldSettingsCopy,
        })
        set({ history: [...trimmed, entry], historyIndex: trimmed.length });
        try {
          persistGraphDataToLocalStorage(graphData)
        } catch {
          void 0
        }
      }, waitMs) as Committer
      global[key] = { waitMs, fn: next }
      return next
    })()
    fn(label)
  },

  setHistoryDebounceMs: (ms: number) => {
    const val = Math.max(0, Math.floor(ms));
    set({ historyDebounceMs: val });
  },

  replaceHistoryState: (
    history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>,
    historyIndex: number,
  ) => {
    const { graphData, setGraphFieldSettingsById } = get();
    try {
      const global = globalThis as unknown as Record<string, unknown>
      const st = global['__KG_HISTORY_COMMITTER__'] as { fn?: { cancel?: () => void } } | undefined
      st?.fn?.cancel?.()
    } catch {
      void 0
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(h => h && typeof h.id === 'string' && typeof h.label === 'string' && typeof h.timestamp === 'number' && !!h.graphData)
          .map(h => ({
            id: String(h.id),
            label: String(h.label),
            timestamp: Math.floor(h.timestamp),
            graphData: deepClone(h.graphData) as GraphData,
            graphFieldSettingsById: deepClone(h.graphFieldSettingsById || {}) as GraphFieldSettingsById,
            signature: getHistorySnapshotSignature(h.graphData, h.graphFieldSettingsById || {}),
          }))
      : [];

    const boundedIndex = (() => {
      if (!Number.isFinite(historyIndex)) return safeHistory.length ? safeHistory.length - 1 : -1;
      const idx = Math.floor(historyIndex);
      if (idx < 0) return safeHistory.length ? safeHistory.length - 1 : -1;
      if (idx >= safeHistory.length) return safeHistory.length ? safeHistory.length - 1 : -1;
      return idx;
    })();

    const nextGraphDataBase: GraphData | null =
      boundedIndex >= 0 && safeHistory[boundedIndex]
        ? safeHistory[boundedIndex].graphData
        : graphData || null
    const nextRevision = (get().graphDataRevision || 0) + 1
    const nextGraphData: GraphData | null = nextGraphDataBase
      ? withGraphDataRevision(deepClone(nextGraphDataBase) as GraphData, nextRevision)
      : null
    const nextFieldSettings = boundedIndex >= 0 && safeHistory[boundedIndex] ? safeHistory[boundedIndex].graphFieldSettingsById : get().graphFieldSettingsById || {};
    set({ history: safeHistory, historyIndex: boundedIndex, graphData: nextGraphData, graphDataRevision: nextRevision });
    setGraphFieldSettingsById(deepClone(nextFieldSettings || {}) as GraphFieldSettingsById);
    try {
      get().resyncGraphFieldsFromGraphData?.()
    } catch {
      void 0
    }
    try {
      const persisted = get().graphData
      if (persisted) persistGraphDataToLocalStorage(persisted)
    } catch {
      void 0
    }
  },
});
