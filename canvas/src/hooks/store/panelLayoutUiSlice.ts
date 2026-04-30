import { lsNum, lsSetNum, lsInt, lsSetInt, lsBool, lsSetBool, getLocalStorage } from '@/lib/persistence';
import { LS_KEYS } from '@/lib/config';
import type { BottomTab, GraphState } from '@/hooks/store/types';
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
    bottomPanelHeightRatio: lsNum(LS_KEYS.bottomPanelHeight, 0.35),
    bottomPanelCollapsed: lsBool(LS_KEYS.bottomPanelCollapsed, true),
    floatingPanelWidthRatio: lsNum(LS_KEYS.floatingPanelWidthRatio, 0.25),
    floatingPanelHeightRatio: lsNum(LS_KEYS.floatingPanelHeightRatio, 0.5),
    floatingPanelZIndex: lsInt(LS_KEYS.floatingPanelZIndex, Z_INDEX_FLOATING_PANEL_DEFAULT),
    bottomPanelTab: 'stats' as BottomTab,
    schemaDeriveCacheCapacity: lsInt(LS_KEYS.schemaDeriveCacheCapacity, 16),
    graphFieldSettingsById: readGraphFieldSettingsById(storage),
    selectedGraphFieldId: null as GraphFieldId | null,

    setBottomPanelHeightRatio: (v: number) =>
      set({ bottomPanelHeightRatio: lsSetNum(LS_KEYS.bottomPanelHeight, v) }),
    setBottomPanelCollapsed: (v: boolean) =>
      set({ bottomPanelCollapsed: lsSetBool(LS_KEYS.bottomPanelCollapsed, !!v) }),
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
    setBottomPanelTab: (tab: BottomTab) =>
      set(() => ({
        bottomPanelTab: tab,
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
