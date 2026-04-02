import {
  lsBool,
  lsSetBool,
  lsInt,
  lsSetInt,
  lsJson,
  lsSetJson,
  getLocalStorage,
  lsFloat,
  lsSetFloat,
  lsNum,
  lsSetNum,
} from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { getInitialLaunchSpotlightEnabled, persistLaunchSpotlightEnabled } from '@/features/spotlight/storage'
import { createPanelLayoutUiSlice } from '@/hooks/store/panelLayoutUiSlice'
import { DEFAULT_CANVAS_2D_RENDERER, DEFAULT_CANVAS_3D_MODE } from '@/lib/config'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { clampFillRatio } from 'grph-shared/zoom/presets'
import { DEFAULT_DRAG_ALPHA_TARGET, DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from '@/lib/graph/layoutDefaults'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiSlice = (set: SetGraph) => {
  return {
    ...createPanelLayoutUiSlice(set),

    isEditMode: false,

    workspaceViewMode: lsJson<'canvas' | 'editor'>(
      LS_KEYS.workspaceViewMode,
      'canvas',
      value => (value === 'editor' || value === 'canvas' ? value : 'canvas'),
    ),

    editorWorkspacePane: lsJson<'markdown' | 'graphTable'>(
      LS_KEYS.editorWorkspacePane,
      'markdown',
      value => (value === 'graphTable' || value === 'markdown' ? value : 'markdown'),
    ),

    workspaceCanvasPaneOpen: lsBool(LS_KEYS.workspaceCanvasPaneOpen, true),
    setWorkspaceCanvasPaneOpen: (open: boolean) =>
      set(state => {
        const next = open === false ? false : true
        if (state.workspaceCanvasPaneOpen === next) return {}
        lsSetBool(LS_KEYS.workspaceCanvasPaneOpen, next)
        return { workspaceCanvasPaneOpen: next } as Partial<GraphState>
      }),

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
            canvas3dMode: snap.canvas3dMode,
            canvas2dRenderer: snap.canvas2dRenderer,
            canvasRenderModeLastFree: snap.canvasRenderModeLastFree,
            canvasRenderModeIsAuto: snap.canvasRenderModeIsAuto,
            viewPinned: snap.viewPinned,
            fitToScreenMode: snap.fitToScreenMode,
            zoomToSelectionMode: snap.zoomToSelectionMode,
            zoomState: snap.zoomState,
            zoomStateByKey: snap.zoomStateByKey,
            zoomRequest: null,
            selectedNodeId: snap.selectedNodeId,
            selectedEdgeId: snap.selectedEdgeId,
            selectedGroupId: snap.selectedGroupId,
            selectedNodeIds: snap.selectedNodeIds,
            selectedEdgeIds: snap.selectedEdgeIds,
            selectedGroupIds: snap.selectedGroupIds,
            collapsedGroupIds: snap.collapsedGroupIds,
          } as Partial<GraphState>
        }
        const snapshot = state.documentStructureBaselineSnapshot || {
          documentSemanticMode: state.documentSemanticMode,
          frontmatterModeEnabled: state.frontmatterModeEnabled,
          canvasRenderMode: state.canvasRenderMode,
          canvas3dMode: state.canvas3dMode,
          canvas2dRenderer: state.canvas2dRenderer,
          canvasRenderModeLastFree: state.canvasRenderModeLastFree,
          canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
          viewPinned: state.viewPinned,
          fitToScreenMode: state.fitToScreenMode,
          zoomToSelectionMode: state.zoomToSelectionMode,
          zoomState: state.zoomState,
          zoomStateByKey: state.zoomStateByKey,
          selectedNodeId: state.selectedNodeId,
          selectedEdgeId: state.selectedEdgeId,
          selectedGroupId: state.selectedGroupId,
          selectedNodeIds: state.selectedNodeIds,
          selectedEdgeIds: state.selectedEdgeIds,
          selectedGroupIds: state.selectedGroupIds,
          collapsedGroupIds: state.collapsedGroupIds,
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
          canvas3dMode: DEFAULT_CANVAS_3D_MODE,
          canvas2dRenderer: DEFAULT_CANVAS_2D_RENDERER,
          canvasRenderModeLastFree: '2d',
          canvasRenderModeIsAuto: false,
          viewPinned: false,
          fitToScreenMode: true,
          zoomToSelectionMode: false,
          zoomState: null,
          zoomRequest: null,
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedGroupId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          selectedGroupIds: [],
          collapsedGroupIds: [],
        } as Partial<GraphState>
      }),
    codeHighlightDurationMs: 1000,
    codeSelectThrottleMs: 100,
    codeHighlightUntilClick: true,

    viewportFitFillRatio: clampFillRatio(lsFloat(LS_KEYS.viewportFitFillRatio, DEFAULT_FIT_TO_SCREEN_FILL_RATIO, { min: 0.2, max: 0.95 })),
    setViewportFitFillRatio: (v: number) =>
      set(state => {
        const next = clampFillRatio(typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_FIT_TO_SCREEN_FILL_RATIO)
        if (state.viewportFitFillRatio === next) return {}
        lsSetFloat(LS_KEYS.viewportFitFillRatio, next, { min: 0.2, max: 0.95 })
        return { viewportFitFillRatio: next } as Partial<GraphState>
      }),

    graphDragAlphaTarget2d: lsFloat(LS_KEYS.graphDragAlphaTarget2d, DEFAULT_DRAG_ALPHA_TARGET, { min: 0, max: 0.6 }),
    setGraphDragAlphaTarget2d: (v: number) =>
      set(state => {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_DRAG_ALPHA_TARGET
        const next = Math.max(0, Math.min(0.6, n))
        if (state.graphDragAlphaTarget2d === next) return {}
        lsSetFloat(LS_KEYS.graphDragAlphaTarget2d, next, { min: 0, max: 0.6 })
        return { graphDragAlphaTarget2d: next } as Partial<GraphState>
      }),

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

    autoEnableGeospatialOnGeoImport: lsBool(LS_KEYS.geospatialAutoEnableOnGeoImport, true),

    pdfImportIncludeImages: lsBool(LS_KEYS.pdfImportIncludeImages, true),
    pdfImportMaxPages: lsInt(LS_KEYS.pdfImportMaxPages, 0),
    pdfImportMaxPdfBytes: lsInt(LS_KEYS.pdfImportMaxPdfBytes, 100 * 1024 * 1024),
    pdfImportFetchTimeoutMs: lsInt(LS_KEYS.pdfImportFetchTimeoutMs, 60_000),
    pdfImportUploadTimeoutMs: lsInt(LS_KEYS.pdfImportUploadTimeoutMs, 30_000),
    pdfImportConvertTimeoutMs: lsInt(LS_KEYS.pdfImportConvertTimeoutMs, 180_000),
    pdfImportStreamDecodeCacheMaxBytes: lsInt(LS_KEYS.pdfImportStreamDecodeCacheMaxBytes, 64 * 1024 * 1024),
    pdfImportContentStreamMaxDecodeBytes: lsInt(LS_KEYS.pdfImportContentStreamMaxDecodeBytes, 8 * 1024 * 1024),
    pdfImportPageContentMaxBytes: lsInt(LS_KEYS.pdfImportPageContentMaxBytes, 8 * 1024 * 1024),
    pdfImportCmapMaxBytes: lsInt(LS_KEYS.pdfImportCmapMaxBytes, 256 * 1024),
    pdfImportMaxToUnicodeStreamBytes: lsInt(LS_KEYS.pdfImportMaxToUnicodeStreamBytes, 256 * 1024),
    pdfImportToUnicodeMaxDecodeBytes: lsInt(LS_KEYS.pdfImportToUnicodeMaxDecodeBytes, 512 * 1024),
    pdfImportImageStreamMaxDecodeBytes: lsInt(LS_KEYS.pdfImportImageStreamMaxDecodeBytes, 32 * 1024 * 1024),
    pdfImportMaxTextContentBytesPerPage: lsInt(LS_KEYS.pdfImportMaxTextContentBytesPerPage, 512 * 1024),
    pdfImportMaxTextStreamBytes: lsInt(LS_KEYS.pdfImportMaxTextStreamBytes, 256 * 1024),
    pdfImportMaxFormXObjectBytes: lsInt(LS_KEYS.pdfImportMaxFormXObjectBytes, 512 * 1024),
    pdfImportMaxFormXObjectStreamBytes: lsInt(LS_KEYS.pdfImportMaxFormXObjectStreamBytes, 256 * 1024),
    pdfImportMaxFormXObjectCount: lsInt(LS_KEYS.pdfImportMaxFormXObjectCount, 64),
    pdfImportEmbedImages: lsBool(LS_KEYS.pdfImportEmbedImages, false),
    pdfImportMaxExtractedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, 6),
    pdfImportMaxEmbeddedImagesPerPage: lsInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, 6),
    pdfImportMaxEmbeddedTotalBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, 4 * 1024 * 1024),
    pdfImportMaxEmbeddedAssetBytes: lsInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, 2 * 1024 * 1024),
    pdfImportReconstructTables: lsBool(LS_KEYS.pdfImportReconstructTables, true),
    pdfImportTableMinColumns: lsInt(LS_KEYS.pdfImportTableMinColumns, 2),
    pdfImportTableMinRows: lsInt(LS_KEYS.pdfImportTableMinRows, 3),
    pdfImportTableMaxRows: lsInt(LS_KEYS.pdfImportTableMaxRows, 60),
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
    pdfImportOcrEnabled: lsBool(LS_KEYS.pdfImportOcrEnabled, false),
    pdfImportOcrMode: lsJson<'fallback' | 'always'>(
      LS_KEYS.pdfImportOcrMode,
      'fallback',
      v => (v === 'always' || v === 'fallback' ? v : 'fallback'),
    ),
    launchSpotlightMode: 'tour' as const,
    enableLaunchSpotlight: (() => {
      const storage = getLocalStorage();
      return getInitialLaunchSpotlightEnabled(storage, false);
    })(),
    statusPanelPinned: lsBool(LS_KEYS.statusPanelPinned, false),

    setEditMode: (mode: boolean) => set({ isEditMode: mode }),

    setWorkspaceViewMode: (mode: 'canvas' | 'editor') =>
      set(state => {
        const nextMode = mode === 'editor' ? 'editor' : 'canvas'
        if (state.workspaceViewMode === nextMode) return {}
        return { workspaceViewMode: lsSetJson(LS_KEYS.workspaceViewMode, nextMode) }
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

    setAutoEnableGeospatialOnGeoImport: (v: boolean) =>
      set({ autoEnableGeospatialOnGeoImport: lsSetBool(LS_KEYS.geospatialAutoEnableOnGeoImport, v === true) }),

    setPdfImportIncludeImages: (v: boolean) => set({ pdfImportIncludeImages: lsSetBool(LS_KEYS.pdfImportIncludeImages, !!v) }),
    setPdfImportMaxPages: (v: number) =>
      set({ pdfImportMaxPages: lsSetInt(LS_KEYS.pdfImportMaxPages, v, { min: 0, max: 10_000 }) }),
    setPdfImportMaxPdfBytes: (v: number) =>
      set({ pdfImportMaxPdfBytes: lsSetInt(LS_KEYS.pdfImportMaxPdfBytes, v, { min: 1_000_000, max: 2_000_000_000 }) }),
    setPdfImportFetchTimeoutMs: (v: number) =>
      set({ pdfImportFetchTimeoutMs: lsSetInt(LS_KEYS.pdfImportFetchTimeoutMs, v, { min: 1_000, max: 10 * 60_000 }) }),
    setPdfImportUploadTimeoutMs: (v: number) =>
      set({ pdfImportUploadTimeoutMs: lsSetInt(LS_KEYS.pdfImportUploadTimeoutMs, v, { min: 1_000, max: 10 * 60_000 }) }),
    setPdfImportConvertTimeoutMs: (v: number) =>
      set({ pdfImportConvertTimeoutMs: lsSetInt(LS_KEYS.pdfImportConvertTimeoutMs, v, { min: 1_000, max: 30 * 60_000 }) }),
    setPdfImportStreamDecodeCacheMaxBytes: (v: number) =>
      set({ pdfImportStreamDecodeCacheMaxBytes: lsSetInt(LS_KEYS.pdfImportStreamDecodeCacheMaxBytes, v, { min: 1_000_000, max: 2_000_000_000 }) }),
    setPdfImportContentStreamMaxDecodeBytes: (v: number) =>
      set({ pdfImportContentStreamMaxDecodeBytes: lsSetInt(LS_KEYS.pdfImportContentStreamMaxDecodeBytes, v, { min: 64 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportPageContentMaxBytes: (v: number) =>
      set({ pdfImportPageContentMaxBytes: lsSetInt(LS_KEYS.pdfImportPageContentMaxBytes, v, { min: 64 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportCmapMaxBytes: (v: number) =>
      set({ pdfImportCmapMaxBytes: lsSetInt(LS_KEYS.pdfImportCmapMaxBytes, v, { min: 8 * 1024, max: 32 * 1024 * 1024 }) }),
    setPdfImportMaxToUnicodeStreamBytes: (v: number) =>
      set({ pdfImportMaxToUnicodeStreamBytes: lsSetInt(LS_KEYS.pdfImportMaxToUnicodeStreamBytes, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportToUnicodeMaxDecodeBytes: (v: number) =>
      set({ pdfImportToUnicodeMaxDecodeBytes: lsSetInt(LS_KEYS.pdfImportToUnicodeMaxDecodeBytes, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportImageStreamMaxDecodeBytes: (v: number) =>
      set({ pdfImportImageStreamMaxDecodeBytes: lsSetInt(LS_KEYS.pdfImportImageStreamMaxDecodeBytes, v, { min: 64 * 1024, max: 2_000_000_000 }) }),
    setPdfImportMaxTextContentBytesPerPage: (v: number) =>
      set({ pdfImportMaxTextContentBytesPerPage: lsSetInt(LS_KEYS.pdfImportMaxTextContentBytesPerPage, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportMaxTextStreamBytes: (v: number) =>
      set({ pdfImportMaxTextStreamBytes: lsSetInt(LS_KEYS.pdfImportMaxTextStreamBytes, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportMaxFormXObjectBytes: (v: number) =>
      set({ pdfImportMaxFormXObjectBytes: lsSetInt(LS_KEYS.pdfImportMaxFormXObjectBytes, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportMaxFormXObjectStreamBytes: (v: number) =>
      set({ pdfImportMaxFormXObjectStreamBytes: lsSetInt(LS_KEYS.pdfImportMaxFormXObjectStreamBytes, v, { min: 8 * 1024, max: 256 * 1024 * 1024 }) }),
    setPdfImportMaxFormXObjectCount: (v: number) =>
      set({ pdfImportMaxFormXObjectCount: lsSetInt(LS_KEYS.pdfImportMaxFormXObjectCount, v, { min: 0, max: 10_000 }) }),
    setPdfImportEmbedImages: (v: boolean) => set({ pdfImportEmbedImages: lsSetBool(LS_KEYS.pdfImportEmbedImages, !!v) }),
    setPdfImportMaxExtractedImagesPerPage: (v: number) =>
      set({ pdfImportMaxExtractedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxExtractedImagesPerPage, v, { min: 0, max: 50 }) }),
    setPdfImportMaxEmbeddedImagesPerPage: (v: number) =>
      set({ pdfImportMaxEmbeddedImagesPerPage: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedImagesPerPage, v, { min: 0, max: 50 }) }),
    setPdfImportMaxEmbeddedTotalBytes: (v: number) =>
      set({ pdfImportMaxEmbeddedTotalBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedTotalBytes, v, { min: 0, max: 50 * 1024 * 1024 }) }),
    setPdfImportMaxEmbeddedAssetBytes: (v: number) =>
      set({ pdfImportMaxEmbeddedAssetBytes: lsSetInt(LS_KEYS.pdfImportMaxEmbeddedAssetBytes, v, { min: 0, max: 20 * 1024 * 1024 }) }),
    setPdfImportReconstructTables: (v: boolean) => set({ pdfImportReconstructTables: lsSetBool(LS_KEYS.pdfImportReconstructTables, !!v) }),
    setPdfImportTableMinColumns: (v: number) =>
      set({ pdfImportTableMinColumns: lsSetInt(LS_KEYS.pdfImportTableMinColumns, v, { min: 2, max: 12 }) }),
    setPdfImportTableMinRows: (v: number) =>
      set({ pdfImportTableMinRows: lsSetInt(LS_KEYS.pdfImportTableMinRows, v, { min: 2, max: 20 }) }),
    setPdfImportTableMaxRows: (v: number) =>
      set({ pdfImportTableMaxRows: lsSetInt(LS_KEYS.pdfImportTableMaxRows, v, { min: 5, max: 200 }) }),
    setPdfImportProvider: (v: 'native' | 'docling-remote') =>
      set({ pdfImportProvider: lsSetJson(LS_KEYS.pdfImportProvider, v === 'docling-remote' ? 'docling-remote' : 'native') }),
    setPdfImportDoclingEndpoint: (v: string | null) =>
      set({ pdfImportDoclingEndpoint: lsSetJson(LS_KEYS.pdfImportDoclingEndpoint, typeof v === 'string' ? v : null) }),
    setPdfImportProviderFallbackToNative: (v: boolean) =>
      set({ pdfImportProviderFallbackToNative: lsSetBool(LS_KEYS.pdfImportProviderFallbackToNative, !!v) }),
    setPdfImportOcrEnabled: (v: boolean) =>
      set({ pdfImportOcrEnabled: lsSetBool(LS_KEYS.pdfImportOcrEnabled, !!v) }),
    setPdfImportOcrMode: (v: 'fallback' | 'always') =>
      set({ pdfImportOcrMode: lsSetJson(LS_KEYS.pdfImportOcrMode, v === 'always' ? 'always' : 'fallback') }),
    setLaunchSpotlightMode: (mode: 'tour' | 'stats') => set({ launchSpotlightMode: mode === 'stats' ? 'stats' : 'tour' }),
    setEnableLaunchSpotlight: (v: boolean) => {
      const storage = getLocalStorage();
      const next = persistLaunchSpotlightEnabled(storage, v);
      set({ enableLaunchSpotlight: next });
    },
    setStatusPanelPinned: (v: boolean) => set({ statusPanelPinned: lsSetBool(LS_KEYS.statusPanelPinned, v) }),
  }
}
