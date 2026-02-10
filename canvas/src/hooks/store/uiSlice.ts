import { lsNum, lsSetNum, lsBool, lsSetBool, lsInt, lsSetInt, lsJson, lsSetJson, getLocalStorage } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import type { GraphState, PdfImportConversionMode } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { getInitialLaunchSpotlightEnabled, persistLaunchSpotlightEnabled } from '@/features/spotlight/storage'
import { createPanelLayoutUiSlice } from '@/hooks/store/panelLayoutUiSlice'
import { DEFAULT_CANVAS_2D_RENDERER } from '@/lib/config'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'

type SetGraph = StoreApi<GraphState>['setState']

function coercePdfImportConversionMode(v: unknown): PdfImportConversionMode | null {
  if (v === 'text-only' || v === 'image-heavy' || v === 'scan-ocr') return v
  return null
}

function getPdfImportModePreset(mode: PdfImportConversionMode): {
  includeImages: boolean
  embedImages: boolean
  maxExtractedImagesPerPage: number
  maxEmbeddedImagesPerPage: number
  maxEmbeddedTotalBytes: number
  maxEmbeddedAssetBytes: number
  deepseekOcr2Enabled: boolean
  deepseekOcr2Mode: 'fallback' | 'always'
} {
  if (mode === 'image-heavy') {
    return {
      includeImages: true,
      embedImages: false,
      maxExtractedImagesPerPage: 16,
      maxEmbeddedImagesPerPage: 12,
      maxEmbeddedTotalBytes: 4 * 1024 * 1024,
      maxEmbeddedAssetBytes: 2 * 1024 * 1024,
      deepseekOcr2Enabled: false,
      deepseekOcr2Mode: 'fallback',
    }
  }
  if (mode === 'scan-ocr') {
    return {
      includeImages: false,
      embedImages: false,
      maxExtractedImagesPerPage: 4,
      maxEmbeddedImagesPerPage: 0,
      maxEmbeddedTotalBytes: 4 * 1024 * 1024,
      maxEmbeddedAssetBytes: 2 * 1024 * 1024,
      deepseekOcr2Enabled: true,
      deepseekOcr2Mode: 'always',
    }
  }
  return {
    includeImages: false,
    embedImages: false,
    maxExtractedImagesPerPage: 0,
    maxEmbeddedImagesPerPage: 0,
    maxEmbeddedTotalBytes: 4 * 1024 * 1024,
    maxEmbeddedAssetBytes: 2 * 1024 * 1024,
    deepseekOcr2Enabled: false,
    deepseekOcr2Mode: 'fallback',
  }
}

export const createUiSlice = (set: SetGraph) => {
  return {
    ...createPanelLayoutUiSlice(set),

    isEditMode: false,

    workspaceViewMode: lsJson<'canvas' | 'editor' | 'table'>(
      LS_KEYS.workspaceViewMode,
      'canvas',
      value => (value === 'editor' || value === 'canvas' || value === 'table' ? value : 'canvas'),
    ),

    documentStructureBaselineLock: lsBool(LS_KEYS.documentStructureBaselineLock, true),
    documentStructureBaselineSnapshot: null,
    setDocumentStructureBaselineLock: (enabled: boolean) =>
      set(state => {
        const next = enabled === false ? false : true
        if (state.documentStructureBaselineLock === next) return {}
        lsSetBool(LS_KEYS.documentStructureBaselineLock, next)
        if (!next) {
          const snap = state.documentStructureBaselineSnapshot
          if (!snap) return { documentStructureBaselineLock: false } as Partial<GraphState>
          lsSetJson(LS_KEYS.canvas2dRenderer, snap.canvas2dRenderer)
          lsSetBool(LS_KEYS.viewportPinned, snap.viewPinned === true)
          lsSetBool(LS_KEYS.viewportFitToScreen, snap.fitToScreenMode === true)
          lsSetBool(LS_KEYS.viewportZoomToSelection, snap.zoomToSelectionMode === true)
          return {
            documentStructureBaselineLock: false,
            documentStructureBaselineSnapshot: null,
            documentSemanticMode: snap.documentSemanticMode,
            frontmatterModeEnabled: snap.frontmatterModeEnabled,
            canvasRenderMode: snap.canvasRenderMode,
            canvas2dRenderer: snap.canvas2dRenderer,
            canvasRenderModeLastFree: snap.canvasRenderModeLastFree,
            canvasRenderModeIsAuto: snap.canvasRenderModeIsAuto,
            viewPinned: snap.viewPinned,
            fitToScreenMode: snap.fitToScreenMode,
            zoomToSelectionMode: snap.zoomToSelectionMode,
            zoomRequest: null,
            selectedNodeId: snap.selectedNodeId,
            selectedEdgeId: snap.selectedEdgeId,
            selectedGroupId: snap.selectedGroupId,
            selectedNodeIds: snap.selectedNodeIds,
            selectedEdgeIds: snap.selectedEdgeIds,
            selectedGroupIds: snap.selectedGroupIds,
          } as Partial<GraphState>
        }
        const snapshot = state.documentStructureBaselineSnapshot || {
          documentSemanticMode: state.documentSemanticMode,
          frontmatterModeEnabled: state.frontmatterModeEnabled,
          canvasRenderMode: state.canvasRenderMode,
          canvas2dRenderer: state.canvas2dRenderer,
          canvasRenderModeLastFree: state.canvasRenderModeLastFree,
          canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
          viewPinned: state.viewPinned,
          fitToScreenMode: state.fitToScreenMode,
          zoomToSelectionMode: state.zoomToSelectionMode,
          selectedNodeId: state.selectedNodeId,
          selectedEdgeId: state.selectedEdgeId,
          selectedGroupId: state.selectedGroupId,
          selectedNodeIds: state.selectedNodeIds,
          selectedEdgeIds: state.selectedEdgeIds,
          selectedGroupIds: state.selectedGroupIds,
        }
        lsSetJson(LS_KEYS.canvas2dRenderer, DEFAULT_CANVAS_2D_RENDERER)
        lsSetBool(LS_KEYS.viewportPinned, false)
        lsSetBool(LS_KEYS.viewportFitToScreen, true)
        lsSetBool(LS_KEYS.viewportZoomToSelection, false)
        return {
          documentStructureBaselineLock: true,
          documentStructureBaselineSnapshot: snapshot,
          documentSemanticMode: 'document',
          frontmatterModeEnabled: false,
          canvasRenderMode: '2d',
          canvas2dRenderer: DEFAULT_CANVAS_2D_RENDERER,
          canvasRenderModeLastFree: '2d',
          canvasRenderModeIsAuto: false,
          viewPinned: false,
          fitToScreenMode: true,
          zoomToSelectionMode: false,
          zoomRequest: null,
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedGroupId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          selectedGroupIds: [],
        } as Partial<GraphState>
      }),

    editorWorkspaceSection: lsJson<'markdown' | 'graphTable'>(
      LS_KEYS.workspaceEditorSection,
      'markdown',
      value => (value === 'markdown' || value === 'graphTable' ? value : 'markdown'),
    ),

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
      PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
      value =>
        typeof value === 'string'
          ? value
          : PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
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

    pdfImportIncludeImages: lsBool(LS_KEYS.pdfImportIncludeImages, false),
    pdfImportConversionMode: lsJson<PdfImportConversionMode>(LS_KEYS.pdfImportConversionMode, 'text-only', coercePdfImportConversionMode),
    pdfImportEmbedImages: lsBool(LS_KEYS.pdfImportEmbedImages, false),
    pdfImportMaxExtractedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, 6),
    pdfImportMaxEmbeddedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, 6),
    pdfImportMaxEmbeddedTotalBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, 4 * 1024 * 1024),
    pdfImportMaxEmbeddedAssetBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, 2 * 1024 * 1024),
    pdfImportProvider: lsJson<'native' | 'docling-remote'>(
      LS_KEYS.pdfImportProvider,
      'native',
      v => (v === 'native' || v === 'docling-remote' ? v : 'native'),
    ),
    pdfImportDoclingEndpoint: lsJson<string | null>(
      LS_KEYS.pdfImportDoclingEndpoint,
      null,
      v => (typeof v === 'string' ? v : null),
    ),
    pdfImportProviderFallbackToNative: lsBool(LS_KEYS.pdfImportProviderFallbackToNative, true),
    pdfImportDeepseekOcr2Enabled: lsBool(LS_KEYS.pdfImportDeepseekOcr2Enabled, false),
    pdfImportDeepseekOcr2Mode: lsJson<'fallback' | 'always'>(
      LS_KEYS.pdfImportDeepseekOcr2Mode,
      'fallback',
      v => (v === 'always' || v === 'fallback' ? v : 'fallback'),
    ),
    launchSpotlightMode: 'tour' as const,
    enableLaunchSpotlight: (() => {
      const storage = getLocalStorage();
      return getInitialLaunchSpotlightEnabled(storage, true);
    })(),
    statusPanelPinned: lsBool(LS_KEYS.statusPanelPinned, false),

    setEditMode: (mode: boolean) => set({ isEditMode: mode }),

    setWorkspaceViewMode: (mode: 'canvas' | 'editor' | 'table') =>
      set({
        workspaceViewMode: lsSetJson(
          LS_KEYS.workspaceViewMode,
          mode === 'editor' ? 'editor' : mode === 'table' ? 'table' : 'canvas',
        ),
      }),

    setEditorWorkspaceSection: (section: 'markdown' | 'graphTable') =>
      set({
        editorWorkspaceSection: lsSetJson(
          LS_KEYS.workspaceEditorSection,
          section === 'graphTable' ? 'graphTable' : 'markdown',
        ),
      }),
    toggleWorkspaceViewMode: () =>
      set(s => {
        const current = s.workspaceViewMode === 'editor' ? 'editor' : 'canvas'
        const next = current === 'editor' ? 'canvas' : 'editor'
        return { workspaceViewMode: lsSetJson(LS_KEYS.workspaceViewMode, next) }
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

    setPdfImportIncludeImages: (v: boolean) => set({ pdfImportIncludeImages: lsSetBool(LS_KEYS.pdfImportIncludeImages, !!v) }),
    setPdfImportConversionMode: (mode: PdfImportConversionMode) =>
      set(() => {
        const nextMode = coercePdfImportConversionMode(mode) || 'text-only'
        const preset = getPdfImportModePreset(nextMode)
        return {
          pdfImportConversionMode: lsSetJson(LS_KEYS.pdfImportConversionMode, nextMode),
          pdfImportIncludeImages: lsSetBool(LS_KEYS.pdfImportIncludeImages, preset.includeImages),
          pdfImportEmbedImages: lsSetBool(LS_KEYS.pdfImportEmbedImages, preset.embedImages),
          pdfImportMaxExtractedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, preset.maxExtractedImagesPerPage, { min: 0, max: 50 }),
          pdfImportMaxEmbeddedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, preset.maxEmbeddedImagesPerPage, { min: 0, max: 50 }),
          pdfImportMaxEmbeddedTotalBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, preset.maxEmbeddedTotalBytes, { min: 0, max: 50 * 1024 * 1024 }),
          pdfImportMaxEmbeddedAssetBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, preset.maxEmbeddedAssetBytes, { min: 0, max: 20 * 1024 * 1024 }),
          pdfImportDeepseekOcr2Enabled: lsSetBool(LS_KEYS.pdfImportDeepseekOcr2Enabled, preset.deepseekOcr2Enabled),
          pdfImportDeepseekOcr2Mode: lsSetJson(LS_KEYS.pdfImportDeepseekOcr2Mode, preset.deepseekOcr2Mode),
        } satisfies Partial<GraphState>
      }),
    setPdfImportEmbedImages: (v: boolean) => set({ pdfImportEmbedImages: lsSetBool(LS_KEYS.pdfImportEmbedImages, !!v) }),
    setPdfImportMaxExtractedImagesPerPage: (v: number) =>
      set({ pdfImportMaxExtractedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, v, { min: 0, max: 50 }) }),
    setPdfImportMaxEmbeddedImagesPerPage: (v: number) =>
      set({ pdfImportMaxEmbeddedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, v, { min: 0, max: 50 }) }),
    setPdfImportMaxEmbeddedTotalBytes: (v: number) =>
      set({ pdfImportMaxEmbeddedTotalBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, v, { min: 0, max: 50 * 1024 * 1024 }) }),
    setPdfImportMaxEmbeddedAssetBytes: (v: number) =>
      set({ pdfImportMaxEmbeddedAssetBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, v, { min: 0, max: 20 * 1024 * 1024 }) }),
    setPdfImportProvider: (v: 'native' | 'docling-remote') =>
      set({ pdfImportProvider: lsSetJson(LS_KEYS.pdfImportProvider, v === 'docling-remote' ? 'docling-remote' : 'native') }),
    setPdfImportDoclingEndpoint: (v: string | null) =>
      set({ pdfImportDoclingEndpoint: lsSetJson(LS_KEYS.pdfImportDoclingEndpoint, typeof v === 'string' ? v : null) }),
    setPdfImportProviderFallbackToNative: (v: boolean) =>
      set({ pdfImportProviderFallbackToNative: lsSetBool(LS_KEYS.pdfImportProviderFallbackToNative, !!v) }),
    setPdfImportDeepseekOcr2Enabled: (v: boolean) =>
      set({ pdfImportDeepseekOcr2Enabled: lsSetBool(LS_KEYS.pdfImportDeepseekOcr2Enabled, !!v) }),
    setPdfImportDeepseekOcr2Mode: (v: 'fallback' | 'always') =>
      set({ pdfImportDeepseekOcr2Mode: lsSetJson(LS_KEYS.pdfImportDeepseekOcr2Mode, v === 'always' ? 'always' : 'fallback') }),
    setLaunchSpotlightMode: (mode: 'tour' | 'stats') => set({ launchSpotlightMode: mode === 'stats' ? 'stats' : 'tour' }),
    setEnableLaunchSpotlight: (v: boolean) => {
      const storage = getLocalStorage();
      const next = persistLaunchSpotlightEnabled(storage, v);
      set({ enableLaunchSpotlight: next });
    },
    setStatusPanelPinned: (v: boolean) => set({ statusPanelPinned: lsSetBool(LS_KEYS.statusPanelPinned, v) }),
  }
}
