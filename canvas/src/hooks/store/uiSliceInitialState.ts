
import type { StoreApi } from 'zustand'
import type { GraphState } from '@/hooks/store/types'
import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage, lsSetBool, lsSetFloat, lsSetJson } from '@/lib/persistence'
import { getInitialLaunchSpotlightEnabled } from '@/features/spotlight/storage'
import { createPanelLayoutUiSlice } from '@/hooks/store/panelLayoutUiSlice'
import { GRABMAPS_DEFAULT_DIRECTIONS_URL, GRABMAPS_DEFAULT_STYLE_URL } from 'grph-shared/geospatial/grabMapsSsot'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { clampFillRatio } from 'grph-shared/zoom/presets'
import { DEFAULT_DRAG_ALPHA_TARGET, DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from '@/lib/graph/layoutDefaults'
import { readGrabMapsByokApiKeyFromBrowser } from 'grph-shared/geospatial/grabMapsAuth'
import type { UiStorageReaders } from './uiSliceStorage'
import {
  CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT,
  CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT,
  CHAT_AI_MARKDOWN_MAX_TOKENS_DEFAULT,
  CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT,
  DEFAULT_INTEGRATION_CONFIGS,
  type InitialChatUiContext,
  clampChatCompletionTokens,
  clampChatContextMaxTokens,
  clampChatTopLogprobs,
  isCanonicalKgcWorkspacePath,
  normalizeChatJsonText,
  normalizeChatReasoningEffort,
  normalizeChatServiceTier,
  normalizeChatThinkingType,
  parseIntegrationConfigsJson,
  stringifyIntegrationConfigs,
} from './uiSliceChat'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiInitialState = (
  set: SetGraph,
  readers: UiStorageReaders,
  chat: InitialChatUiContext,
)=> {
  const { lsNum, lsBool, lsInt, lsFloat, lsJson } = readers
  const { initialChatProvider, initialChatAuthMode, initialChatEndpointUrl, initialChatModel } = chat
  const initialWorkspaceViewMode = lsJson<'canvas' | 'editor'>(
    LS_KEYS.workspaceViewMode,
    'canvas',
    value => (value === 'editor' || value === 'canvas' ? value : 'canvas'),
  )
  const initialWorkspaceCanvasPaneOpen = initialWorkspaceViewMode === 'editor'
    ? true
    : lsBool(LS_KEYS.workspaceCanvasPaneOpen, true)
  return {
    ...createPanelLayoutUiSlice(set),

    isEditMode: false,

    floatingPanelOpen: false,
    setFloatingPanelOpen: (open: boolean) =>
      set(state => {
        const next = open === true
        if (state.floatingPanelOpen === next) return {}
        return { floatingPanelOpen: next } as Partial<GraphState>
      }),

    floatingPanelView: 'geo' as GraphState['floatingPanelView'],
    setFloatingPanelView: (view: GraphState['floatingPanelView']) =>
      set(state => {
        const next =
          view === 'interaction'
          || view === 'domTree'
          || view === 'domInspect'
          || view === 'chat'
          || view === 'geo'
          || view === 'renderer'
          || view === 'graphTraversal'
            ? view
            : 'propsPanel'
        if (state.floatingPanelView === next) return {}
        return { floatingPanelView: next } as Partial<GraphState>
      }),

    workspaceViewMode: initialWorkspaceViewMode,

    editorWorkspacePane: lsJson<'markdown' | 'graphTable'>(
      LS_KEYS.editorWorkspacePane,
      'markdown',
      value => (value === 'graphTable' || value === 'markdown' ? value : 'markdown'),
    ),

    workspaceCanvasPaneOpen: initialWorkspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: false,
    setWorkspaceCanvasPaneOpen: (open: boolean) =>
      set(state => {
        const rawNext = open === false ? false : true
        const next = state.workspaceViewMode === 'editor' ? true : rawNext
        if (state.workspaceCanvasPaneOpen === next) return {}
        lsSetBool(LS_KEYS.workspaceCanvasPaneOpen, next)
        return { workspaceCanvasPaneOpen: next } as Partial<GraphState>
      }),
    setMarkdownWorkspaceIndexingInFlight: (inFlight: boolean) =>
      set(state => {
        const next = inFlight === true
        if (state.markdownWorkspaceIndexingInFlight === next) return {}
        return { markdownWorkspaceIndexingInFlight: next } as Partial<GraphState>
      }),

    paymentsStripePaywallEnabled: lsBool(LS_KEYS.paymentsStripePaywallEnabled, false),
    setPaymentsStripePaywallEnabled: (enabled: boolean) =>
      set(state => {
        const next = enabled === true
        if (state.paymentsStripePaywallEnabled === next) return {}
        lsSetBool(LS_KEYS.paymentsStripePaywallEnabled, next)
        return { paymentsStripePaywallEnabled: next } as Partial<GraphState>
      }),

    paymentsStripeCheckoutUrl: lsJson<string>(
      LS_KEYS.paymentsStripeCheckoutUrl,
      '',
      value => (typeof value === 'string' ? value : ''),
    ),
    setPaymentsStripeCheckoutUrl: (url: string) =>
      set(state => {
        const next = String(url || '').trim()
        if (state.paymentsStripeCheckoutUrl === next) return {}
        lsSetJson(LS_KEYS.paymentsStripeCheckoutUrl, next)
        return { paymentsStripeCheckoutUrl: next } as Partial<GraphState>
      }),

    documentStructureBaselineLock: lsBool(LS_KEYS.documentStructureBaselineLock, false),
    documentStructureBaselineSnapshot: null,
    setDocumentStructureBaselineLock: (enabled: boolean) =>
      set(state => {
        const next = enabled === false ? false : true
        if (state.documentStructureBaselineLock === next) return {}
        lsSetBool(LS_KEYS.documentStructureBaselineLock, next)
        return {
          documentStructureBaselineLock: next,
          documentStructureBaselineSnapshot: null,
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
      'hover:bg-[var(--kg-panel-action-bg-hover)]',
      value => {
        if (typeof value !== 'string') return 'hover:bg-[var(--kg-panel-action-bg-hover)]'
        const normalized = value.trim()
        if (!normalized || normalized === 'hover:bg-gray-100') return 'hover:bg-[var(--kg-panel-action-bg-hover)]'
        return normalized
      },
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
    chatProvider: initialChatProvider,
    chatAuthMode: initialChatAuthMode,
    chatApiKey: '',
    chatEndpointUrl: initialChatEndpointUrl,
    chatModel: initialChatModel,
    chatTemperature: lsNum(LS_KEYS.chatTemperature, 0.3),
    chatMaxCompletionTokens: clampChatCompletionTokens(
      lsInt(LS_KEYS.chatMaxCompletionTokens, CHAT_AI_MARKDOWN_MAX_TOKENS_DEFAULT),
    ),
    chatServiceTier: lsJson<'auto' | 'default'>(
      LS_KEYS.chatServiceTier,
      'auto',
      value => normalizeChatServiceTier(value),
    ),
    chatStream: lsBool(LS_KEYS.chatStream, true),
    chatMessagesJson: lsJson<string>(LS_KEYS.chatMessagesJson, '', value => normalizeChatJsonText(value)),
    chatReasoningEffort: lsJson<'minimal' | 'low' | 'medium' | 'high'>(
      LS_KEYS.chatReasoningEffort,
      'medium',
      value => normalizeChatReasoningEffort(value),
    ),
    chatThinkingType: lsJson<'enabled' | 'disabled' | 'auto'>(
      LS_KEYS.chatThinkingType,
      'enabled',
      value => normalizeChatThinkingType(value),
    ),
    chatThinkingJson: lsJson<string>(LS_KEYS.chatThinkingJson, '', value => normalizeChatJsonText(value)),
    chatFrequencyPenalty: lsFloat(LS_KEYS.chatFrequencyPenalty, 0, { min: -2, max: 2 }),
    chatPresencePenalty: lsFloat(LS_KEYS.chatPresencePenalty, 0, { min: -2, max: 2 }),
    chatTopP: lsFloat(LS_KEYS.chatTopP, 0.7, { min: 0, max: 1 }),
    chatLogprobs: lsBool(LS_KEYS.chatLogprobs, false),
    chatTopLogprobs: clampChatTopLogprobs(lsInt(LS_KEYS.chatTopLogprobs, 0)),
    chatParallelToolCalls: lsBool(LS_KEYS.chatParallelToolCalls, true),
    chatStopJson: lsJson<string>(LS_KEYS.chatStopJson, '', value => normalizeChatJsonText(value)),
    chatStreamOptionsJson: lsJson<string>(LS_KEYS.chatStreamOptionsJson, '', value => normalizeChatJsonText(value)),
    chatResponseFormatJson: lsJson<string>(LS_KEYS.chatResponseFormatJson, '', value => normalizeChatJsonText(value)),
    chatLogitBiasJson: lsJson<string>(LS_KEYS.chatLogitBiasJson, '', value => normalizeChatJsonText(value)),
    chatToolsJson: lsJson<string>(LS_KEYS.chatToolsJson, '', value => normalizeChatJsonText(value)),
    chatToolChoiceJson: lsJson<string>(LS_KEYS.chatToolChoiceJson, '', value => normalizeChatJsonText(value)),
    chatGraphSummaryMaxTokens: clampChatContextMaxTokens(
      lsInt(LS_KEYS.chatGraphSummaryMaxTokens, CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT),
      CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT,
    ),
    chatGuidelineDigestMaxTokens: clampChatContextMaxTokens(
      lsInt(LS_KEYS.chatGuidelineDigestMaxTokens, CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT),
      CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT,
    ),
    chatSystemPrompt: lsJson<string | null>(
      LS_KEYS.chatSystemPrompt,
      null,
      value => (typeof value === 'string' ? value : null),
    ),
    chatStorageTarget: lsJson<'chatKnowgrph' | 'chatHistory'>(
      LS_KEYS.chatStorageTarget,
      'chatKnowgrph',
      value => {
        const raw = String(value || '').trim().toLowerCase()
        if (raw === 'chathistory') return 'chatHistory'
        return 'chatKnowgrph'
      },
    ),
    chatLocalStorageRootPath: lsJson<string>(
      LS_KEYS.chatLocalStorageRootPath,
      CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT,
      value => {
        const raw = typeof value === 'string' ? value.trim() : ''
        if (raw === '/chats' || raw === 'chats') return CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT
        return raw || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT
      },
    ),
    chatKnowgrphStorageMode: lsJson<'local' | 'cloud'>(
      LS_KEYS.chatKnowgrphStorageMode,
      'local',
      value => (String(value || '').trim().toLowerCase() === 'cloud' ? 'cloud' : 'local'),
    ),
    chatKnowgrphWorkspacePath: lsJson<string | null>(
      LS_KEYS.chatKnowgrphWorkspacePath,
      null,
      value => {
        const raw = typeof value === 'string' ? value.trim() : ''
        if (!raw) return null
        return isCanonicalKgcWorkspacePath(raw) ? raw : null
      },
    ),
    chatKnowgrphCloudUrl: lsJson<string | null>(
      LS_KEYS.chatKnowgrphCloudUrl,
      null,
      value => {
        const raw = typeof value === 'string' ? value.trim() : ''
        return raw ? raw : null
      },
    ),
    chatHistoryWorkspacePath: lsJson<string | null>(
      LS_KEYS.chatHistoryWorkspacePath,
      null,
      value => {
        const raw = typeof value === 'string' ? value.trim() : ''
        return raw ? raw : null
      },
    ),
    chatHistoryStorageMode: lsJson<'local' | 'cloud'>(
      LS_KEYS.chatHistoryStorageMode,
      'local',
      value => {
        const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
        return raw === 'cloud' ? 'cloud' : 'local'
      },
    ),
    chatHistoryCloudUrl: lsJson<string | null>(
      LS_KEYS.chatHistoryCloudUrl,
      null,
      value => {
        const raw = typeof value === 'string' ? value.trim() : ''
        return raw ? raw : null
      },
    ),
    chatContextScope: lsJson<'selection' | 'workspace' | 'hybrid'>(
      LS_KEYS.chatContextScope,
      'workspace',
      value => {
        const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
        if (raw === 'selection') return 'selection'
        if (raw === 'hybrid') return 'hybrid'
        return 'workspace'
      },
    ),
    integrationConfigsJson: lsJson<string>(
      LS_KEYS.integrationConfigsJson,
      stringifyIntegrationConfigs(DEFAULT_INTEGRATION_CONFIGS),
      value => stringifyIntegrationConfigs(parseIntegrationConfigsJson(typeof value === 'string' ? value : null)),
    ),

    grabMapsAuthMode: lsJson<'serverManaged' | 'byok'>(
      LS_KEYS.grabMapsAuthMode,
      'byok',
      value => (value === 'serverManaged' ? 'serverManaged' : 'byok'),
    ),
    grabMapsApiKey: readGrabMapsByokApiKeyFromBrowser(),
    grabMapsDirectionsEndpointUrl: lsJson<string>(
      LS_KEYS.grabMapsDirectionsEndpointUrl,
      GRABMAPS_DEFAULT_DIRECTIONS_URL,
      v => (typeof v === 'string' && v.trim() ? v.trim() : GRABMAPS_DEFAULT_DIRECTIONS_URL),
    ),
    grabMapsDirectionsOverview: lsJson<string>(
      LS_KEYS.grabMapsDirectionsOverview,
      'full',
      v => (typeof v === 'string' && v.trim() ? v.trim() : 'full'),
    ),
    grabMapsDirectionsLatFirst: lsBool(LS_KEYS.grabMapsDirectionsLatFirst, false),
    grabMapsDirectionsAlternatives: lsBool(LS_KEYS.grabMapsDirectionsAlternatives, false),
    grabMapsDirectionsSteps: lsBool(LS_KEYS.grabMapsDirectionsSteps, false),
    grabMapsDirectionsLanguage: lsJson<string>(
      LS_KEYS.grabMapsDirectionsLanguage,
      'en',
      v => (typeof v === 'string' && v.trim() ? v.trim() : 'en'),
    ),
    grabMapsDirectionsUnits: lsJson<string>(
      LS_KEYS.grabMapsDirectionsUnits,
      'metric',
      v => {
        const raw = typeof v === 'string' ? v.trim().toLowerCase() : ''
        return raw === 'imperial' ? 'imperial' : 'metric'
      },
    ),
    grabMapsDirectionsOriginLng: lsFloat(LS_KEYS.grabMapsDirectionsOriginLng, 103.8198, { min: -180, max: 180 }),
    grabMapsDirectionsOriginLat: lsFloat(LS_KEYS.grabMapsDirectionsOriginLat, 1.3521, { min: -90, max: 90 }),
    grabMapsDirectionsDestinationLng: lsFloat(LS_KEYS.grabMapsDirectionsDestinationLng, 103.851959, { min: -180, max: 180 }),
    grabMapsDirectionsDestinationLat: lsFloat(LS_KEYS.grabMapsDirectionsDestinationLat, 1.29027, { min: -90, max: 90 }),
    grabMapsDirectionsWaypointsJson: lsJson<string>(
      LS_KEYS.grabMapsDirectionsWaypointsJson,
      '[]',
      v => (typeof v === 'string' ? v : '[]'),
    ),
    grabMapsDirectionsAnnotationsJson: lsJson<string>(
      LS_KEYS.grabMapsDirectionsAnnotationsJson,
      '[]',
      v => (typeof v === 'string' ? v : '[]'),
    ),
    grabMapsDirectionsExtraParamsJson: lsJson<string>(
      LS_KEYS.grabMapsDirectionsExtraParamsJson,
      '{}',
      v => (typeof v === 'string' ? v : '{}'),
    ),
    grabMapsBasemapStyleUrl: lsJson<string>(
      LS_KEYS.grabMapsBasemapStyleUrl,
      GRABMAPS_DEFAULT_STYLE_URL,
      v => (typeof v === 'string' && v.trim() ? v.trim() : GRABMAPS_DEFAULT_STYLE_URL),
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

  }
}
