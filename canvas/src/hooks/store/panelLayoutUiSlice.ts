import { lsNum, lsSetNum, lsInt, lsSetInt, lsJson, lsSetJson, lsBool, lsSetBool } from '@/lib/persistence';
import { LS_KEYS } from '@/lib/config';
import type { BottomTab } from '@/features/bottom-panel/open';
import type { GraphState } from '@/hooks/store/types';
import type { StoreApi } from 'zustand';
import type { GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';

type SetGraph = StoreApi<GraphState>['setState'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseGraphFieldSettingsById(raw: unknown): GraphFieldSettingsById | null {
  if (!isRecord(raw)) return null;
  const next: GraphFieldSettingsById = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const displayName = v.displayName;
    const isHidden = v.isHidden;
    const fieldTypeRaw = v.fieldType;
    const isCustomRaw = v.isCustom;
    const descriptionRaw = v.description;
    const defaultValueRaw = v.defaultValue;
    const selectOptionsRaw = v.selectOptions;
    const decimalPlacesRaw = v.decimalPlaces;
    const currencyCodeRaw = v.currencyCode;
    const urlProtocolRaw = v.urlProtocol;
    const dateTimeFormatRaw = v.dateTimeFormat;
    if (typeof displayName !== 'string') continue;
    if (typeof isHidden !== 'boolean') continue;
    const base: Record<string, unknown> = { displayName, isHidden };
    if (typeof fieldTypeRaw === 'string') {
      base.fieldType = fieldTypeRaw;
    }
    if (typeof isCustomRaw === 'boolean') {
      base.isCustom = isCustomRaw;
    }
    if (typeof descriptionRaw === 'string') {
      base.description = descriptionRaw;
    }
    if (defaultValueRaw === null || typeof defaultValueRaw === 'string' || typeof defaultValueRaw === 'number' || typeof defaultValueRaw === 'boolean') {
      base.defaultValue = defaultValueRaw;
    }
    if (Array.isArray(selectOptionsRaw)) {
      const opts = selectOptionsRaw
        .filter((x): x is string => typeof x === 'string')
        .map(s => s.trim())
        .filter(Boolean);
      if (opts.length > 0) base.selectOptions = Array.from(new Set(opts));
    }
    if (typeof decimalPlacesRaw === 'number' && Number.isFinite(decimalPlacesRaw)) {
      base.decimalPlaces = Math.min(10, Math.max(0, Math.floor(decimalPlacesRaw)));
    }
    if (typeof currencyCodeRaw === 'string') {
      base.currencyCode = currencyCodeRaw;
    }
    if (urlProtocolRaw === 'any' || urlProtocolRaw === 'http' || urlProtocolRaw === 'https') {
      base.urlProtocol = urlProtocolRaw;
    }
    if (dateTimeFormatRaw === 'ISO' || dateTimeFormatRaw === 'Local') {
      base.dateTimeFormat = dateTimeFormatRaw;
    }
    next[k as keyof GraphFieldSettingsById] = base as GraphFieldSettingsById[keyof GraphFieldSettingsById];
  }
  return next;
}

export const createPanelLayoutUiSlice = (set: SetGraph) => {
  return {
    isSidebarOpen: false,

    bottomPanelHeightRatio: lsNum(LS_KEYS.bottomPanelHeight, 0.35),
    bottomPanelCollapsed: lsBool(LS_KEYS.bottomPanelCollapsed, true),
    floatingPanelWidthRatio: lsNum(LS_KEYS.floatingPanelWidthRatio, 0.25),
    floatingPanelHeightRatio: lsNum(LS_KEYS.floatingPanelHeightRatio, 0.5),
    floatingPanelZIndex: lsInt(LS_KEYS.floatingPanelZIndex, 5000),
    sidebarWidthRatio: lsNum(LS_KEYS.sidebarWidthRatio, 0.25),
    bottomPanelTab: 'stats' as BottomTab,
    schemaDeriveCacheCapacity: lsInt(LS_KEYS.schemaDeriveCacheCapacity, 16),
    graphFieldSettingsById: lsJson(LS_KEYS.graphFieldSettingsById, {} as GraphFieldSettingsById, parseGraphFieldSettingsById),
    selectedGraphFieldId: null as GraphFieldId | null,

    setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
    toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),

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
    setSidebarWidthRatio: (v: number) =>
      set({
        sidebarWidthRatio: lsSetNum(LS_KEYS.sidebarWidthRatio, v),
      }),
    setBottomPanelTab: (tab: BottomTab) =>
      set(() => ({
        bottomPanelTab: tab,
      })),
    setSchemaDeriveCacheCapacity: (n: number) => set({ schemaDeriveCacheCapacity: lsSetInt(LS_KEYS.schemaDeriveCacheCapacity, n, { min: 1, max: 1024 }) }),
    setGraphFieldSettingsById: (next: GraphFieldSettingsById) => set({ graphFieldSettingsById: lsSetJson(LS_KEYS.graphFieldSettingsById, next) }),
    setSelectedGraphFieldId: (id: GraphFieldId | null) => set({ selectedGraphFieldId: id }),
  };
};
