import React from 'react'
import { settingsRegistry, loadFlowDetails } from '@/features/settings/registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { FlowDetails } from '@/features/settings/types'
import { loadSettingsCollapsedByArea, persistSettingsCollapsedByArea } from '@/features/panels/utils/settingsCollapsedStorage'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { getLocalStorage } from '@/lib/persistence'
import { FALLBACK_DETAILS } from './SettingsFallbackDetails'
import { renderSettingInput } from '@/features/settings/ui'
import { UI_ANCHORS } from '@/lib/config'
import {
  CHAT_OPENAI_MODEL_OPTIONS,
  CHAT_PROVIDER_BYTEPLUS,
  buildChatProxyHeaders,
  getChatDefaultEndpointUrlForProvider,
  normalizeChatProviderId,
  resolveChatEndpointForHealth,
} from '@/lib/chatEndpoint'
import { normalizeTextGenerationWidgetPropertiesForProviderFamily } from '@/features/flow-editor-manager/registryTemplates'
import {
  BYTEPLUS_CHAT_API_DOC_AREA,
  BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES,
  getBytePlusChatApiRowAnchorId,
} from './byteplusChatApiDocs'
import {
  OPENAI_CHAT_API_DOC_AREA,
  OPENAI_CHAT_API_REQUEST_DOC_ENTRIES,
  getOpenAiChatApiRowAnchorId,
} from './openaiChatApiDocs'
import {
  STRIPE_PAYMENT_API_DOC_AREA,
  STRIPE_PAYMENT_API_REQUEST_DOC_ENTRIES,
  getStripePaymentApiRowAnchorId,
} from './stripePaymentApiDocs'
import {
  BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
  BYTEPLUS_IMAGE_GENERATION_API_REQUEST_DOC_ENTRIES,
  BYTEPLUS_IMAGE_GENERATION_MAPPED_VALUE_KEYS,
  getBytePlusImageGenerationApiRowAnchorId,
} from './byteplusImageGenerationApiDocs'
import {
  BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
  BYTEPLUS_VIDEO_GENERATION_MAPPED_VALUE_KEYS,
  BYTEPLUS_VIDEO_GENERATION_API_REQUEST_DOC_ENTRIES,
  getBytePlusVideoGenerationApiRowAnchorId,
} from './byteplusVideoGenerationApiDocs'
import {
  MAPS_API_DOC_ENTRIES,
  MAPS_GRABMAPS_DOC_AREA,
  MAPS_GEO_DOC_AREA,
  MAPS_MAPLIBRE_DOC_AREA,
  getMapsApiRowAnchorId,
} from './mapsApiDocs'
import { GRABMAPS_DIRECTIONS_REQUEST_DOC_ENTRIES, MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA } from './grabmapsDirectionsApiDocs'
import { GRABMAPS_MCP_REQUEST_DOC_ENTRIES, MAPS_GRABMAPS_MCP_DOC_AREA } from './grabmapsMcpApiDocs'
import { resolvePaymentsProviderSpec } from '@/features/payments/providers'
import { resolveBytePlusVideoModelPreview } from '@/features/chat/byteplusRunGeneration'
import { buildIntegrationVirtualSettingMeta } from '@/features/integrations/integrationVirtualSettings'
import { normalizeGrabMapsAuthMode, sanitizeGrabMapsApiKey } from 'grph-shared/geospatial/grabMapsAuth'
import { GRABMAPS_PROXY_PATH } from 'grph-shared/geospatial/grabMapsSsot'

const SETTINGS_AREA_ORDER: readonly string[] = [
  'Chat',
  'UI Density: Panels',
  'UI Density: Icons',
  MAPS_GRABMAPS_DOC_AREA,
  MAPS_GRABMAPS_MCP_DOC_AREA,
  MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA,
  MAPS_GEO_DOC_AREA,
  MAPS_MAPLIBRE_DOC_AREA,
  'Workspace',
  'Markdown',
  'Flow Editor',
  'Canvas',
  'Rendering',
  'Performance',
  'Graph Data Table',
  'Import / Export',
  'Integrations',
  BYTEPLUS_CHAT_API_DOC_AREA,
  BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
  BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
  OPENAI_CHAT_API_DOC_AREA,
]

const SETTINGS_AREA_CANONICAL: Readonly<Record<string, string>> = {
  'ui density panels': 'UI Density: Panels',
  'ui density panel': 'UI Density: Panels',
  'ui density icons': 'UI Density: Icons',
  'graph data table': 'Graph Data Table',
  'import export': 'Import / Export',
  integrations: 'Integrations',
}

function normalizeSettingsAreaLabel(areaRaw: string): string {
  const area = String(areaRaw || '').trim()
  if (!area) return '—'
  const key = area.toLowerCase().replace(/[/:]+/g, ' ').replace(/\s+/g, ' ').trim()
  return SETTINGS_AREA_CANONICAL[key] || area
}

function settingsAreaSortWeight(area: string): number {
  const idx = SETTINGS_AREA_ORDER.indexOf(area)
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

function isIntegrationsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (
    area === 'Chat'
    || area === 'Integrations'
    || area === BYTEPLUS_CHAT_API_DOC_AREA
    || area === BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA
    || area === BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA
    || area === OPENAI_CHAT_API_DOC_AREA
  ) {
    return true
  }
  return key.startsWith('chat') || key === 'integrationConfigsJson'
}

function isPaymentsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (area === STRIPE_PAYMENT_API_DOC_AREA) return true
  return key.startsWith('payments.')
}

function isMapsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (
    area === MAPS_GRABMAPS_DOC_AREA
    || area === MAPS_GRABMAPS_MCP_DOC_AREA
    || area === MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA
    || area === MAPS_GEO_DOC_AREA
    || area === MAPS_MAPLIBRE_DOC_AREA
  ) return true
  if (key === 'autoEnableGeospatialOnGeoImport') return true
  return key.startsWith('maps.')
}

type SettingsEntry = {
  meta: {
    key: string
    type: string
    source: string
    read: () => string | number | boolean | null
    write?: (value: string | number | boolean) => void
    docKey?: string
    default?: () => string | number | boolean | null
    options?: string[]
  }
  details: FlowDetails
  writable: boolean
  index: string
  anchorId?: string
  typeLabel?: string
  valueKey?: string
  valueDisplayOverride?: string | number | boolean
  valueType?: string
  valueOptions?: string[]
  tooltipRole?: string
  tooltipActions?: string[]
  tooltipDefaultValue?: string | number | boolean | null
  tooltipMin?: string | number
  tooltipMax?: string | number
  tooltipInterval?: string | number
  tooltipExpansionNote?: string
  tooltipContractionNote?: string
  tooltipImpact?: string
}

const getSettingsSearchHints = (key: string): string[] => {
  if (key === 'chatContextScope') {
    return ['chat ai assistant context scope selection workspace hybrid']
  }
  if (key === 'chatProvider' || key === 'chatAuthMode' || key === 'chatEndpointUrl' || key === 'chatApiKey' || key === 'chatModel') {
    return ['chat ai byteplus modelark openai official provider endpoint api key byok server-managed auth mode model multi-modal multimodal run image video generation']
  }
  if (key === 'byteplusVideoModel') {
    return ['byteplus video generation api model byteplusVideoApi.model bytedance dreamina seedance video widget integrations default']
  }
  if (key === 'byteplusImageModel') {
    return ['byteplus image generation api model byteplusImageApi.model bytedance dola seedream image widget integrations default']
  }
  if (key === 'maps.grabmaps.authMode' || key === 'maps.grabmaps.apiKey') {
    return ['grabmaps maps auth mode byok server-managed api key style directions proxy']
  }
  if (key === 'chatHistoryStorageMode' || key === 'chatHistoryWorkspacePath' || key === 'chatHistoryCloudUrl') {
    return ['chat history workspace file path markdown cloud url github']
  }
  if (key === 'chatStorageTarget' || key === 'chatLocalStorageRootPath' || key === 'chatKnowgrphStorageMode' || key === 'chatKnowgrphWorkspacePath' || key === 'chatKnowgrphCloudUrl') {
    return ['chat storage chatKnowgrph chatHistory local cloud markdown file path url']
  }
  if (key === 'integrationConfigsJson') {
    return ['integrations ai chat aiChat simulationCommands openTab commandPrefix provider']
  }
  return []
}

const INTEGRATION_API_DOC_ENTRIES = [
  ...BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES,
  ...BYTEPLUS_IMAGE_GENERATION_API_REQUEST_DOC_ENTRIES,
  ...BYTEPLUS_VIDEO_GENERATION_API_REQUEST_DOC_ENTRIES,
  ...OPENAI_CHAT_API_REQUEST_DOC_ENTRIES,
] as const

const SETTINGS_REGISTRY_BY_KEY = new Map(settingsRegistry.map(setting => [setting.key, setting] as const))
const INTEGRATION_JSON_OWNER_ROW_KEYS_BY_VALUE_KEY: Readonly<Record<string, ReadonlySet<string>>> = {
  chatMessagesJson: new Set(['byteplusApi.messages', 'openaiApi.input']),
  chatThinkingJson: new Set(['byteplusApi.thinking']),
  chatResponseFormatJson: new Set(['byteplusApi.response_format', 'openaiApi.text']),
  chatToolsJson: new Set(['byteplusApi.tools', 'openaiApi.tools']),
  chatToolChoiceJson: new Set(['byteplusApi.tool_choice', 'openaiApi.tool_choice']),
  chatStreamOptionsJson: new Set(['byteplusApi.stream_options']),
}

function resolveIntegrationEntryMeta(entry: typeof INTEGRATION_API_DOC_ENTRIES[number]) {
  if (String(entry.meta.key || '').trim() === 'openaiApi.provider') {
    return {
      ...entry.meta,
      read: () => 'openai',
    }
  }
  if (String(entry.meta.key || '').trim() === 'byteplusApi.model') {
    const mapped = SETTINGS_REGISTRY_BY_KEY.get('chatModel')
    if (mapped) return mapped
  }
  const mappedMeta = entry.valueKey ? SETTINGS_REGISTRY_BY_KEY.get(entry.valueKey) : undefined
  if (mappedMeta) {
    if (String(entry.meta.key || '').trim() === 'openaiApi.model') {
      return {
        ...mappedMeta,
        options: [...CHAT_OPENAI_MODEL_OPTIONS],
      }
    }
    if (mappedMeta.type !== 'json') return mappedMeta
    const ownerRowKeys = entry.valueKey ? INTEGRATION_JSON_OWNER_ROW_KEYS_BY_VALUE_KEY[entry.valueKey] : undefined
    if (!ownerRowKeys || ownerRowKeys.has(entry.meta.key)) return mappedMeta
  }
  const normalizedEntryKey = String(entry.meta.key || '').trim().toLowerCase()
  const isReferenceRow =
    normalizedEntryKey.endsWith('.docs_url')
    || normalizedEntryKey.endsWith('.endpoint')
    || normalizedEntryKey.endsWith('.polling_endpoint')
  return buildIntegrationVirtualSettingMeta({
    key: entry.meta.key,
    type: entry.meta.type,
    fallbackValue:
      typeof entry.tooltipDefaultValue !== 'undefined'
        ? entry.tooltipDefaultValue
        : entry.value,
    defaultValue: entry.tooltipDefaultValue,
    options: 'options' in entry.meta ? entry.meta.options : undefined,
    kind: isReferenceRow ? 'reference' : 'request',
  })
}

function resolveIntegrationEntryStateKey(entry: typeof INTEGRATION_API_DOC_ENTRIES[number]) {
  const resolvedMeta = resolveIntegrationEntryMeta(entry)
  const usesMappedDisplayValue = Boolean(
    entry.valueKey
    && SETTINGS_REGISTRY_BY_KEY.get(entry.valueKey)?.key === resolvedMeta.key,
  )
  return {
    resolvedMeta,
    stateKey: usesMappedDisplayValue && entry.valueKey ? entry.valueKey : resolvedMeta.key,
    usesMappedDisplayValue,
  }
}

const PAYMENTS_API_DOC_ENTRIES = [
  ...STRIPE_PAYMENT_API_REQUEST_DOC_ENTRIES,
] as const

export function useSettingsView({
  searchQuery,
  onRegisterActions,
  mode = 'all',
  paymentsProviderId,
}: {
  searchQuery: string
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
  mode?: 'all' | 'integrations' | 'payments' | 'maps'
  paymentsProviderId?: string
}) {
  const shouldHideSetting = React.useCallback((key: string, area?: string) => {
    if (key === 'infiniteCanvasInteractionMode') return false
    if (key === 'canvasWorkspaceSyncMode') return false
    if (key === 'wheelZoomCtrlMetaBoostMultiplier') return false
    if (key.startsWith('flowWheelZoom')) return false
    if (key === 'canvas3dMode') return false
    if (key === 'canvasRenderMode') return true
    if (key === 'multiDimTableModeEnabled') return true
    if (key === 'import.json.workspaceTarget') return true
    if (key === 'three.graph.edgeRenderer') return true
    if (key === 'three.preset.presentation3d') return true
    if (key === 'integrationConfigsJson') return false
    if (key.startsWith('graph.behavior.')) return true
    const a = String(area || '')
    if (
      a === 'Canvas Rendering'
      || a === 'Canvas Interaction'
      || a === '3D Presets'
    ) {
      return true
    }
    return false
  }, [])

  const [flow, setFlow] = React.useState<Record<string, FlowDetails>>({})
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [values, setValues] = React.useState<Record<string, string | number | boolean>>(() => {
    const v: Record<string, string | number | boolean> = {}
    settingsRegistry.forEach(s => {
      const r = s.read()
      if (r !== null) v[s.key] = r
    })
    INTEGRATION_API_DOC_ENTRIES.forEach(entry => {
      const { resolvedMeta, stateKey } = resolveIntegrationEntryStateKey(entry)
      if (typeof v[stateKey] !== 'undefined') return
      const current = resolvedMeta.read()
      if (current !== null) v[stateKey] = current
    })
    PAYMENTS_API_DOC_ENTRIES.forEach(entry => {
      if (entry.valueKey && typeof v[entry.valueKey] !== 'undefined') return
      v[entry.meta.key] = entry.value
    })
    MAPS_API_DOC_ENTRIES.forEach(entry => {
      if (entry.valueKey && typeof v[entry.valueKey] !== 'undefined') return
      v[entry.meta.key] = entry.value
    })
    return v
  })
  const dirtyRef = React.useRef<Set<string>>(new Set())
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
  )
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')

  React.useEffect(() => {
    let alive = true
    loadFlowDetails().then(d => { if (alive) setFlow(d || {}) })
    return () => { alive = false }
  }, [])

  const applyAll = React.useCallback(() => {
    const dirty = Array.from(dirtyRef.current)
    dirty.forEach((key) => {
      const meta = settingsRegistry.find(s => s.key === key)
      const virtualMeta =
        (() => {
          const integrationEntry = INTEGRATION_API_DOC_ENTRIES.find(entry => {
            const resolvedMeta = resolveIntegrationEntryMeta(entry)
            return resolvedMeta.key === key
          })
          return integrationEntry ? resolveIntegrationEntryMeta(integrationEntry) : undefined
        })()
        || PAYMENTS_API_DOC_ENTRIES.find(entry => entry.meta.key === key)?.meta
        || MAPS_API_DOC_ENTRIES.find(entry => entry.meta.key === key)?.meta
      const writeTarget = meta || virtualMeta
      if (!writeTarget || !writeTarget.write) return
      const desired = values[key]
      const current = writeTarget.read()
      if (desired !== current) writeTarget.write(desired)
    })
    const next: Record<string, string | number | boolean> = { ...values }
    settingsRegistry.forEach(s => {
      if (dirtyRef.current.has(s.key)) {
        const current = s.read()
        if (current !== null) next[s.key] = current
      }
    })
    INTEGRATION_API_DOC_ENTRIES.forEach(entry => {
      const resolvedMeta = resolveIntegrationEntryMeta(entry)
      if (!dirtyRef.current.has(resolvedMeta.key)) return
      const current = resolvedMeta.read()
      if (current !== null) next[resolvedMeta.key] = current
    })
    setValues(next)
    dirtyRef.current.clear()
  }, [values])

  const resetToDefaults = React.useCallback(() => {
    settingsRegistry.forEach(s => {
      if (!s.write || !s.default) return
      const def = s.default()
      if (def !== null) s.write(def)
    })
    INTEGRATION_API_DOC_ENTRIES.forEach(entry => {
      const resolvedMeta = resolveIntegrationEntryMeta(entry)
      if (SETTINGS_REGISTRY_BY_KEY.has(resolvedMeta.key)) return
      if (!resolvedMeta.write || !resolvedMeta.default) return
      const def = resolvedMeta.default()
      if (def !== null) resolvedMeta.write(def)
    })
    const next: Record<string, string | number | boolean> = {}
    settingsRegistry.forEach(s => {
      const r = s.read()
      if (r !== null) next[s.key] = r
    })
    INTEGRATION_API_DOC_ENTRIES.forEach(entry => {
      const { resolvedMeta, stateKey } = resolveIntegrationEntryStateKey(entry)
      if (typeof next[stateKey] !== 'undefined') return
      const current = resolvedMeta.read()
      if (current !== null) next[stateKey] = current
    })
    setValues(next)
    dirtyRef.current.clear()
  }, [])

  const [chatHealthOk, setChatHealthOk] = React.useState<boolean | null>(null)
  const [chatHealthDetails, setChatHealthDetails] = React.useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false)

  const [bytePlusHealthOk, setBytePlusHealthOk] = React.useState<boolean | null>(null)
  const [bytePlusHealthDetails, setBytePlusHealthDetails] = React.useState<string | null>(null)
  const [isCheckingBytePlusHealth, setIsCheckingBytePlusHealth] = React.useState(false)
  const [grabMapsHealthOk, setGrabMapsHealthOk] = React.useState<boolean | null>(null)
  const [grabMapsHealthDetails, setGrabMapsHealthDetails] = React.useState<string | null>(null)
  const [isCheckingGrabMapsHealth, setIsCheckingGrabMapsHealth] = React.useState(false)
  const [bytePlusVideoModelPreviewText, setBytePlusVideoModelPreviewText] = React.useState<string | null>(null)
  const [isCheckingBytePlusVideoModelPreview, setIsCheckingBytePlusVideoModelPreview] = React.useState(false)
  const bytePlusVideoPreviewRequestRef = React.useRef(0)

  const checkChatHealth = React.useCallback(async () => {
    const url = values.chatEndpointUrl
    const healthUrl = resolveChatEndpointForHealth(url)
    if (!healthUrl) {
      setChatHealthOk(false)
      setChatHealthDetails('Endpoint URL is not configured.')
      return
    }
    setIsCheckingHealth(true)
    setChatHealthOk(null)
    setChatHealthDetails(null)
    try {
      const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: buildChatProxyHeaders({
          provider: values.chatProvider,
          apiKey: authMode === 'byok' ? values.chatApiKey : null,
          endpointUrl: values.chatEndpointUrl,
          clientRequestId: `kg-chat-health-${Date.now().toString(36)}`,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        setChatHealthOk(true)
        const detail = data ? `OK: ${JSON.stringify(data)}` : 'OK'
        setChatHealthDetails(detail)
      } else {
        setChatHealthOk(false)
        setChatHealthDetails(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (err: unknown) {
      setChatHealthOk(false)
      setChatHealthDetails(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsCheckingHealth(false)
    }
  }, [values.chatAuthMode, values.chatApiKey, values.chatEndpointUrl, values.chatProvider])

  const checkBytePlusHealth = React.useCallback(async () => {
    const baseUrl = getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_BYTEPLUS)
    const healthUrl = resolveChatEndpointForHealth(baseUrl)
    if (!healthUrl) {
      setBytePlusHealthOk(false)
      setBytePlusHealthDetails('BytePlus endpoint is not configured.')
      return
    }
    setIsCheckingBytePlusHealth(true)
    setBytePlusHealthOk(null)
    setBytePlusHealthDetails(null)
    try {
      const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: buildChatProxyHeaders({
          provider: CHAT_PROVIDER_BYTEPLUS,
          apiKey: authMode === 'byok' ? values.chatApiKey : null,
          endpointUrl: baseUrl,
          clientRequestId: `kg-byteplus-health-${Date.now().toString(36)}`,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        setBytePlusHealthOk(true)
        const detail = data ? `OK: ${JSON.stringify(data)}` : 'OK'
        setBytePlusHealthDetails(detail)
      } else {
        setBytePlusHealthOk(false)
        setBytePlusHealthDetails(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (err: unknown) {
      setBytePlusHealthOk(false)
      setBytePlusHealthDetails(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsCheckingBytePlusHealth(false)
    }
  }, [values.chatAuthMode, values.chatApiKey])

  const checkGrabMapsHealth = React.useCallback(async () => {
    const styleUrlRaw = String(values['maps.grabmaps.basemap.styleUrl'] || '').trim()
    if (!styleUrlRaw) {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails('GrabMaps style URL is not configured.')
      return
    }
    let target: URL
    try {
      target = new URL(styleUrlRaw)
    } catch {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails('GrabMaps style URL is invalid.')
      return
    }
    if (target.hostname.toLowerCase() !== 'maps.grab.com') {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails('GrabMaps health check requires a maps.grab.com style URL.')
      return
    }
    if (typeof window === 'undefined' || !window.location?.origin) {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails('Browser origin is unavailable.')
      return
    }
    const authMode = normalizeGrabMapsAuthMode(values['maps.grabmaps.authMode'])
    const apiKey = authMode === 'byok' ? sanitizeGrabMapsApiKey(values['maps.grabmaps.apiKey']) : ''
    if (authMode === 'byok' && !apiKey) {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails('GrabMaps BYOK API key is not configured.')
      return
    }
    const proxyUrl = new URL(GRABMAPS_PROXY_PATH, window.location.origin)
    proxyUrl.searchParams.set('url', target.toString())
    const headers: Record<string, string> = { 'x-kg-grabmaps-auth-mode': authMode }
    if (apiKey) headers['x-kg-grabmaps-api-key'] = apiKey
    setIsCheckingGrabMapsHealth(true)
    setGrabMapsHealthOk(null)
    setGrabMapsHealthDetails(null)
    try {
      const res = await fetch(proxyUrl.toString(), { method: 'GET', headers })
      if (res.ok) {
        setGrabMapsHealthOk(true)
        setGrabMapsHealthDetails(`OK: ${target.pathname}${target.search || ''}`)
      } else {
        setGrabMapsHealthOk(false)
        setGrabMapsHealthDetails(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (err: unknown) {
      setGrabMapsHealthOk(false)
      setGrabMapsHealthDetails(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsCheckingGrabMapsHealth(false)
    }
  }, [values])

  const checkBytePlusVideoModelPreview = React.useCallback(async () => {
    const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
    const apiKey = authMode === 'byok' ? String(values.chatApiKey || '').trim() : ''
    if (authMode === 'byok' && !apiKey) {
      setBytePlusVideoModelPreviewText('Resolved /models candidate: enter BytePlus BYOK API key to preview the exact accessible model id.')
      setIsCheckingBytePlusVideoModelPreview(false)
      return
    }
    const requestId = bytePlusVideoPreviewRequestRef.current + 1
    bytePlusVideoPreviewRequestRef.current = requestId
    setIsCheckingBytePlusVideoModelPreview(true)
    try {
      const preview = await resolveBytePlusVideoModelPreview(
        {
          provider: CHAT_PROVIDER_BYTEPLUS,
          endpointUrl: getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_BYTEPLUS),
          apiKey: authMode === 'byok' ? apiKey : null,
        },
        values.byteplusVideoModel,
      )
      if (bytePlusVideoPreviewRequestRef.current !== requestId) return
      const selected = String(preview.preferredModel || '').trim()
      const resolved = String(preview.resolvedModel || '').trim()
      const selectedLabel = selected || 'BytePlus video default'
      const resolutionDetail = preview.matchedAvailableModel
        ? `Resolved /models candidate: ${resolved}`
        : `Resolved /models candidate: ${resolved} (no exact accessible /models match returned; using configured selection)`
      const selectedDetail = resolved && resolved !== selectedLabel
        ? `Selected video model: ${selectedLabel}`
        : `Selected video model: ${selectedLabel}`
      const availableDetail = preview.availableCount > 0
        ? `BytePlus /models entries checked: ${String(preview.availableCount)}`
        : 'BytePlus /models entries checked: unavailable'
      setBytePlusVideoModelPreviewText(`${resolutionDetail} | ${selectedDetail} | ${availableDetail}`)
    } catch (err: unknown) {
      if (bytePlusVideoPreviewRequestRef.current !== requestId) return
      setBytePlusVideoModelPreviewText(`Resolved /models candidate: unavailable (${err instanceof Error ? err.message : String(err)})`)
    } finally {
      if (bytePlusVideoPreviewRequestRef.current === requestId) {
        setIsCheckingBytePlusVideoModelPreview(false)
      }
    }
  }, [values.byteplusVideoModel, values.chatApiKey, values.chatAuthMode])

  const didAutoCheckHealthRef = React.useRef(false)
  React.useEffect(() => {
    if (mode !== 'integrations') return
    if (didAutoCheckHealthRef.current) return
    const isTestRun = (() => {
      try {
        const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
        return env?.KG_TEST_QUIET === '1'
      } catch {
        return false
      }
    })()
    if (isTestRun) return
    didAutoCheckHealthRef.current = true
    void checkChatHealth()
    const normalizedProvider = normalizeChatProviderId(values.chatProvider)
    if (normalizedProvider !== CHAT_PROVIDER_BYTEPLUS) {
      void checkBytePlusHealth()
    }
    void checkBytePlusVideoModelPreview()
  }, [checkChatHealth, checkBytePlusHealth, mode, values.chatProvider])

  const didAutoCheckGrabMapsHealthRef = React.useRef(false)
  React.useEffect(() => {
    if (mode !== 'maps') return
    if (didAutoCheckGrabMapsHealthRef.current) return
    const isTestRun = (() => {
      try {
        const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
        return env?.KG_TEST_QUIET === '1'
      } catch {
        return false
      }
    })()
    if (isTestRun) return
    didAutoCheckGrabMapsHealthRef.current = true
    void checkGrabMapsHealth()
  }, [checkGrabMapsHealth, mode])

  React.useEffect(() => {
    if (mode !== 'integrations') return
    const timer = globalThis.setTimeout(() => {
      void checkBytePlusVideoModelPreview()
    }, 300)
    return () => {
      globalThis.clearTimeout(timer)
    }
  }, [checkBytePlusVideoModelPreview, mode])

  const onGlobalReset = React.useCallback(() => {
    try {
      const ok = typeof window !== 'undefined' ? window.confirm('Confirm reset: reset all settings and data') : true
      if (!ok) return
      resetToDefaults()
      useGraphStore.getState().resetAll()
    } catch { void 0 }
  }, [resetToDefaults])

  const normalizedBytePlusValues = React.useMemo(
    () => normalizeTextGenerationWidgetPropertiesForProviderFamily({
      providerFamily: 'byteplus',
      properties: values as Record<string, unknown>,
    }),
    [values],
  )
  const normalizedOpenAiValues = React.useMemo(
    () => normalizeTextGenerationWidgetPropertiesForProviderFamily({
      providerFamily: 'openai',
      properties: values as Record<string, unknown>,
    }),
    [values],
  )

  const renderInput = (
    key: string,
    type: string,
    writable: boolean,
    options?: string[],
    displayValueOverride?: string | number | boolean,
  ) => renderSettingInput(key, type, writable, values, setValues, dirtyRef, options, displayValueOverride)

  const entries = React.useMemo(() => {
    const concreteEntries: SettingsEntry[] = settingsRegistry.map((s) => {
      const source = flow[s.key] || (s.docKey ? flow[s.docKey] : undefined)
      const details = {
        area: source?.area || FALLBACK_DETAILS[s.key]?.area || '—',
        modules: source?.modules || [],
        classes: source?.classes || [],
        functions: source?.functions || [],
        responsibility: source?.responsibility || FALLBACK_DETAILS[s.key]?.responsibility || '—',
        imports: source?.imports || [],
        notes: source?.notes || FALLBACK_DETAILS[s.key]?.notes || '',
      }
      const searchHints = getSettingsSearchHints(s.key)
      const index = normalizeText(
        [
          details.area,
          s.key,
          s.type,
          details.responsibility,
          ...(details.modules || []),
          ...(details.classes || []),
          ...(details.functions || []),
          ...(details.imports || []),
          details.notes || '',
          ...searchHints,
        ].join(' '),
      )
      const anchorId =
        s.key === 'uiIconScale'
          ? UI_ANCHORS.settingsUiIconScale
          : (s.key === 'chatApiKey' ? UI_ANCHORS.settingsChatApiKey : undefined)
      return { meta: s, details, writable: !!s.write, index, anchorId }
    })
    const virtualEntries: SettingsEntry[] = INTEGRATION_API_DOC_ENTRIES.map(entry => {
      const { resolvedMeta, stateKey: displayKey, usesMappedDisplayValue } = resolveIntegrationEntryStateKey(entry)
      const area = normalizeSettingsAreaLabel(entry.details.area)
      const normalizedDisplayValues =
        area === BYTEPLUS_CHAT_API_DOC_AREA
          ? normalizedBytePlusValues
          : area === OPENAI_CHAT_API_DOC_AREA
            ? normalizedOpenAiValues
            : values
      const anchorId =
        area === BYTEPLUS_CHAT_API_DOC_AREA
          ? getBytePlusChatApiRowAnchorId(entry.meta.key)
          : area === BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA
            ? getBytePlusImageGenerationApiRowAnchorId(entry.meta.key)
          : area === BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA
            ? getBytePlusVideoGenerationApiRowAnchorId(entry.meta.key)
          : area === OPENAI_CHAT_API_DOC_AREA
            ? getOpenAiChatApiRowAnchorId(entry.meta.key)
            : undefined
      const displayValue =
        usesMappedDisplayValue && entry.valueKey && Object.prototype.hasOwnProperty.call(normalizedDisplayValues, entry.valueKey)
          ? (normalizedDisplayValues[entry.valueKey] as string | number | boolean | undefined)
          : Object.prototype.hasOwnProperty.call(values, displayKey)
            ? (values[displayKey] as string | number | boolean | undefined)
            : undefined
      return {
        meta: entry.meta,
        details: entry.details,
        writable: Boolean(resolvedMeta.write),
        index: normalizeText(
          [
            entry.details.area,
            entry.meta.key,
            entry.typeLabel,
            typeof displayValue !== 'undefined' ? String(displayValue) : entry.value,
            entry.details.responsibility,
            ...(entry.searchHints || []),
          ].join(' '),
        ),
        typeLabel: entry.typeLabel,
        valueKey: displayKey,
        valueDisplayOverride: displayValue,
        valueType: resolvedMeta.type,
        valueOptions: resolvedMeta.options,
        tooltipRole: entry.tooltipRole,
        tooltipActions: entry.tooltipActions,
        tooltipDefaultValue: entry.tooltipDefaultValue,
        tooltipMin: entry.tooltipMin,
        tooltipMax: entry.tooltipMax,
        tooltipInterval: entry.tooltipInterval,
        tooltipExpansionNote: entry.tooltipExpansionNote,
        tooltipContractionNote: entry.tooltipContractionNote,
        tooltipImpact: entry.tooltipImpact,
        anchorId,
      }
    })
    const paymentsVirtualEntries: SettingsEntry[] = PAYMENTS_API_DOC_ENTRIES.map(entry => {
      const mappedMeta = entry.valueKey
        ? settingsRegistry.find(s => s.key === entry.valueKey)
        : undefined
      const anchorId = getStripePaymentApiRowAnchorId(entry.meta.key)
      return {
        meta: entry.meta,
        details: entry.details,
        writable: Boolean(mappedMeta?.write),
        index: normalizeText(
          [
            entry.details.area,
            entry.meta.key,
            entry.typeLabel,
            entry.valueKey ? String(values[entry.valueKey] ?? '') : entry.value,
            entry.details.responsibility,
            ...(entry.searchHints || []),
          ].join(' '),
        ),
        typeLabel: entry.typeLabel,
        valueKey: entry.valueKey,
        valueDisplayOverride:
          entry.valueKey && Object.prototype.hasOwnProperty.call(values, entry.valueKey)
            ? (values[entry.valueKey] as string | number | boolean | undefined)
            : undefined,
        valueType: mappedMeta?.type,
        valueOptions: mappedMeta?.options,
        tooltipRole: entry.tooltipRole,
        tooltipActions: entry.tooltipActions,
        tooltipDefaultValue: entry.tooltipDefaultValue,
        tooltipMin: entry.tooltipMin,
        tooltipMax: entry.tooltipMax,
        tooltipInterval: entry.tooltipInterval,
        tooltipExpansionNote: entry.tooltipExpansionNote,
        tooltipContractionNote: entry.tooltipContractionNote,
        tooltipImpact: entry.tooltipImpact,
        anchorId,
      }
    })

    const mapsDocEntries = [
      ...MAPS_API_DOC_ENTRIES,
      ...GRABMAPS_MCP_REQUEST_DOC_ENTRIES,
      ...GRABMAPS_DIRECTIONS_REQUEST_DOC_ENTRIES,
    ]
    const mapsVirtualEntries: SettingsEntry[] = mapsDocEntries.map(entry => {
      const mappedMeta = entry.valueKey
        ? settingsRegistry.find(s => s.key === entry.valueKey)
        : undefined
      const anchorId = getMapsApiRowAnchorId(entry.meta.key)
      return {
        meta: entry.meta,
        details: entry.details,
        writable: Boolean(mappedMeta?.write),
        index: normalizeText(
          [
            entry.details.area,
            entry.meta.key,
            entry.typeLabel,
            entry.valueKey ? String(values[entry.valueKey] ?? '') : entry.value,
            entry.details.responsibility,
            ...(entry.searchHints || []),
          ].join(' '),
        ),
        typeLabel: entry.typeLabel,
        valueKey: entry.valueKey,
        valueDisplayOverride:
          entry.valueKey && Object.prototype.hasOwnProperty.call(values, entry.valueKey)
            ? (values[entry.valueKey] as string | number | boolean | undefined)
            : undefined,
        valueType: mappedMeta?.type,
        valueOptions: mappedMeta?.options,
        tooltipRole: entry.tooltipRole,
        tooltipActions: entry.tooltipActions,
        tooltipDefaultValue: entry.tooltipDefaultValue,
        tooltipMin: entry.tooltipMin,
        tooltipMax: entry.tooltipMax,
        tooltipInterval: entry.tooltipInterval,
        tooltipExpansionNote: entry.tooltipExpansionNote,
        tooltipContractionNote: entry.tooltipContractionNote,
        tooltipImpact: entry.tooltipImpact,
        anchorId,
      }
    })

    const hiddenConcreteIntegrationKeys = mode === 'integrations'
      ? new Set<string>([
          ...BYTEPLUS_IMAGE_GENERATION_MAPPED_VALUE_KEYS,
          ...BYTEPLUS_VIDEO_GENERATION_MAPPED_VALUE_KEYS,
        ])
      : null
    const hiddenConcreteMapsKeys = new Set<string>(
      mapsDocEntries
        .map(entry => entry.valueKey)
        .filter((valueKey): valueKey is string => typeof valueKey === 'string' && valueKey.trim().length > 0),
    )
    const allEntries = [
      ...concreteEntries.filter(entry => {
        if (!entry.writable) return false
        if (hiddenConcreteIntegrationKeys && hiddenConcreteIntegrationKeys.has(entry.meta.key)) return false
        if (hiddenConcreteMapsKeys.has(entry.meta.key)) return false
        return true
      }),
      ...virtualEntries,
      ...paymentsVirtualEntries,
      ...mapsVirtualEntries,
    ]
    const filteredByMode = allEntries
      .filter(entry => !shouldHideSetting(entry.meta.key, entry.details.area))
      .filter(entry => {
        const isIntegrationsOwned = isIntegrationsOwnedSetting(entry.meta.key, entry.details.area)
        const isPaymentsOwned = isPaymentsOwnedSetting(entry.meta.key, entry.details.area)
        const isMapsOwned = isMapsOwnedSetting(entry.meta.key, entry.details.area)
        if (mode === 'integrations') return isIntegrationsOwned
        if (mode === 'maps') return isMapsOwned
        if (mode === 'payments') {
          if (!isPaymentsOwned) return false
          return !entry.meta.key.startsWith('payments.')
        }
        return !isIntegrationsOwned && !isPaymentsOwned && !isMapsOwned
      })
    if (mode !== 'payments') return filteredByMode

    const providerArea = resolvePaymentsProviderSpec(paymentsProviderId).areaLabel
    return filteredByMode.filter(entry => normalizeSettingsAreaLabel(entry.details.area) === providerArea)
  }, [flow, mode, normalizedBytePlusValues, normalizedOpenAiValues, paymentsProviderId, shouldHideSetting, values])

  const normalizedQuery = React.useMemo(() => normalizeText(searchQuery).trim(), [searchQuery])
  const filtered = React.useMemo(
    () => (normalizedQuery ? entries.filter(e => e.index.includes(normalizedQuery)) : entries),
    [entries, normalizedQuery],
  )

  const [collapsedByArea, setCollapsedByArea] = React.useState<Record<string, boolean>>(() => {
    const storage = getLocalStorage()
    return loadSettingsCollapsedByArea(storage)
  })
  const saveCollapsed = React.useCallback((next: Record<string, boolean>) => {
    const storage = getLocalStorage()
    persistSettingsCollapsedByArea(storage, next)
  }, [])
  const groupByArea = React.useMemo(() => {
    const sortEntries = (entriesByArea: SettingsEntry[]) =>
      [...entriesByArea].sort((a, b) =>
        String(a.meta.key || '').localeCompare(String(b.meta.key || ''), undefined, { sensitivity: 'base' }),
      )
    if (mode === 'integrations') {
      const sectionSpecs: ReadonlyArray<{
        title: string
        searchIndex: string
        match: (entry: SettingsEntry) => boolean
      }> = [
        {
          title: 'Chat',
          searchIndex: normalizeText('Chat FloatingPanel Chat UI Official AI integrationConfigsJson'),
          match: (entry) => {
            const area = normalizeSettingsAreaLabel(entry.details.area)
            return area === 'Chat' || area === 'Integrations'
          },
        },
        {
          title: BYTEPLUS_CHAT_API_DOC_AREA,
          searchIndex: normalizeText('BytePlus Chat API ModelArk FloatingPanel Props Panel Text Widget text generation'),
          match: entry => normalizeSettingsAreaLabel(entry.details.area) === BYTEPLUS_CHAT_API_DOC_AREA,
        },
        {
          title: OPENAI_CHAT_API_DOC_AREA,
          searchIndex: normalizeText('OpenAI Chat API Responses FloatingPanel Props Panel OpenAI Text Widget text generation'),
          match: entry => normalizeSettingsAreaLabel(entry.details.area) === OPENAI_CHAT_API_DOC_AREA,
        },
        {
          title: BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
          searchIndex: normalizeText('BytePlus Video Generation API ModelArk FloatingPanel BytePlus Video Widget byteplusVideoApi.model byteplusVideoModel'),
          match: entry => normalizeSettingsAreaLabel(entry.details.area) === BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA,
        },
        {
          title: BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
          searchIndex: normalizeText('BytePlus Image Generation API ModelArk FloatingPanel BytePlus Image Widget'),
          match: entry => normalizeSettingsAreaLabel(entry.details.area) === BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA,
        },
      ]
      return sectionSpecs.flatMap(({ title, searchIndex, match }) => {
        const entriesBySection = filtered.filter(match)
        const shouldInclude = entriesBySection.length > 0 || !normalizedQuery || searchIndex.includes(normalizedQuery)
        if (!shouldInclude) return []
        return [[title, sortEntries(entriesBySection)] as const]
      })
    }
    const map = new Map<string, typeof filtered>()
    filtered.forEach(entry => {
      const area = normalizeSettingsAreaLabel(entry.details.area)
      const normalizedEntry = area === entry.details.area
        ? entry
        : {
            ...entry,
            details: {
              ...entry.details,
              area,
            },
          }
      const list = map.get(area) || []
      list.push(normalizedEntry)
      map.set(area, list)
    })
    const grouped = Array.from(map.entries()).map(([area, entriesByArea]) => {
      const sortedEntries = sortEntries(entriesByArea)
      return [area, sortedEntries] as const
    })
    grouped.sort((a, b) => {
      const aw = settingsAreaSortWeight(a[0])
      const bw = settingsAreaSortWeight(b[0])
      if (aw !== bw) return aw - bw
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
    })
    return grouped
  }, [filtered, mode, normalizedQuery])
  const allCollapsed = React.useMemo(
    () => {
      if (groupByArea.length === 0) return true
      return groupByArea.every(([area]) => {
        const value = collapsedByArea[area]
        if (value === undefined) return true
        return value
      })
    },
    [groupByArea, collapsedByArea],
  )
  const collapseAll = React.useCallback(() => {
    const next: Record<string, boolean> = {}
    groupByArea.forEach(([area]) => { next[area] = true })
    setCollapsedByArea(next)
    saveCollapsed(next)
  }, [groupByArea, saveCollapsed])
  const expandAll = React.useCallback(() => {
    const next: Record<string, boolean> = {}
    groupByArea.forEach(([area]) => { next[area] = false })
    setCollapsedByArea(next)
    saveCollapsed(next)
  }, [groupByArea, saveCollapsed])
  const toggleArea = React.useCallback((area: string, next: boolean) => {
    setCollapsedByArea(prev => {
      const merged = { ...prev, [area]: next }
      saveCollapsed(merged)
      return merged
    })
  }, [saveCollapsed])

  React.useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        apply: applyAll,
        reset: resetToDefaults,
        globalReset: onGlobalReset,
        collapseAll,
        expandAll,
        allCollapsed,
      })
    }
  }, [onRegisterActions, applyAll, resetToDefaults, onGlobalReset, collapseAll, expandAll, allCollapsed])

  return {
    flow,
    expanded,
    setExpanded,
    values,
    setValues,
    dirtyRef,
    schema,
    setSchema,
    uiPanelKeyValueInputClass,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    chatHealthOk,
    chatHealthDetails,
    isCheckingHealth,
    checkChatHealth,
    bytePlusHealthOk,
    bytePlusHealthDetails,
    isCheckingBytePlusHealth,
    checkBytePlusHealth,
    grabMapsHealthOk,
    grabMapsHealthDetails,
    isCheckingGrabMapsHealth,
    checkGrabMapsHealth,
    bytePlusVideoModelPreviewText,
    isCheckingBytePlusVideoModelPreview,
    checkBytePlusVideoModelPreview,
    onGlobalReset,
    renderInput,
    entries,
    normalizedQuery,
    filtered,
    collapsedByArea,
    setCollapsedByArea,
    saveCollapsed,
    groupByArea,
    allCollapsed,
    collapseAll,
    expandAll,
    toggleArea,
  }
}
