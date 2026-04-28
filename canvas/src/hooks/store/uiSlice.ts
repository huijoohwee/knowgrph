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
import { LS_KEYS } from '@/lib/config.ls.keys'
import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'
import { getInitialLaunchSpotlightEnabled, persistLaunchSpotlightEnabled } from '@/features/spotlight/storage'
import { createPanelLayoutUiSlice } from '@/hooks/store/panelLayoutUiSlice'
import { GRABMAPS_DEFAULT_DIRECTIONS_URL, GRABMAPS_DEFAULT_STYLE_URL } from 'grph-shared/geospatial/grabMapsSsot'
import {
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_DEFAULT_MODEL,
  normalizeChatEndpointUrlInput,
  CHAT_DEFAULT_PROVIDER,
  normalizeChatModelIdForProvider,
  normalizeChatProviderId,
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_OPENAI_ENDPOINT_URL,
  getChatModelOptions,
  getDefaultChatModelForProvider,
} from '@/lib/chatEndpoint'
import {
  DEFAULT_INTEGRATION_CONFIGS,
  parseIntegrationConfigsJson,
  stringifyIntegrationConfigs,
} from '@/features/integrations/config'
import { CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT } from '@/features/chat/chatStorageConfig'
import {
  CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT,
  CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT,
  CHAT_AI_MARKDOWN_MAX_TOKENS_DEFAULT,
  clampChatCompletionTokens,
  clampChatContextMaxTokens,
} from '@/features/chat/chatAiMarkdownSpec'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { clampFillRatio } from 'grph-shared/zoom/presets'
import { DEFAULT_DRAG_ALPHA_TARGET, DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from '@/lib/graph/layoutDefaults'
import { writeGrabMapsByokApiKeyToBrowser, readGrabMapsByokApiKeyFromBrowser } from 'grph-shared/geospatial/grabMapsAuth'

type SetGraph = StoreApi<GraphState>['setState']

const isCanonicalKgcWorkspacePath = (value: unknown): boolean => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return false
  const normalized = raw.replace(/\\/g, '/')
  const fileName = normalized.split('/').filter(Boolean).slice(-1)[0] || ''
  return /^kgc_\d{14}\.md$/i.test(fileName)
}

const clampChatPenalty = (value: unknown): number => {
  const next = Number(value)
  if (!Number.isFinite(next)) return 0
  return Math.max(-2, Math.min(2, next))
}

const clampChatTopP = (value: unknown): number => {
  const next = Number(value)
  if (!Number.isFinite(next)) return 0.7
  return Math.max(0, Math.min(1, next))
}

const clampChatTopLogprobs = (value: unknown): number => {
  const next = Math.floor(Number(value))
  if (!Number.isFinite(next)) return 0
  return Math.max(0, Math.min(20, next))
}

const normalizeChatServiceTier = (value: unknown): 'auto' | 'default' => {
  return String(value || '').trim().toLowerCase() === 'default' ? 'default' : 'auto'
}

const normalizeChatReasoningEffort = (value: unknown): 'minimal' | 'low' | 'medium' | 'high' => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'minimal' || raw === 'low' || raw === 'high') return raw
  return 'medium'
}

const normalizeChatThinkingType = (value: unknown): 'enabled' | 'disabled' | 'auto' => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'disabled' || raw === 'auto') return raw
  return 'enabled'
}

const normalizeChatJsonText = (value: unknown): string => {
  return typeof value === 'string' ? value : ''
}

export const createUiSlice = (set: SetGraph) => {
  const storedChatProvider = lsJson<string>(
    LS_KEYS.chatProvider,
    CHAT_DEFAULT_PROVIDER,
    value => normalizeChatProviderId(value),
  )
  const storedChatModel = lsJson<string | null>(
    LS_KEYS.chatModel,
    null,
    value => (typeof value === 'string' ? value : null),
  )
  const normalizedStoredProvider = normalizeChatProviderId(storedChatProvider)
  const normalizedStoredModel = normalizeChatModelIdForProvider(storedChatModel, normalizedStoredProvider)
  const shouldMigrateLegacyProviderDefault =
    normalizedStoredProvider !== CHAT_DEFAULT_PROVIDER &&
    !normalizedStoredModel &&
    getChatModelOptions(normalizedStoredProvider).length === 0
  const initialChatProvider = shouldMigrateLegacyProviderDefault
    ? CHAT_DEFAULT_PROVIDER
    : normalizedStoredProvider
  const initialChatAuthMode = lsJson<'serverManaged' | 'byok'>(
    LS_KEYS.chatAuthMode,
    'serverManaged',
    value => (value === 'byok' ? 'byok' : 'serverManaged'),
  )
  const storedChatEndpointUrl = lsJson<string | null>(
    LS_KEYS.chatEndpointUrl,
    null,
    value => (typeof value === 'string' ? value : null),
  )
  const initialChatEndpointUrl = lsJson<string | null>(
    LS_KEYS.chatEndpointUrl,
    shouldMigrateLegacyProviderDefault
      ? normalizeChatEndpointUrlInput(null, initialChatProvider)
      : normalizeChatEndpointUrlInput(storedChatEndpointUrl, initialChatProvider),
    value => {
      const normalized = normalizeChatEndpointUrlInput(value, initialChatProvider)
      if (!shouldMigrateLegacyProviderDefault) return normalized
      const raw = typeof value === 'string' ? value.trim() : ''
      const shouldKeepCustomEndpoint =
        !!raw &&
        raw !== CHAT_DEFAULT_ENDPOINT_URL &&
        raw !== CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL &&
        raw !== CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL &&
        raw !== CHAT_OPENAI_ENDPOINT_URL
      return shouldKeepCustomEndpoint
        ? normalizeChatEndpointUrlInput(raw, initialChatProvider)
        : normalizeChatEndpointUrlInput(null, initialChatProvider)
    },
  )
  const initialChatModel = normalizeChatModelIdForProvider(
    shouldMigrateLegacyProviderDefault ? null : storedChatModel,
    initialChatProvider,
  ) || getDefaultChatModelForProvider(initialChatProvider)
  return {
    ...createPanelLayoutUiSlice(set),

    isEditMode: false,

    floatingPanelOpen: true,
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
    setChatAuthMode: (mode: 'serverManaged' | 'byok') =>
      set(state => {
        const next = mode === 'byok' ? 'byok' : 'serverManaged'
        if (state.chatAuthMode === next) return {}
        const patch: Partial<GraphState> = {
          chatAuthMode: lsSetJson(LS_KEYS.chatAuthMode, next),
        }
        if (next === 'serverManaged' && state.chatApiKey) {
          patch.chatApiKey = ''
        }
        return patch
      }),
    setChatProvider: (provider: string) =>
      set(state => {
        const normalizedProvider = normalizeChatProviderId(provider)
        if (state.chatProvider === normalizedProvider) return {}
        const nextModel = normalizeChatModelIdForProvider(state.chatModel, normalizedProvider)
        const prevEndpoint = String(state.chatEndpointUrl || '').trim()
        const prevProviderDefault = normalizeChatEndpointUrlInput(null, state.chatProvider)
        const shouldResetEndpoint =
          !prevEndpoint ||
          prevEndpoint === prevProviderDefault ||
          prevEndpoint === CHAT_DEFAULT_ENDPOINT_URL ||
          prevEndpoint === CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL ||
          prevEndpoint === CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL ||
          prevEndpoint === CHAT_OPENAI_ENDPOINT_URL
        const nextEndpoint = shouldResetEndpoint
          ? normalizeChatEndpointUrlInput(null, normalizedProvider)
          : normalizeChatEndpointUrlInput(prevEndpoint, normalizedProvider)
        return {
          chatProvider: lsSetJson(LS_KEYS.chatProvider, normalizedProvider),
          chatModel: lsSetJson(LS_KEYS.chatModel, nextModel),
          chatEndpointUrl: lsSetJson(LS_KEYS.chatEndpointUrl, nextEndpoint),
        }
      }),
    setChatApiKey: (apiKey: string | null) =>
      set(state => {
        const sanitized = String(apiKey || '')
          .replace(/[\r\n]/g, '')
          .trim()
          .slice(0, 512)
        if (state.chatAuthMode === 'serverManaged' && sanitized) {
          return {
            chatAuthMode: lsSetJson(LS_KEYS.chatAuthMode, 'byok'),
            chatApiKey: sanitized,
          }
        }
        if (state.chatApiKey === sanitized) return {}
        return { chatApiKey: sanitized }
      }),
    setChatEndpointUrl: (url: string | null) =>
      set(state => ({
        chatEndpointUrl: lsSetJson(
          LS_KEYS.chatEndpointUrl,
          normalizeChatEndpointUrlInput(url, state.chatProvider),
        ),
      })),
    setChatModel: (model: string | null) =>
      set(state => {
        const nextProvider = normalizeChatProviderId(state.chatProvider)
        return {
          chatModel: lsSetJson(
            LS_KEYS.chatModel,
            normalizeChatModelIdForProvider(model, nextProvider),
          ),
        }
      }),
    setChatTemperature: (v: number) =>
      set({
        chatTemperature: lsSetNum(
          LS_KEYS.chatTemperature,
          Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 0.3,
        ),
      }),
    setChatMaxCompletionTokens: (v: number) =>
      set({
        chatMaxCompletionTokens: lsSetInt(
          LS_KEYS.chatMaxCompletionTokens,
          clampChatCompletionTokens(v),
          { min: 64, max: 100_000 },
        ),
      }),
    setChatServiceTier: (v: 'auto' | 'default') =>
      set({
        chatServiceTier: lsSetJson(LS_KEYS.chatServiceTier, normalizeChatServiceTier(v)),
      }),
    setChatStream: (v: boolean) =>
      set({
        chatStream: lsSetBool(LS_KEYS.chatStream, !!v),
      }),
    setChatMessagesJson: (v: string | null) =>
      set({
        chatMessagesJson: lsSetJson(LS_KEYS.chatMessagesJson, typeof v === 'string' ? v : ''),
      }),
    setChatReasoningEffort: (v: 'minimal' | 'low' | 'medium' | 'high') =>
      set({
        chatReasoningEffort: lsSetJson(LS_KEYS.chatReasoningEffort, normalizeChatReasoningEffort(v)),
      }),
    setChatThinkingType: (v: 'enabled' | 'disabled' | 'auto') =>
      set({
        chatThinkingType: lsSetJson(LS_KEYS.chatThinkingType, normalizeChatThinkingType(v)),
      }),
    setChatThinkingJson: (v: string | null) =>
      set({
        chatThinkingJson: lsSetJson(LS_KEYS.chatThinkingJson, typeof v === 'string' ? v : ''),
      }),
    setChatFrequencyPenalty: (v: number) =>
      set({
        chatFrequencyPenalty: lsSetFloat(LS_KEYS.chatFrequencyPenalty, clampChatPenalty(v), { min: -2, max: 2 }),
      }),
    setChatPresencePenalty: (v: number) =>
      set({
        chatPresencePenalty: lsSetFloat(LS_KEYS.chatPresencePenalty, clampChatPenalty(v), { min: -2, max: 2 }),
      }),
    setChatTopP: (v: number) =>
      set({
        chatTopP: lsSetFloat(LS_KEYS.chatTopP, clampChatTopP(v), { min: 0, max: 1 }),
      }),
    setChatLogprobs: (v: boolean) =>
      set({
        chatLogprobs: lsSetBool(LS_KEYS.chatLogprobs, !!v),
      }),
    setChatTopLogprobs: (v: number) =>
      set({
        chatTopLogprobs: lsSetInt(LS_KEYS.chatTopLogprobs, clampChatTopLogprobs(v), { min: 0, max: 20 }),
      }),
    setChatParallelToolCalls: (v: boolean) =>
      set({
        chatParallelToolCalls: lsSetBool(LS_KEYS.chatParallelToolCalls, !!v),
      }),
    setChatStopJson: (v: string | null) =>
      set({
        chatStopJson: lsSetJson(LS_KEYS.chatStopJson, typeof v === 'string' ? v : ''),
      }),
    setChatStreamOptionsJson: (v: string | null) =>
      set({
        chatStreamOptionsJson: lsSetJson(LS_KEYS.chatStreamOptionsJson, typeof v === 'string' ? v : ''),
      }),
    setChatResponseFormatJson: (v: string | null) =>
      set({
        chatResponseFormatJson: lsSetJson(LS_KEYS.chatResponseFormatJson, typeof v === 'string' ? v : ''),
      }),
    setChatLogitBiasJson: (v: string | null) =>
      set({
        chatLogitBiasJson: lsSetJson(LS_KEYS.chatLogitBiasJson, typeof v === 'string' ? v : ''),
      }),
    setChatToolsJson: (v: string | null) =>
      set({
        chatToolsJson: lsSetJson(LS_KEYS.chatToolsJson, typeof v === 'string' ? v : ''),
      }),
    setChatToolChoiceJson: (v: string | null) =>
      set({
        chatToolChoiceJson: lsSetJson(LS_KEYS.chatToolChoiceJson, typeof v === 'string' ? v : ''),
      }),
    setChatGraphSummaryMaxTokens: (v: number) =>
      set({
        chatGraphSummaryMaxTokens: lsSetInt(
          LS_KEYS.chatGraphSummaryMaxTokens,
          clampChatContextMaxTokens(v, CHAT_AI_MARKDOWN_GRAPH_SUMMARY_MAX_TOKENS_DEFAULT),
          { min: 16, max: 10_000 },
        ),
      }),
    setChatGuidelineDigestMaxTokens: (v: number) =>
      set({
        chatGuidelineDigestMaxTokens: lsSetInt(
          LS_KEYS.chatGuidelineDigestMaxTokens,
          clampChatContextMaxTokens(v, CHAT_AI_MARKDOWN_GUIDELINE_DIGEST_MAX_TOKENS_DEFAULT),
          { min: 16, max: 10_000 },
        ),
      }),
    setChatSystemPrompt: (v: string | null) =>
      set({
        chatSystemPrompt: lsSetJson(
          LS_KEYS.chatSystemPrompt,
          v && typeof v === 'string' ? v : null,
        ),
      }),
    setChatStorageTarget: (target: 'chatKnowgrph' | 'chatHistory') =>
      set({
        chatStorageTarget: lsSetJson(
          LS_KEYS.chatStorageTarget,
          target === 'chatHistory' ? 'chatHistory' : 'chatKnowgrph',
        ),
      }),
    setChatLocalStorageRootPath: (path: string | null) =>
      set(state => {
        const nextRoot = String(path || '').trim() || CHAT_LOCAL_STORAGE_ROOT_PATH_DEFAULT
        const normalizedRoot = nextRoot.replace(/\\/g, '/').replace(/\/+$/, '')
        const isUnderRoot = (candidate: string | null | undefined): boolean => {
          const raw = String(candidate || '').trim()
          if (!raw) return false
          const normalized = raw.replace(/\\/g, '/').replace(/\/+$/, '')
          if (!normalizedRoot) return false
          if (normalized === normalizedRoot) return true
          return normalized.startsWith(`${normalizedRoot}/`)
        }
        const keepKnowgrphPath = isUnderRoot(state.chatKnowgrphWorkspacePath)
        const keepHistoryPath = isUnderRoot(state.chatHistoryWorkspacePath)
        return {
          chatLocalStorageRootPath: lsSetJson(LS_KEYS.chatLocalStorageRootPath, nextRoot),
          chatKnowgrphWorkspacePath: lsSetJson(
            LS_KEYS.chatKnowgrphWorkspacePath,
            keepKnowgrphPath ? String(state.chatKnowgrphWorkspacePath || '').trim() || null : null,
          ),
          chatHistoryWorkspacePath: lsSetJson(
            LS_KEYS.chatHistoryWorkspacePath,
            keepHistoryPath ? String(state.chatHistoryWorkspacePath || '').trim() || null : null,
          ),
        }
      }),
    setChatKnowgrphStorageMode: (mode: 'local' | 'cloud') =>
      set({
        chatKnowgrphStorageMode: lsSetJson(
          LS_KEYS.chatKnowgrphStorageMode,
          mode === 'cloud' ? 'cloud' : 'local',
        ),
      }),
    setChatKnowgrphWorkspacePath: (path: string | null) =>
      set({
        chatKnowgrphWorkspacePath: lsSetJson(
          LS_KEYS.chatKnowgrphWorkspacePath,
          (() => {
            const raw = String(path || '').trim()
            if (!raw) return null
            return isCanonicalKgcWorkspacePath(raw) ? raw : null
          })(),
        ),
      }),
    setChatKnowgrphCloudUrl: (url: string | null) =>
      set({
        chatKnowgrphCloudUrl: lsSetJson(
          LS_KEYS.chatKnowgrphCloudUrl,
          String(url || '').trim() || null,
        ),
      }),
    setChatHistoryWorkspacePath: (path: string | null) =>
      set({
        chatHistoryWorkspacePath: lsSetJson(
          LS_KEYS.chatHistoryWorkspacePath,
          String(path || '').trim() || null,
        ),
      }),
    setChatHistoryStorageMode: (mode: 'local' | 'cloud') =>
      set({
        chatHistoryStorageMode: lsSetJson(
          LS_KEYS.chatHistoryStorageMode,
          mode === 'cloud' ? 'cloud' : 'local',
        ),
      }),
    setChatHistoryCloudUrl: (url: string | null) =>
      set({
        chatHistoryCloudUrl: lsSetJson(
          LS_KEYS.chatHistoryCloudUrl,
          String(url || '').trim() || null,
        ),
      }),
    setChatContextScope: (scope: 'selection' | 'workspace' | 'hybrid') =>
      set({
        chatContextScope: lsSetJson(
          LS_KEYS.chatContextScope,
          scope === 'selection' || scope === 'hybrid' ? scope : 'workspace',
        ),
      }),
    setIntegrationConfigsJson: (v: string | null) =>
      set({
        integrationConfigsJson: lsSetJson(
          LS_KEYS.integrationConfigsJson,
          stringifyIntegrationConfigs(parseIntegrationConfigsJson(v)),
        ),
      }),

    setGrabMapsAuthMode: (mode: 'serverManaged' | 'byok') =>
      set(state => {
        const next = mode === 'serverManaged' ? 'serverManaged' : 'byok'
        const patch: Partial<GraphState> = {}
        let changed = false
        if (state.grabMapsAuthMode !== next) {
          patch.grabMapsAuthMode = lsSetJson(LS_KEYS.grabMapsAuthMode, next)
          changed = true
        }
        if (next === 'serverManaged' && state.grabMapsApiKey) {
          writeGrabMapsByokApiKeyToBrowser('')
          patch.grabMapsApiKey = ''
          changed = true
        }
        return changed ? patch : {}
      }),
    setGrabMapsApiKey: (v: string | null) =>
      set(state => {
        const sanitized = String(v || '')
          .replace(/[\r\n]/g, '')
          .trim()
          .slice(0, 512)
        if (state.grabMapsAuthMode === 'serverManaged' && sanitized) {
          writeGrabMapsByokApiKeyToBrowser(sanitized)
          return {
            grabMapsAuthMode: lsSetJson(LS_KEYS.grabMapsAuthMode, 'byok'),
            grabMapsApiKey: sanitized,
          }
        }
        if (state.grabMapsApiKey === sanitized) return {}
        writeGrabMapsByokApiKeyToBrowser(sanitized)
        return { grabMapsApiKey: sanitized }
      }),
    setGrabMapsDirectionsEndpointUrl: (v: string) =>
      set({ grabMapsDirectionsEndpointUrl: lsSetJson(LS_KEYS.grabMapsDirectionsEndpointUrl, String(v || '').trim()) }),
    setGrabMapsDirectionsOverview: (v: string) =>
      set({ grabMapsDirectionsOverview: lsSetJson(LS_KEYS.grabMapsDirectionsOverview, String(v || '').trim()) }),
    setGrabMapsDirectionsLatFirst: (v: boolean) =>
      set({ grabMapsDirectionsLatFirst: lsSetBool(LS_KEYS.grabMapsDirectionsLatFirst, v === true) }),
    setGrabMapsDirectionsAlternatives: (v: boolean) =>
      set({ grabMapsDirectionsAlternatives: lsSetBool(LS_KEYS.grabMapsDirectionsAlternatives, v === true) }),
    setGrabMapsDirectionsSteps: (v: boolean) =>
      set({ grabMapsDirectionsSteps: lsSetBool(LS_KEYS.grabMapsDirectionsSteps, v === true) }),
    setGrabMapsDirectionsLanguage: (v: string) =>
      set({ grabMapsDirectionsLanguage: lsSetJson(LS_KEYS.grabMapsDirectionsLanguage, String(v || '').trim()) }),
    setGrabMapsDirectionsUnits: (v: string) => {
      const raw = String(v || '').trim().toLowerCase()
      const next = raw === 'imperial' ? 'imperial' : 'metric'
      set({ grabMapsDirectionsUnits: lsSetJson(LS_KEYS.grabMapsDirectionsUnits, next) })
    },
    setGrabMapsDirectionsOriginLng: (v: number) =>
      set({ grabMapsDirectionsOriginLng: lsSetFloat(LS_KEYS.grabMapsDirectionsOriginLng, Number(v), { min: -180, max: 180 }) }),
    setGrabMapsDirectionsOriginLat: (v: number) =>
      set({ grabMapsDirectionsOriginLat: lsSetFloat(LS_KEYS.grabMapsDirectionsOriginLat, Number(v), { min: -90, max: 90 }) }),
    setGrabMapsDirectionsDestinationLng: (v: number) =>
      set({ grabMapsDirectionsDestinationLng: lsSetFloat(LS_KEYS.grabMapsDirectionsDestinationLng, Number(v), { min: -180, max: 180 }) }),
    setGrabMapsDirectionsDestinationLat: (v: number) =>
      set({ grabMapsDirectionsDestinationLat: lsSetFloat(LS_KEYS.grabMapsDirectionsDestinationLat, Number(v), { min: -90, max: 90 }) }),
    setGrabMapsDirectionsWaypointsJson: (v: string) =>
      set({ grabMapsDirectionsWaypointsJson: lsSetJson(LS_KEYS.grabMapsDirectionsWaypointsJson, String(v ?? '')) }),
    setGrabMapsDirectionsAnnotationsJson: (v: string) =>
      set({ grabMapsDirectionsAnnotationsJson: lsSetJson(LS_KEYS.grabMapsDirectionsAnnotationsJson, String(v ?? '')) }),
    setGrabMapsDirectionsExtraParamsJson: (v: string) =>
      set({ grabMapsDirectionsExtraParamsJson: lsSetJson(LS_KEYS.grabMapsDirectionsExtraParamsJson, String(v ?? '')) }),
    setGrabMapsBasemapStyleUrl: (v: string) =>
      set({ grabMapsBasemapStyleUrl: lsSetJson(LS_KEYS.grabMapsBasemapStyleUrl, String(v || '').trim()) }),

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
