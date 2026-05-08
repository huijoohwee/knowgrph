import { lsNum, lsSetNum, lsInt, lsSetInt, lsBool, lsSetBool, getLocalStorage } from '@/lib/persistence';
import { LS_KEYS } from '@/lib/config';
import type { BottomSurfaceTab, GraphState } from '@/hooks/store/types';
import type { StoreApi } from 'zustand';
import type { GraphFieldId, GraphFieldSettingsById, GraphFieldSettings } from '@/features/graph-fields/graphFields';
import { Z_INDEX_FLOATING_PANEL_DEFAULT } from '@/lib/ui/zIndex'
import {
  normalizeGraphFieldSetting,
  readGraphFieldSettingsById,
  removeGraphFieldSetting,
  writeGraphFieldSetting,
  writeGraphFieldSettingsById,
} from '@/hooks/store/graphFieldSettingsPersistence'

type SetGraph = StoreApi<GraphState>['setState'];

export const createPanelLayoutUiSlice = (set: SetGraph) => {
  const storage = getLocalStorage()
  return {
    bottomSurfaceHeightRatio: lsNum(LS_KEYS.bottomSurfaceHeight, 0.35),
    bottomSurfaceCollapsed: lsBool(LS_KEYS.bottomSurfaceCollapsed, true),
    floatingPanelWidthRatio: lsNum(LS_KEYS.floatingPanelWidthRatio, 0.25),
    floatingPanelHeightRatio: lsNum(LS_KEYS.floatingPanelHeightRatio, 0.5),
    floatingPanelZIndex: lsInt(LS_KEYS.floatingPanelZIndex, Z_INDEX_FLOATING_PANEL_DEFAULT),
    bottomSurfaceTab: 'stats' as BottomSurfaceTab,
    requestedHistorySubTab: null as string | null,
    schemaDeriveCacheCapacity: lsInt(LS_KEYS.schemaDeriveCacheCapacity, 16),
    graphFieldSettingsById: readGraphFieldSettingsById(storage),
    selectedGraphFieldId: null as GraphFieldId | null,

    setBottomSurfaceHeightRatio: (v: number) =>
      set({ bottomSurfaceHeightRatio: lsSetNum(LS_KEYS.bottomSurfaceHeight, v) }),
    setBottomSurfaceCollapsed: (v: boolean) =>
      set({ bottomSurfaceCollapsed: lsSetBool(LS_KEYS.bottomSurfaceCollapsed, !!v) }),
    setFloatingPanelWidthRatio: (v: number) =>
      set({
        floatingPanelWidthRatio: lsSetNum(LS_KEYS.floatingPanelWidthRatio, v),
      }),
    setFloatingPanelHeightRatio: (v: number) =>
      set({
        floatingPanelHeightRatio: lsSetNum(LS_KEYS.floatingPanelHeightRatio, v),
      }),
    setFloatingPanelZIndex: (v: number) =>
      set({
        floatingPanelZIndex: lsSetInt(LS_KEYS.floatingPanelZIndex, v, { min: 1, max: 100000 }),
      }),
    setBottomSurfaceTab: (tab: BottomSurfaceTab) =>
      set(() => ({
        bottomSurfaceTab: tab,
      })),
    requestHistorySubTab: (subTab: string | null) =>
      set(() => ({
        requestedHistorySubTab: subTab,
      })),
    setSchemaDeriveCacheCapacity: (n: number) => set({ schemaDeriveCacheCapacity: lsSetInt(LS_KEYS.schemaDeriveCacheCapacity, n, { min: 1, max: 1024 }) }),
    setGraphFieldSettingsById: (next: GraphFieldSettingsById) =>
      set(state => {
        const normalized = writeGraphFieldSettingsById(next, storage)
        return state.graphFieldSettingsById === normalized ? state : { graphFieldSettingsById: normalized }
      }),
    patchGraphFieldSetting: (fieldId: GraphFieldId, patch: Partial<GraphFieldSettings>) =>
      set(state => {
        const normalizedFieldId = String(fieldId || '').trim() as GraphFieldId
        if (!normalizedFieldId) return state
        const current = state.graphFieldSettingsById[normalizedFieldId] || null
        const nextSetting = normalizeGraphFieldSetting({ ...(current || {}), ...patch })
        if (!nextSetting) return state
        const persisted = writeGraphFieldSetting(normalizedFieldId, nextSetting, storage)
        if (!persisted) return state
        const next = { ...(state.graphFieldSettingsById || {}), [normalizedFieldId]: persisted }
        return { graphFieldSettingsById: next }
      }),
    removeGraphFieldSetting: (fieldId: GraphFieldId) =>
      set(state => {
        const normalizedFieldId = String(fieldId || '').trim() as GraphFieldId
        if (!normalizedFieldId || !state.graphFieldSettingsById[normalizedFieldId]) return state
        const next = { ...(state.graphFieldSettingsById || {}) }
        delete next[normalizedFieldId]
        removeGraphFieldSetting(normalizedFieldId, storage)
        return { graphFieldSettingsById: next }
      }),
    setSelectedGraphFieldId: (id: GraphFieldId | null) => set({ selectedGraphFieldId: id }),
  };
};
