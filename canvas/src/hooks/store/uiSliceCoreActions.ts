
import type { StoreApi } from 'zustand'
import type { GraphState } from '@/hooks/store/types'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { lsSetBool, lsSetFloat, lsSetInt, lsSetJson, lsSetNum } from '@/lib/persistence'
import { clampFillRatio } from 'grph-shared/zoom/presets'
import { DEFAULT_DRAG_ALPHA_TARGET, DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from '@/lib/graph/layoutDefaults'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiCoreActions = (set: SetGraph)=> ({
    setEditMode: (mode: boolean) => set({ isEditMode: mode }),

    setWorkspaceViewState: (next: { mode: 'canvas' | 'editor'; paneOpen?: boolean }) =>
      set(state => {
        const nextMode = next.mode === 'editor' ? 'editor' : 'canvas'
        const nextPaneOpen = nextMode === 'editor'
          ? true
          : next.paneOpen === false
            ? false
            : next.paneOpen === true
              ? true
              : state.workspaceCanvasPaneOpen
        if (state.workspaceViewMode === nextMode && state.workspaceCanvasPaneOpen === nextPaneOpen) return {}
        if (state.workspaceViewMode !== nextMode) lsSetJson(LS_KEYS.workspaceViewMode, nextMode)
        if (state.workspaceCanvasPaneOpen !== nextPaneOpen) lsSetBool(LS_KEYS.workspaceCanvasPaneOpen, nextPaneOpen)
        return {
          workspaceViewMode: nextMode,
          workspaceCanvasPaneOpen: nextPaneOpen,
        } as Partial<GraphState>
      }),

    setWorkspaceViewMode: (mode: 'canvas' | 'editor') =>
      set(state => {
        const nextMode = mode === 'editor' ? 'editor' : 'canvas'
        const nextPaneOpen = nextMode === 'editor' ? true : state.workspaceCanvasPaneOpen
        if (state.workspaceViewMode === nextMode && state.workspaceCanvasPaneOpen === nextPaneOpen) return {}
        if (nextMode === 'editor' && state.workspaceCanvasPaneOpen !== true) lsSetBool(LS_KEYS.workspaceCanvasPaneOpen, true)
        return {
          workspaceViewMode: lsSetJson(LS_KEYS.workspaceViewMode, nextMode),
          workspaceCanvasPaneOpen: nextPaneOpen,
        } as Partial<GraphState>
      }),

    setEditorWorkspacePane: (pane: 'markdown' | 'graphTable') =>
      set(state => {
        const next = pane === 'graphTable' ? 'graphTable' : 'markdown'
        if (state.editorWorkspacePane === next) return {}
        return { editorWorkspacePane: lsSetJson(LS_KEYS.editorWorkspacePane, next) } as Partial<GraphState>
      }),
    toggleWorkspaceViewMode: () =>
      set(s => {
        const current = s.workspaceViewMode === 'editor' ? 'editor' : 'canvas'
        const next = current === 'editor' ? 'canvas' : 'editor'
        const nextPaneOpen = next === 'editor' ? true : s.workspaceCanvasPaneOpen
        if (s.workspaceViewMode === next && s.workspaceCanvasPaneOpen === nextPaneOpen) return {}
        if (next === 'editor' && s.workspaceCanvasPaneOpen !== true) lsSetBool(LS_KEYS.workspaceCanvasPaneOpen, true)
        return {
          workspaceViewMode: lsSetJson(LS_KEYS.workspaceViewMode, next),
          workspaceCanvasPaneOpen: nextPaneOpen,
        } as Partial<GraphState>
      }),

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
            `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
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
          String(className || '').trim() || UI_THEME_TOKENS.text.secondary,
        ),
      }),
    setUiIconHoverBgClass: (className: string) =>
      set({
        uiIconHoverBgClass: lsSetJson(
          LS_KEYS.iconHoverBgClass,
          String(className || '').trim() || 'hover:bg-[var(--kg-panel-action-bg-hover)]',
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
            `inline-flex items-center justify-center rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} px-1.5 py-0.5`,
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
})
