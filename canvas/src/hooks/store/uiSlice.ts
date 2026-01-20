import { lsNum, lsSetNum, lsBool, lsSetBool, lsJson, lsSetJson, getLocalStorage } from '@/lib/persistence';
import { LS_KEYS } from '@/lib/config';
import type { GraphState } from '@/hooks/store/types';
import type { StoreApi } from 'zustand';
import { getInitialLaunchSpotlightEnabled, persistLaunchSpotlightEnabled } from '@/features/spotlight/storage';
import { createGraphDataTableUiSlice } from '@/hooks/store/graphDataTableUiSlice';
import { createPanelLayoutUiSlice } from '@/hooks/store/panelLayoutUiSlice';

type SetGraph = StoreApi<GraphState>['setState'];

export const createUiSlice = (set: SetGraph) => {
  return {
    ...createPanelLayoutUiSlice(set),
    ...createGraphDataTableUiSlice(set),

    isEditMode: false,

    codeHighlightDurationMs: 1000,
    codeSelectThrottleMs: 100,
    codeHighlightUntilClick: true,

    uiPanelKeyValueTextSizeClass: lsJson<string>(
      LS_KEYS.panelKeyValueTextSizeClass,
      'text-sm',
      value => (typeof value === 'string' ? value : 'text-sm'),
    ),

    uiPanelTextFontClass: lsJson<string>(
      LS_KEYS.panelTextFontClass,
      'font-sans',
      value => (typeof value === 'string' ? value : 'font-sans'),
    ),

    uiPanelKeyValueInputClass: lsJson<string>(
      LS_KEYS.panelKeyValueInputClass,
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
      value =>
        typeof value === 'string'
          ? value
          : 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
    ),

    uiPanelRowDensityDefaultClass: lsJson<string>(
      LS_KEYS.panelRowDensityDefaultClass,
      'py-1',
      value => (typeof value === 'string' ? value : 'py-1'),
    ),

    uiPanelRowDensityCompactClass: lsJson<string>(
      LS_KEYS.panelRowDensityCompactClass,
      'py-0.5',
      value => (typeof value === 'string' ? value : 'py-0.5'),
    ),

    uiPanelMonospaceTextClass: lsJson<string>(
      LS_KEYS.panelMonospaceTextClass,
      'font-mono text-xs',
      value => (typeof value === 'string' ? value : 'font-mono text-xs'),
    ),
    uiPanelMicroLabelTextSizeClass: lsJson<string>(
      LS_KEYS.panelMicroLabelTextSizeClass,
      '',
      value => (typeof value === 'string' ? value : ''),
    ),

    uiHeaderRowHeightClass: lsJson<string>(
      LS_KEYS.headerRowHeightClass,
      'min-h-[36px]',
      value => (typeof value === 'string' ? value : 'min-h-[36px]'),
    ),

    uiHeaderRowPaddingClass: lsJson<string>(
      LS_KEYS.headerRowPaddingClass,
      'py-1',
      value => (typeof value === 'string' ? value : 'py-1'),
    ),

    uiSectionHeaderRowHeightClass: lsJson<string>(
      LS_KEYS.sectionHeaderRowHeightClass,
      'min-h-[36px]',
      value => (typeof value === 'string' ? value : 'min-h-[36px]'),
    ),

    uiSectionHeaderRowPaddingClass: lsJson<string>(
      LS_KEYS.sectionHeaderRowPaddingClass,
      'py-1',
      value => (typeof value === 'string' ? value : 'py-1'),
    ),

    uiIconScale: lsJson<'compact' | 'default'>(LS_KEYS.iconScale, 'default', value =>
      value === 'compact' || value === 'default' ? value : 'default',
    ),
    uiIconFormat: lsJson<'default' | 'minimal' | '1'>(LS_KEYS.iconFormat, '1', value =>
      value === 'minimal' || value === 'default' || value === '1' ? value : '1',
    ),
    uiIconStrokeWidth: lsNum(LS_KEYS.iconStrokeWidth, 2),
    uiIconColorClass: lsJson<string>(
      LS_KEYS.iconColorClass,
      'text-gray-600',
      value => (typeof value === 'string' ? value : 'text-gray-600'),
    ),
    uiIconHoverBgClass: lsJson<string>(
      LS_KEYS.iconHoverBgClass,
      'hover:bg-gray-100',
      value => (typeof value === 'string' ? value : 'hover:bg-gray-100'),
    ),
    uiIconButtonPaddingClass: lsJson<string>(
      LS_KEYS.iconButtonPadding,
      'p-2',
      value => (typeof value === 'string' ? value : 'p-2'),
    ),
    uiIconPillClass: lsJson<string>(
      LS_KEYS.iconPillClass,
      'inline-flex items-center justify-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5',
      value =>
        typeof value === 'string'
          ? value
          : 'inline-flex items-center justify-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5',
    ),
    uiIconBadgeChipClass: lsJson<string>(
      LS_KEYS.iconBadgeChipClass,
      'px-1 py-[1px] rounded-full border',
      value => (typeof value === 'string' ? value : 'px-1 py-[1px] rounded-full border'),
    ),
    uiIconBadgeChipTextSizeClass: lsJson<string>(
      LS_KEYS.iconBadgeChipTextSizeClass,
      'text-[9px]',
      value => (typeof value === 'string' ? value : 'text-[9px]'),
    ),
    uiIconPillLegendTextSizeClass: lsJson<string>(
      LS_KEYS.iconPillLegendTextSizeClass,
      'text-xs',
      value => (typeof value === 'string' ? value : 'text-xs'),
    ),
    uiIconPillBadgeTextSizeClass: lsJson<string>(
      LS_KEYS.iconPillBadgeTextSizeClass,
      'text-[9px]',
      value => (typeof value === 'string' ? value : 'text-[9px]'),
    ),
    uiIconAnimationEnabled: lsBool(LS_KEYS.iconAnimationEnabled, true),
    uiOverlayOpacity: lsNum(LS_KEYS.overlayOpacity, 0.95),
    uiPanelOpacity: lsNum(LS_KEYS.panelOpacity, 0.95),
    uiToolbarOpacity: lsNum(LS_KEYS.toolbarOpacity, 0.95),
    chatEndpointUrl: lsJson<string | null>(
      LS_KEYS.chatEndpointUrl,
      'http://localhost:1234/v1/chat/completions',
      value => (typeof value === 'string' ? value : null),
    ),
    chatModel: lsJson<string | null>(
      LS_KEYS.chatModel,
      'lmstudio-community/DeepSeek-R1-0528-Qwen3-8B-MLX-8bit',
      value => (typeof value === 'string' ? value : 'lmstudio-community/DeepSeek-R1-0528-Qwen3-8B-MLX-8bit'),
    ),
    chatTemperature: lsNum(LS_KEYS.chatTemperature, 0.3),
    chatSystemPrompt: lsJson<string | null>(
      LS_KEYS.chatSystemPrompt,
      null,
      value => (typeof value === 'string' ? value : null),
    ),
    launchSpotlightMode: 'tour' as const,
    enableLaunchSpotlight: (() => {
      const storage = getLocalStorage();
      return getInitialLaunchSpotlightEnabled(storage, true);
    })(),
    statusPanelPinned: lsBool(LS_KEYS.statusPanelPinned, false),

    setEditMode: (mode: boolean) => set({ isEditMode: mode }),

    setCodeHighlightDurationMs: (ms: number) => set({ codeHighlightDurationMs: Math.max(0, Math.floor(ms)) }),
    setCodeSelectThrottleMs: (ms: number) => set({ codeSelectThrottleMs: Math.max(0, Math.floor(ms)) }),
    setCodeHighlightUntilClick: (v: boolean) => set({ codeHighlightUntilClick: !!v }),

    setUiPanelKeyValueTextSizeClass: (className: string) =>
      set({
        uiPanelKeyValueTextSizeClass: lsSetJson(
          LS_KEYS.panelKeyValueTextSizeClass,
          String(className || '').trim() || 'text-sm',
        ),
      }),

    setUiPanelTextFontClass: (className: string) =>
      set({
        uiPanelTextFontClass: lsSetJson(
          LS_KEYS.panelTextFontClass,
          String(className || '').trim() || 'font-sans',
        ),
      }),

    setUiPanelKeyValueInputClass: (className: string) =>
      set({
        uiPanelKeyValueInputClass: lsSetJson(
          LS_KEYS.panelKeyValueInputClass,
          String(className || '').trim() ||
            'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
        ),
      }),

    setUiPanelRowDensityDefaultClass: (className: string) =>
      set({
        uiPanelRowDensityDefaultClass: lsSetJson(
          LS_KEYS.panelRowDensityDefaultClass,
          String(className || '').trim() || 'py-1',
        ),
      }),

    setUiPanelRowDensityCompactClass: (className: string) =>
      set({
        uiPanelRowDensityCompactClass: lsSetJson(
          LS_KEYS.panelRowDensityCompactClass,
          String(className || '').trim() || 'py-0.5',
        ),
      }),

    setUiPanelMonospaceTextClass: (className: string) =>
      set({
        uiPanelMonospaceTextClass: lsSetJson(
          LS_KEYS.panelMonospaceTextClass,
          String(className || '').trim() || 'font-mono text-xs',
        ),
      }),
    setUiPanelMicroLabelTextSizeClass: (className: string) =>
      set({
        uiPanelMicroLabelTextSizeClass: lsSetJson(
          LS_KEYS.panelMicroLabelTextSizeClass,
          String(className || '').trim(),
        ),
      }),

    setUiHeaderRowHeightClass: (className: string) =>
      set({
        uiHeaderRowHeightClass: lsSetJson(
          LS_KEYS.headerRowHeightClass,
          String(className || '').trim() || 'min-h-[36px]',
        ),
      }),

    setUiHeaderRowPaddingClass: (className: string) =>
      set({
        uiHeaderRowPaddingClass: lsSetJson(
          LS_KEYS.headerRowPaddingClass,
          String(className || '').trim() || 'py-1',
        ),
      }),

    setUiSectionHeaderRowHeightClass: (className: string) =>
      set({
        uiSectionHeaderRowHeightClass: lsSetJson(
          LS_KEYS.sectionHeaderRowHeightClass,
          String(className || '').trim() || 'min-h-[36px]',
        ),
      }),

    setUiSectionHeaderRowPaddingClass: (className: string) =>
      set({
        uiSectionHeaderRowPaddingClass: lsSetJson(
          LS_KEYS.sectionHeaderRowPaddingClass,
          String(className || '').trim() || 'py-1',
        ),
      }),

    setUiIconScale: (scale: 'compact' | 'default') =>
      set({
        uiIconScale: lsSetJson(LS_KEYS.iconScale, scale === 'compact' ? 'compact' : 'default'),
      }),
    setUiIconFormat: (format: 'default' | 'minimal' | '1') =>
      set({
        uiIconFormat: lsSetJson(LS_KEYS.iconFormat, format === 'minimal' || format === 'default' || format === '1' ? format : '1'),
      }),
    setUiIconStrokeWidth: (width: number) =>
      set({
        uiIconStrokeWidth: lsSetNum(LS_KEYS.iconStrokeWidth, Math.max(0.5, Math.min(4, width))),
      }),
    setUiIconColorClass: (className: string) =>
      set({
        uiIconColorClass: lsSetJson(
          LS_KEYS.iconColorClass,
          String(className || '').trim() || 'text-gray-600',
        ),
      }),
    setUiIconHoverBgClass: (className: string) =>
      set({
        uiIconHoverBgClass: lsSetJson(
          LS_KEYS.iconHoverBgClass,
          String(className || '').trim() || 'hover:bg-gray-100',
        ),
      }),
    setUiIconButtonPaddingClass: (className: string) =>
      set({
        uiIconButtonPaddingClass: lsSetJson(
          LS_KEYS.iconButtonPadding,
          String(className || '').trim() || 'p-2',
        ),
      }),
    setUiIconPillClass: (className: string) =>
      set({
        uiIconPillClass: lsSetJson(
          LS_KEYS.iconPillClass,
          String(className || '').trim() ||
            'inline-flex items-center justify-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5',
        ),
      }),
    setUiIconBadgeChipClass: (className: string) =>
      set({
        uiIconBadgeChipClass: lsSetJson(
          LS_KEYS.iconBadgeChipClass,
          String(className || '').trim() || 'px-1 py-[1px] rounded-full border',
        ),
      }),
    setUiIconBadgeChipTextSizeClass: (className: string) =>
      set({
        uiIconBadgeChipTextSizeClass: lsSetJson(
          LS_KEYS.iconBadgeChipTextSizeClass,
          String(className || '').trim() || 'text-[9px]',
        ),
      }),
    setUiIconPillLegendTextSizeClass: (className: string) =>
      set({
        uiIconPillLegendTextSizeClass: lsSetJson(
          LS_KEYS.iconPillLegendTextSizeClass,
          String(className || '').trim() || 'text-xs',
        ),
      }),
    setUiIconPillBadgeTextSizeClass: (className: string) =>
      set({
        uiIconPillBadgeTextSizeClass: lsSetJson(
          LS_KEYS.iconPillBadgeTextSizeClass,
          String(className || '').trim() || 'text-[9px]',
        ),
      }),
    setUiIconAnimationEnabled: (v: boolean) =>
      set({
        uiIconAnimationEnabled: lsSetBool(LS_KEYS.iconAnimationEnabled, !!v),
      }),
    setUiOverlayOpacity: (v: number) => set({ uiOverlayOpacity: lsSetNum(LS_KEYS.overlayOpacity, v) }),
    setUiPanelOpacity: (v: number) => set({ uiPanelOpacity: lsSetNum(LS_KEYS.panelOpacity, v) }),
    setUiToolbarOpacity: (v: number) => set({ uiToolbarOpacity: lsSetNum(LS_KEYS.toolbarOpacity, v) }),
    setChatEndpointUrl: (url: string | null) =>
      set({
        chatEndpointUrl: lsSetJson(
          LS_KEYS.chatEndpointUrl,
          url && typeof url === 'string' ? url : null,
        ),
      }),
    setChatModel: (model: string | null) =>
      set({
        chatModel: lsSetJson(
          LS_KEYS.chatModel,
          model && typeof model === 'string' ? model : 'lmstudio-community/DeepSeek-R1-0528-Qwen3-8B-MLX-8bit',
        ),
      }),
    setChatTemperature: (v: number) =>
      set({
        chatTemperature: lsSetNum(
          LS_KEYS.chatTemperature,
          Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 0.3,
        ),
      }),
    setChatSystemPrompt: (v: string | null) =>
      set({
        chatSystemPrompt: lsSetJson(
          LS_KEYS.chatSystemPrompt,
          v && typeof v === 'string' ? v : null,
        ),
      }),
    setLaunchSpotlightMode: (mode: 'tour' | 'stats') => set({ launchSpotlightMode: mode === 'stats' ? 'stats' : 'tour' }),
    setEnableLaunchSpotlight: (v: boolean) => {
      const storage = getLocalStorage();
      const next = persistLaunchSpotlightEnabled(storage, v);
      set({ enableLaunchSpotlight: next });
    },
    setStatusPanelPinned: (v: boolean) => set({ statusPanelPinned: lsSetBool(LS_KEYS.statusPanelPinned, v) }),
  }
}
