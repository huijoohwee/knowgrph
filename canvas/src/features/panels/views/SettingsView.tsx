import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils'
import {
  uiDangerButtonClassName,
  uiToolbarToggleActiveClassName,
  UI_COLOR_DANGER_RED_BORDER,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  buildSettingsAreaTooltip,
  buildSettingsKeyTooltip,
  buildSettingsValueTooltip,
  UI_ANCHORS,
} from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { settingsRegistry } from '@/features/settings/registry'
import { useSettingsView } from './useSettingsView'
import StatusBadge from '@/features/panels/ui/StatusBadge'
import { createStripeHostedCheckoutSessionUrl } from '@/features/payments/stripeCheckout'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import { KindPill, resolveFieldTypeIconKind } from '@/features/graph-fields/ui/graphFieldIcons'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { createNewChatHistoryWorkspaceFilePath } from '@/features/chat/chatHistoryWorkspace'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { importLocalFilesFallback, importUrlFallback } from '@/features/toolbar/launchDropdownFallbacks'
import { getIconSizeClass } from '@/lib/ui'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_BYTEPLUS_MODEL_OPTIONS,
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_DEFAULT_MODEL,
  CHAT_DEFAULT_PROVIDER,
  CHAT_LOCAL_DEFAULT_MODEL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_LM_STUDIO,
  CHAT_PROVIDER_OPENAI,
  CHAT_OPENAI_MODEL_OPTIONS,
  getChatModelOptions,
  CHAT_LOCAL_MODEL_OPTIONS,
  buildChatProxyHeaders,
  getChatDefaultEndpointUrlForProvider,
  getDefaultChatModelForProvider,
  resolveChatEndpointForModels,
} from '@/lib/chatEndpoint'
import { loadAvailableModelIds } from '@/features/chat/SidePanelChat.helpers'
import {
  DEFAULT_INTEGRATION_CONFIGS,
  parseIntegrationConfigsJson,
  stringifyIntegrationConfigs,
} from '@/features/integrations/config'
import { BYTEPLUS_CHAT_API_DOC_AREA } from './byteplusChatApiDocs'
import { OPENAI_CHAT_API_DOC_AREA } from './openaiChatApiDocs'
import { MAPS_GEO_DOC_AREA, MAPS_MAPLIBRE_DOC_AREA, MAPS_GRABMAPS_DOC_AREA } from './mapsApiDocs'
import { MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA } from './grabmapsDirectionsApiDocs'
import { MAPS_GRABMAPS_MCP_DOC_AREA } from './grabmapsMcpApiDocs'
import { FLOW_IMAGE_GENERATION_NODE_LABEL, FLOW_VIDEO_GENERATION_NODE_LABEL } from '@/lib/config.flow-editor'
import { PAYMENTS_PROVIDERS, DEFAULT_PAYMENT_PROVIDER_ID, resolvePaymentsProviderSpec } from '@/features/payments/providers'
import { getGrabMapsDiscoveryWidgetLabel } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'

const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')
const SETTINGS_MAIN_HEADER_STICKY_OFFSET_CLASS = 'top-9'
type SectionMeta = Readonly<{
  docsUrl?: string
  docsLabel?: string
  panelLabel: string
  note?: string
  highlights?: readonly string[]
  openPanel: () => void
}>
const CHAT_KTV_ROW_KEYS = {
  apiKey: 'chatApiKey',
  provider: 'chatProvider',
  contextScope: 'chatContextScope',
  routing: 'integrationConfigsJson',
  model: 'chatModel',
} as const

const INTEGRATIONS_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  Chat: {
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitSidePanelOpen({ tab: 'chat', open: true }),
  },
  [BYTEPLUS_CHAT_API_DOC_AREA]: {
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk/1494384',
    docsLabel: 'Open BytePlus Text API Docs',
    panelLabel: 'Open FloatingPanel Props Panel Text Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  [OPENAI_CHAT_API_DOC_AREA]: {
    docsUrl: 'https://developers.openai.com/api/reference/resources/responses',
    docsLabel: 'Open OpenAI Chat API Docs',
    panelLabel: 'Open FloatingPanel Props Panel OpenAI Text Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  'BytePlus Video Generation API': {
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API',
    docsLabel: 'Open BytePlus Video Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_VIDEO_GENERATION_NODE_LABEL}`,
    note: 'Uses shared BytePlus auth_mode and api_key from BytePlus Shared + Text API.',
    openPanel: () => emitPropsPanelOpen(),
  },
  'BytePlus Image Generation API': {
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk/1666945',
    docsLabel: 'Open BytePlus Image Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_IMAGE_GENERATION_NODE_LABEL}`,
    note: 'Uses shared BytePlus auth_mode and api_key from BytePlus Shared + Text API.',
    openPanel: () => emitPropsPanelOpen(),
  },
}

const MCP_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  [MAPS_GRABMAPS_MCP_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation/mcp',
    docsLabel: 'Open GrabMaps MCP Docs',
    panelLabel: `Open FloatingPanel Props Panel ${getGrabMapsDiscoveryWidgetLabel()}`,
    openPanel: () => emitPropsPanelOpen(),
  }
}

const MAPS_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  [MAPS_GRABMAPS_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation',
    docsLabel: 'Open GrabMaps Docs',
    panelLabel: 'Open FloatingPanel Geo',
    note: 'MainPanel Maps remains backend/system/API-facing for GrabMaps auth, style, and route configuration.',
    highlights: [
      'Style loading uses Bearer auth against https://maps.grab.com/api/style.json.',
    ],
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation/routes',
    docsLabel: 'Open GrabMaps Routes Docs',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GEO_DOC_AREA]: {
    docsUrl: 'https://datatracker.ietf.org/doc/html/rfc7946',
    docsLabel: 'Open GeoJSON RFC 7946',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_MAPLIBRE_DOC_AREA]: {
    docsUrl: 'https://maplibre.org/maplibre-gl-js/docs/',
    docsLabel: 'Open MapLibre GL JS Docs',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
}

export default function SettingsView({
  searchQuery,
  requestedAnchorId,
  requestedAnchorSeq,
  onRegisterActions,
  mode = 'all',
}: {
  searchQuery: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
  mode?: 'all' | 'integrations' | 'payments' | 'maps' | 'mcp'
}) {
  const [paymentsProviderId, setPaymentsProviderId] = React.useState<string>(DEFAULT_PAYMENT_PROVIDER_ID)
  const {
    expanded,
    setExpanded,
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
    isCheckingBytePlusVideoModelPreview,
    checkBytePlusVideoModelPreview,
    onGlobalReset,
    renderInput,
    collapsedByArea,
    groupByArea,
    allCollapsed,
    collapseAll,
    expandAll,
    normalizedQuery,
    toggleArea,
    uiPanelKeyValueTextSizeClass,
    values,
    setValues,
    dirtyRef,
  } = useSettingsView({ searchQuery, onRegisterActions, mode, paymentsProviderId })
  const [chatModelsStatus, setChatModelsStatus] = React.useState<string | null>(null)
  const [isRefreshingChatModels, setIsRefreshingChatModels] = React.useState(false)
  const [discoveredChatModels, setDiscoveredChatModels] = React.useState<string[]>([])
  const [stripeCheckoutStatus, setStripeCheckoutStatus] = React.useState<string | null>(null)
  const [isGeneratingStripeCheckout, setIsGeneratingStripeCheckout] = React.useState(false)
  const [knowgrphPathStatus, setKnowgrphPathStatus] = React.useState<string | null>(null)
  const [isUpdatingKnowgrphPath, setIsUpdatingKnowgrphPath] = React.useState(false)
  const [chatHistoryPathStatus, setChatHistoryPathStatus] = React.useState<string | null>(null)
  const [isUpdatingChatHistoryPath, setIsUpdatingChatHistoryPath] = React.useState(false)
  const kgcLocalImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const localImportInputRef = React.useRef<HTMLInputElement | null>(null)
  const bridge = getMarkdownWorkspaceActionBridge()
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const setEditorWorkspacePane = useGraphStore(s => s.setEditorWorkspacePane)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const headerStickyTopClass = mode === 'integrations' || mode === 'mcp' ? 'top-0' : '-top-[2px]'
  const headerDividerWidthClass = mode === 'integrations' || mode === 'mcp' ? 'border-b-[0.5px]' : 'border-b'
  const settingsTypeIconSizeClass = getIconSizeClass(uiIconScale)
  const normalizedChatProvider = React.useMemo(
    () => String(values.chatProvider || '').trim() || CHAT_DEFAULT_PROVIDER,
    [values.chatProvider],
  )

  const paymentsProviders = React.useMemo(() => [...PAYMENTS_PROVIDERS], [])
  const activePaymentsProvider = React.useMemo(
    () => resolvePaymentsProviderSpec(paymentsProviderId),
    [paymentsProviderId],
  )
  const applyUiPanelDensityPreset = React.useCallback(
    (preset: 'comfortable' | 'compact') => {
      const patches: Record<string, string> =
        preset === 'comfortable'
          ? {
              uiPanelKeyValueTextSizeClass: 'text-sm',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
              uiPanelRowDensityDefaultClass: 'py-1',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-xs',
            }
          : {
              uiPanelKeyValueTextSizeClass: 'text-xs',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
              uiPanelRowDensityDefaultClass: 'py-0.5',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-[9px]',
            }
      Object.keys(patches).forEach(key => dirtyRef.current.add(key))
      setValues(prev => ({ ...prev, ...patches }))
    },
    [dirtyRef, setValues],
  )

  const patchChatValues = React.useCallback((patch: Record<string, string>) => {
    Object.keys(patch).forEach(key => dirtyRef.current.add(key))
    setValues(prev => ({ ...prev, ...patch }))
  }, [dirtyRef, setValues])
  const openLocalChatApiKeyEntry = React.useCallback(() => {
    patchChatValues({ chatAuthMode: 'byok' })
    setExpanded('chatApiKey')
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(`[data-kg-anchor="${UI_ANCHORS.settingsChatApiKey}"]`)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        const input = target.querySelector<HTMLInputElement>('input[type="password"], input')
        input?.focus()
        input?.select?.()
      })
    }
  }, [patchChatValues, setExpanded])

  React.useEffect(() => {
    const anchorId = String(requestedAnchorId || '').trim()
    if (!anchorId || typeof window === 'undefined') return
    const rafId = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-kg-anchor="${anchorId}"]`)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [requestedAnchorId, requestedAnchorSeq, groupByArea])

  React.useEffect(() => {
    const shouldApplyProvider = dirtyRef.current.has('chatProvider')
    const shouldApplyAuthMode = dirtyRef.current.has('chatAuthMode')
    const shouldApplyApiKey = dirtyRef.current.has('chatApiKey')
    if (!shouldApplyProvider && !shouldApplyAuthMode && !shouldApplyApiKey) return

    const nextProvider = String(values.chatProvider || '').trim()
    const nextAuthMode = String(values.chatAuthMode || '').trim().toLowerCase() === 'byok' ? 'byok' : 'serverManaged'
    const nextApiKey = typeof values.chatApiKey === 'string' ? values.chatApiKey : ''

    const store = useGraphStore.getState()
    if (shouldApplyProvider) store.setChatProvider(nextProvider)
    if (shouldApplyAuthMode) store.setChatAuthMode(nextAuthMode)
    if (shouldApplyApiKey && nextAuthMode === 'byok') store.setChatApiKey(nextApiKey)

    const updated = useGraphStore.getState()
    const normalizedValues: Record<string, string> = {
      chatProvider: String(updated.chatProvider || '').trim(),
      chatAuthMode: updated.chatAuthMode === 'byok' ? 'byok' : 'serverManaged',
      chatEndpointUrl: String(updated.chatEndpointUrl || ''),
      chatModel: String(updated.chatModel || ''),
      chatApiKey: String(updated.chatApiKey || ''),
    }

    if (shouldApplyProvider) dirtyRef.current.delete('chatProvider')
    if (shouldApplyAuthMode) dirtyRef.current.delete('chatAuthMode')
    if (shouldApplyApiKey) dirtyRef.current.delete('chatApiKey')

    setValues(prev => ({ ...prev, ...normalizedValues }))
  }, [dirtyRef, setValues, values.chatApiKey, values.chatAuthMode, values.chatProvider])

  React.useEffect(() => {
    const keys = [
      'byteplusImageModel',
      'byteplusImageSize',
      'byteplusImageOutputFormat',
      'byteplusImageWatermark',
      'byteplusImageSeed',
      'byteplusImageGuidanceScale',
    ] as const
    const dirtyKeys = keys.filter(key => dirtyRef.current.has(key))
    if (dirtyKeys.length === 0) return

    const patches: Record<string, string | number | boolean> = {}
    dirtyKeys.forEach((key) => {
      const meta = settingsRegistry.find(s => s.key === key)
      if (!meta?.write) return
      meta.write(values[key] as never)
      const next = meta.read()
      if (next !== null) {
        patches[key] = next as never
      }
      dirtyRef.current.delete(key)
    })
    if (Object.keys(patches).length > 0) {
      setValues(prev => ({ ...prev, ...patches }))
    }
  }, [
    dirtyRef,
    setValues,
    values.byteplusImageGuidanceScale,
    values.byteplusImageModel,
    values.byteplusImageOutputFormat,
    values.byteplusImageSeed,
    values.byteplusImageSize,
    values.byteplusImageWatermark,
  ])

  React.useEffect(() => {
    const keys = [
      'byteplusVideoModel',
      'byteplusVideoContentJson',
      'byteplusVideoResolution',
      'byteplusVideoRatio',
      'byteplusVideoDuration',
      'byteplusVideoGenerateAudio',
      'byteplusVideoDraft',
      'byteplusVideoCameraFixed',
      'byteplusVideoImageUrlUrl',
    ] as const
    const dirtyKeys = keys.filter(key => dirtyRef.current.has(key))
    if (dirtyKeys.length === 0) return

    const patches: Record<string, string | number | boolean> = {}
    dirtyKeys.forEach((key) => {
      const meta = settingsRegistry.find(s => s.key === key)
      if (!meta?.write) return
      meta.write(values[key] as never)
      const next = meta.read()
      if (next !== null) {
        patches[key] = next as never
      }
      dirtyRef.current.delete(key)
    })
    if (Object.keys(patches).length > 0) {
      setValues(prev => ({ ...prev, ...patches }))
    }
  }, [
    dirtyRef,
    setValues,
    values.byteplusVideoCameraFixed,
    values.byteplusVideoContentJson,
    values.byteplusVideoDraft,
    values.byteplusVideoDuration,
    values.byteplusVideoGenerateAudio,
    values.byteplusVideoImageUrlUrl,
    values.byteplusVideoModel,
    values.byteplusVideoRatio,
    values.byteplusVideoResolution,
  ])

  const openWorkspaceFile = React.useCallback((path: string) => {
    const normalized = normalizeWorkspacePath(path)
    setWorkspaceViewMode('editor')
    setEditorWorkspacePane('markdown')
    useMarkdownExplorerStore.getState().setActivePath(normalized)
  }, [setEditorWorkspacePane, setWorkspaceViewMode])

  const createAndSelectChatHistoryFile = React.useCallback(async () => {
    setIsUpdatingChatHistoryPath(true)
    setChatHistoryPathStatus(null)
    try {
      const created = await createNewChatHistoryWorkspaceFilePath(Date.now(), {
        storageType: 'chatHistory',
        defaultLocalRootPath: String(values.chatLocalStorageRootPath || '').trim() || null,
      })
      patchChatValues({
        chatHistoryStorageMode: 'local',
        chatHistoryCloudUrl: '',
        chatHistoryWorkspacePath: created,
      })
      openWorkspaceFile(created)
      setChatHistoryPathStatus(created)
    } catch (err) {
      setChatHistoryPathStatus(err instanceof Error ? err.message : String(err || 'Failed to create file'))
    } finally {
      setIsUpdatingChatHistoryPath(false)
    }
  }, [openWorkspaceFile, patchChatValues, values.chatLocalStorageRootPath])

  const createAndSelectKnowgrphFile = React.useCallback(async () => {
    setIsUpdatingKnowgrphPath(true)
    setKnowgrphPathStatus(null)
    try {
      const created = await createNewChatHistoryWorkspaceFilePath(Date.now(), {
        storageType: 'chatKnowgrph',
        defaultLocalRootPath: String(values.chatLocalStorageRootPath || '').trim() || null,
      })
      patchChatValues({
        chatKnowgrphStorageMode: 'local',
        chatKnowgrphCloudUrl: '',
        chatKnowgrphWorkspacePath: created,
      })
      openWorkspaceFile(created)
      setKnowgrphPathStatus(created)
    } catch (err) {
      setKnowgrphPathStatus(err instanceof Error ? err.message : String(err || 'Failed to create file'))
    } finally {
      setIsUpdatingKnowgrphPath(false)
    }
  }, [openWorkspaceFile, patchChatValues, values.chatLocalStorageRootPath])

  const useActiveWorkspaceFileAsKnowgrph = React.useCallback(() => {
    setKnowgrphPathStatus(null)
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : null
    if (!normalized || !normalized.toLowerCase().endsWith('.md')) {
      setKnowgrphPathStatus('No active markdown file is selected in Workspace Editor.')
      return
    }
    patchChatValues({
      chatKnowgrphStorageMode: 'local',
      chatKnowgrphCloudUrl: '',
      chatKnowgrphWorkspacePath: normalized,
    })
    openWorkspaceFile(normalized)
    setKnowgrphPathStatus(normalized)
  }, [openWorkspaceFile, patchChatValues])

  const useActiveWorkspaceFileAsChatHistory = React.useCallback(() => {
    setChatHistoryPathStatus(null)
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : null
    if (!normalized || !normalized.toLowerCase().endsWith('.md')) {
      setChatHistoryPathStatus('No active markdown file is selected in Workspace Editor.')
      return
    }
    patchChatValues({
      chatHistoryStorageMode: 'local',
      chatHistoryCloudUrl: '',
      chatHistoryWorkspacePath: normalized,
    })
    openWorkspaceFile(normalized)
    setChatHistoryPathStatus(normalized)
  }, [openWorkspaceFile, patchChatValues])

  const openFilePicker = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    try {
      const anyEl = el as unknown as { showPicker?: () => void }
      if (typeof anyEl.showPicker === 'function') {
        anyEl.showPicker()
        return
      }
    } catch {
      void 0
    }
    try {
      el.click()
    } catch {
      void 0
    }
  }, [])

  const syncChatHistoryPathFromActiveFile = React.useCallback((attempt = 0) => {
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : ''
    if (normalized && normalized.toLowerCase().endsWith('.md')) {
      patchChatValues({
        chatHistoryStorageMode: 'local',
        chatHistoryCloudUrl: '',
        chatHistoryWorkspacePath: normalized,
      })
      setChatHistoryPathStatus(normalized)
      return
    }
    if (attempt >= 8) return
    window.setTimeout(() => syncChatHistoryPathFromActiveFile(attempt + 1), 250)
  }, [patchChatValues])

  const syncKnowgrphPathFromActiveFile = React.useCallback((attempt = 0) => {
    const active = useMarkdownExplorerStore.getState().activePath
    const normalized = active ? normalizeWorkspacePath(active) : ''
    if (normalized && normalized.toLowerCase().endsWith('.md')) {
      patchChatValues({
        chatKnowgrphStorageMode: 'local',
        chatKnowgrphCloudUrl: '',
        chatKnowgrphWorkspacePath: normalized,
      })
      setKnowgrphPathStatus(normalized)
      return
    }
    if (attempt >= 8) return
    window.setTimeout(() => syncKnowgrphPathFromActiveFile(attempt + 1), 250)
  }, [patchChatValues])

  const importLocalFilesForChatHistory = React.useCallback((files: FileList | null) => {
    const snapshot = files ? Array.from(files) : []
    if (snapshot.length === 0) return
    setChatHistoryPathStatus('Importing local files...')
    patchChatValues({ chatHistoryStorageMode: 'local', chatHistoryCloudUrl: '' })
    if (typeof bridge.importLocalFiles === 'function') bridge.importLocalFiles(files)
    else void importLocalFilesFallback({ files, pushUiToast })
    syncChatHistoryPathFromActiveFile(0)
  }, [bridge.importLocalFiles, patchChatValues, pushUiToast, syncChatHistoryPathFromActiveFile])

  const importCloudUrlForChatHistory = React.useCallback(() => {
    const next = String(values.chatHistoryCloudUrl || '').trim()
    if (!next) {
      setChatHistoryPathStatus('Set chatHistoryCloudUrl first.')
      return
    }
    patchChatValues({ chatHistoryStorageMode: 'cloud', chatHistoryCloudUrl: next })
    setChatHistoryPathStatus(`Importing URL: ${next}`)
    if (typeof bridge.importUrl === 'function') bridge.importUrl(next)
    else void importUrlFallback({ urlRaw: next, pushUiToast })
  }, [bridge.importUrl, patchChatValues, pushUiToast, values.chatHistoryCloudUrl])

  const importLocalFilesForKnowgrph = React.useCallback((files: FileList | null) => {
    const snapshot = files ? Array.from(files) : []
    if (snapshot.length === 0) return
    setKnowgrphPathStatus('Importing local files...')
    patchChatValues({ chatKnowgrphStorageMode: 'local', chatKnowgrphCloudUrl: '' })
    if (typeof bridge.importLocalFiles === 'function') bridge.importLocalFiles(files)
    else void importLocalFilesFallback({ files, pushUiToast })
    syncKnowgrphPathFromActiveFile(0)
  }, [bridge.importLocalFiles, patchChatValues, pushUiToast, syncKnowgrphPathFromActiveFile])

  const importCloudUrlForKnowgrph = React.useCallback(() => {
    const next = String(values.chatKnowgrphCloudUrl || '').trim()
    if (!next) {
      setKnowgrphPathStatus('Set chatKnowgrphCloudUrl first.')
      return
    }
    patchChatValues({ chatKnowgrphStorageMode: 'cloud', chatKnowgrphCloudUrl: next })
    setKnowgrphPathStatus(`Importing URL: ${next}`)
    if (typeof bridge.importUrl === 'function') bridge.importUrl(next)
    else void importUrlFallback({ urlRaw: next, pushUiToast })
  }, [bridge.importUrl, patchChatValues, pushUiToast, values.chatKnowgrphCloudUrl])

  const patchIntegrationJson = React.useCallback((updater: (current: ReturnType<typeof parseIntegrationConfigsJson>) => ReturnType<typeof parseIntegrationConfigsJson>) => {
    const current = parseIntegrationConfigsJson(
      typeof values.integrationConfigsJson === 'string' ? values.integrationConfigsJson : null,
    )
    const next = stringifyIntegrationConfigs(updater(current))
    dirtyRef.current.add('integrationConfigsJson')
    setValues(prev => ({ ...prev, integrationConfigsJson: next }))
  }, [dirtyRef, setValues, values.integrationConfigsJson])

  const applyChatPreset = React.useCallback(
    (preset: 'byteplus-sg' | 'byteplus-eu' | 'openai' | 'local') => {
      const patch: Record<string, string> =
        preset === 'byteplus-sg'
          ? {
              chatProvider: CHAT_PROVIDER_BYTEPLUS,
              chatEndpointUrl: CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
              chatModel: getDefaultChatModelForProvider(CHAT_PROVIDER_BYTEPLUS),
            }
          : preset === 'byteplus-eu'
            ? {
                chatProvider: CHAT_PROVIDER_BYTEPLUS,
                chatEndpointUrl: CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
                chatModel: getDefaultChatModelForProvider(CHAT_PROVIDER_BYTEPLUS),
              }
            : preset === 'openai'
          ? {
              chatProvider: CHAT_PROVIDER_OPENAI,
              chatEndpointUrl: getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_OPENAI),
              chatModel: CHAT_DEFAULT_MODEL || CHAT_OPENAI_MODEL_OPTIONS[0],
            }
          : {
              chatProvider: CHAT_PROVIDER_LM_STUDIO,
              chatEndpointUrl: getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_LM_STUDIO),
              chatModel: CHAT_LOCAL_DEFAULT_MODEL,
            }
      patchChatValues(patch)
    },
    [patchChatValues],
  )

  const applyChatContextScope = React.useCallback((scope: 'selection' | 'workspace' | 'hybrid') => {
    patchChatValues({ chatContextScope: scope })
  }, [patchChatValues])

  const setChatIntegrationEnabled = React.useCallback((enabled: boolean) => {
    patchIntegrationJson(current => ({
      ...current,
      aiChat: {
        ...current.aiChat,
        enabled,
        openTab: DEFAULT_INTEGRATION_CONFIGS.aiChat.openTab,
      },
    }))
  }, [patchIntegrationJson])

  const resetChatIntegrationRouting = React.useCallback(() => {
    patchIntegrationJson(current => ({
      ...current,
      aiChat: { ...DEFAULT_INTEGRATION_CONFIGS.aiChat },
    }))
  }, [patchIntegrationJson])

  const formatIntegrationJson = React.useCallback(() => {
    const formatted = JSON.stringify(
      parseIntegrationConfigsJson(
        typeof values.integrationConfigsJson === 'string' ? values.integrationConfigsJson : null,
      ),
      null,
      2,
    )
    dirtyRef.current.add('integrationConfigsJson')
    setValues(prev => ({ ...prev, integrationConfigsJson: formatted }))
  }, [dirtyRef, setValues, values.integrationConfigsJson])

  const refreshChatModels = React.useCallback(async () => {
    const endpoint = resolveChatEndpointForModels(values.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL)
    if (!endpoint) {
      setChatModelsStatus('Model catalog unavailable: configure a valid chat endpoint first.')
      setDiscoveredChatModels([])
      return
    }
    setIsRefreshingChatModels(true)
    setChatModelsStatus('Refreshing models...')
    try {
      const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
      const ids = await loadAvailableModelIds(endpoint, buildChatProxyHeaders({
        provider: values.chatProvider,
        apiKey: authMode === 'byok' ? values.chatApiKey : null,
        endpointUrl: values.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL,
        clientRequestId: `kg-chat-models-${Date.now().toString(36)}`,
      }))
      setDiscoveredChatModels(ids)
      setChatModelsStatus(ids.length > 0 ? `Discovered ${ids.length} model${ids.length === 1 ? '' : 's'}.` : 'No models discovered from endpoint.')
    } catch (error: unknown) {
      setDiscoveredChatModels([])
      setChatModelsStatus(`Model discovery failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsRefreshingChatModels(false)
    }
  }, [values.chatAuthMode, values.chatApiKey, values.chatEndpointUrl, values.chatProvider])

  const chatIntegration = React.useMemo(
    () => parseIntegrationConfigsJson(typeof values.integrationConfigsJson === 'string' ? values.integrationConfigsJson : null).aiChat,
    [values.integrationConfigsJson],
  )
  const providerChatModelOptions = React.useMemo(
    () => [...getChatModelOptions(values.chatProvider)],
    [values.chatProvider],
  )
  const chatModelSuggestions = React.useMemo(() => {
    const staticOptions = [
      ...providerChatModelOptions,
      ...CHAT_BYTEPLUS_MODEL_OPTIONS,
      ...CHAT_OPENAI_MODEL_OPTIONS,
      ...CHAT_LOCAL_MODEL_OPTIONS,
    ]
    const currentModel = typeof values.chatModel === 'string' ? values.chatModel.trim() : ''
    const combined = [...staticOptions, ...discoveredChatModels, currentModel].filter(Boolean)
    return Array.from(new Set(combined))
  }, [discoveredChatModels, providerChatModelOptions, values.chatModel])
  const buildSectionMetaAssistNodes = React.useCallback((sectionMeta: SectionMeta | undefined, isFirstRowInArea: boolean, rowKey: string): React.ReactNode[] => {
    if (!sectionMeta || !isFirstRowInArea) return []
    const nodes: React.ReactNode[] = [
      <button
        key={`${rowKey}-open-panel`}
        type="button"
        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
        onClick={e => {
          e.stopPropagation()
          sectionMeta.openPanel()
        }}
      >
        {sectionMeta.panelLabel}
      </button>,
    ]
    if (sectionMeta.docsUrl && sectionMeta.docsLabel) {
      nodes.push(
        <a
          key={`${rowKey}-docs-link`}
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          href={sectionMeta.docsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
        >
          {sectionMeta.docsLabel}
        </a>,
      )
    }
    if (sectionMeta.note) {
      nodes.push(
        <span
          key={`${rowKey}-section-note`}
          className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {sectionMeta.note}
        </span>,
      )
    }
    sectionMeta.highlights?.forEach(highlight => {
      nodes.push(
        <span
          key={`${rowKey}-highlight-${highlight}`}
          className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {highlight}
        </span>,
      )
    })
    return nodes
  }, [])
  const buildChatAssistNodes = React.useCallback((rowKey: string): React.ReactNode[] => {
    if (rowKey === CHAT_KTV_ROW_KEYS.apiKey) {
      return [
        <span
          key="chat-api-key-session"
          className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          Session-only; never localStorage
        </span>,
        <button
          key="chat-api-key-open"
          type="button"
          className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
          onClick={e => {
            e.stopPropagation()
            openLocalChatApiKeyEntry()
          }}
        >
          Open Local API Key
        </button>,
      ]
    }
    if (rowKey === CHAT_KTV_ROW_KEYS.provider) {
      return [
        <button
          key="chat-provider-byteplus-sg"
          type="button"
          className={`App-toolbar__btn text-xs ${
            normalizedChatProvider === CHAT_PROVIDER_BYTEPLUS && String(values.chatEndpointUrl || '').includes(CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL.replace('https://', ''))
              ? uiToolbarToggleActiveClassName
              : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
          }`}
          onClick={e => {
            e.stopPropagation()
            applyChatPreset('byteplus-sg')
          }}
        >
          BytePlus SG
        </button>,
        <button
          key="chat-provider-byteplus-eu"
          type="button"
          className={`App-toolbar__btn text-xs ${
            normalizedChatProvider === CHAT_PROVIDER_BYTEPLUS && String(values.chatEndpointUrl || '').includes(CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL.replace('https://', ''))
              ? uiToolbarToggleActiveClassName
              : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
          }`}
          onClick={e => {
            e.stopPropagation()
            applyChatPreset('byteplus-eu')
          }}
        >
          BytePlus EU
        </button>,
        <button
          key="chat-provider-openai"
          type="button"
          className={`App-toolbar__btn text-xs ${
            normalizedChatProvider === CHAT_PROVIDER_OPENAI
              ? uiToolbarToggleActiveClassName
              : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
          }`}
          onClick={e => {
            e.stopPropagation()
            applyChatPreset('openai')
          }}
        >
          OpenAI
        </button>,
        <button
          key="chat-provider-local"
          type="button"
          className={`App-toolbar__btn text-xs ${
            normalizedChatProvider === CHAT_PROVIDER_LM_STUDIO
              ? uiToolbarToggleActiveClassName
              : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
          }`}
          onClick={e => {
            e.stopPropagation()
            applyChatPreset('local')
          }}
        >
          Local
        </button>,
      ]
    }
    if (rowKey === CHAT_KTV_ROW_KEYS.contextScope) {
      return [
        <button
          key="chat-context-selection"
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          onClick={e => {
            e.stopPropagation()
            applyChatContextScope('selection')
          }}
        >
          Selection
        </button>,
        <button
          key="chat-context-workspace"
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          onClick={e => {
            e.stopPropagation()
            applyChatContextScope('workspace')
          }}
        >
          Workspace
        </button>,
        <button
          key="chat-context-hybrid"
          type="button"
          className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
          onClick={e => {
            e.stopPropagation()
            applyChatContextScope('hybrid')
          }}
        >
          Hybrid
        </button>,
      ]
    }
    if (rowKey === CHAT_KTV_ROW_KEYS.routing) {
      return [
        <span
          key="chat-ai-routing-status"
          className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {chatIntegration.enabled ? 'Enabled' : 'Disabled'}
        </span>,
        <button
          key="chat-ai-routing-enable"
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          onClick={e => {
            e.stopPropagation()
            setChatIntegrationEnabled(true)
          }}
        >
          Enable AI Chat
        </button>,
        <button
          key="chat-ai-routing-disable"
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          onClick={e => {
            e.stopPropagation()
            setChatIntegrationEnabled(false)
          }}
        >
          Disable AI Chat
        </button>,
        <button
          key="chat-ai-routing-reset"
          type="button"
          className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
          onClick={e => {
            e.stopPropagation()
            resetChatIntegrationRouting()
          }}
        >
          Reset Routing
        </button>,
        <button
          key="chat-ai-routing-format"
          type="button"
          className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
          onClick={e => {
            e.stopPropagation()
            formatIntegrationJson()
          }}
        >
          Format JSON
        </button>,
      ]
    }
    if (rowKey === CHAT_KTV_ROW_KEYS.model) {
      const nodes: React.ReactNode[] = [
        <button
          key="chat-model-refresh"
          type="button"
          className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
          onClick={e => {
            e.stopPropagation()
            void refreshChatModels()
          }}
          disabled={isRefreshingChatModels}
        >
          {isRefreshingChatModels ? 'Refreshing...' : 'Refresh Models'}
        </button>,
      ]
      if (chatModelsStatus) {
        nodes.push(
          <span
            key="chat-model-status"
            className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
          >
            {chatModelsStatus}
          </span>,
        )
      }
      if (chatModelSuggestions.length > 0) {
        nodes.push(
          <datalist key="chat-model-options" id="settings-chat-model-options">
            {chatModelSuggestions.map(option => (
              <option key={option} value={option} />
            ))}
          </datalist>,
        )
      }
      return nodes
    }
    return []
  }, [
    applyChatContextScope,
    applyChatPreset,
    chatIntegration.enabled,
    chatModelSuggestions,
    chatModelsStatus,
    formatIntegrationJson,
    isRefreshingChatModels,
    normalizedChatProvider,
    openLocalChatApiKeyEntry,
    refreshChatModels,
    resetChatIntegrationRouting,
    setChatIntegrationEnabled,
    values.chatEndpointUrl,
  ])

  return (
    <article className="min-h-full flex flex-col space-y-0">
      <input
        ref={kgcLocalImportInputRef}
        type="file"
        multiple
        accept={WORKSPACE_IMPORT_ACCEPT}
        className="hidden"
        onChange={e => {
          const files = e.currentTarget.files
          importLocalFilesForKnowgrph(files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={localImportInputRef}
        type="file"
        multiple
        accept={WORKSPACE_IMPORT_ACCEPT}
        className="hidden"
        onChange={e => {
          const files = e.currentTarget.files
          importLocalFilesForChatHistory(files)
          e.currentTarget.value = ''
        }}
      />
      <section className="space-y-0">
        <header className={`sticky ${headerStickyTopClass} z-20 ${headerDividerWidthClass} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <div className="relative">
            <KeyTypeValueRow
              keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
              typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
              valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
              density="compact"
              className="h-9 py-0"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              <ExpandCollapseAllButton
                allCollapsed={allCollapsed}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                titleExpand="Expand"
                titleCollapse="Collapse (Default)"
              />
            </div>
          </div>
        </header>
        {mode === 'payments' && (
          <section className={`p-2 border-b border-white/10 ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="flex flex-wrap items-center gap-1">
              <span className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>Providers</span>
              {paymentsProviders.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  data-main-panel-no-drag="true"
                  className={
                    provider.id === activePaymentsProvider.id
                      ? `App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`
                      : `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                  }
                  onClick={() => {
                    setPaymentsProviderId(provider.id)
                  }}
                >
                  {provider.label}
                </button>
              ))}
              {activePaymentsProvider.docsUrl && (
                <a
                  className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                  href={activePaymentsProvider.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open docs
                </a>
              )}
            </div>
          </section>
        )}
        {mode === 'all' && (
          <section className="p-2 border-b border-white/10">
            <WorkspaceTableModeControl />
          </section>
        )}
        {groupByArea.map(([area, entries]) => {
          const collapsed = normalizedQuery ? false : (collapsedByArea[area] ?? true)
          const responsibilities = entries.map(e => e.details.responsibility).filter(Boolean)
          const firstResponsibility = responsibilities[0]
          const tooltipContent = buildSettingsAreaTooltip(area, firstResponsibility)
          const sectionMeta =
            mode === 'integrations'
              ? INTEGRATIONS_SECTION_META[area]
              : mode === 'mcp'
                ? MCP_SECTION_META[area]
              : mode === 'maps'
                ? MAPS_SECTION_META[area]
                : undefined
          return (
            <CollapsibleSection
              key={area}
              title={(
                <Tooltip
                  content={tooltipContent}
                  maxWidthPx={250}
                  contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{area}</span>
                    <span className={`text-xs uppercase tracking-wide ${UI_THEME_TOKENS.text.tertiary} ml-1`}>
                      {entries.length}
                      {' '}
                      items
                    </span>
                  </span>
                </Tooltip>
              )}
              collapsed={collapsed}
              stickyOffsetClassName={SETTINGS_MAIN_HEADER_STICKY_OFFSET_CLASS}
              onToggle={next => {
                if (normalizedQuery) return
                toggleArea(area, next)
              }}
            >
              <ul>
                {area === 'UI Density: Panels' && (
                  <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                    <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Presets</span>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                      onClick={() => {
                        applyUiPanelDensityPreset('comfortable')
                      }}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                      onClick={() => {
                        applyUiPanelDensityPreset('compact')
                      }}
                    >
                      Compact
                    </button>
                  </li>
                )}
                {entries.map(({
                  meta: s,
                  details,
                  writable,
                  anchorId,
                  typeLabel,
                  valueKey,
                  valueDisplayOverride,
                  valueType,
                  valueOptions,
                  tooltipRole,
                  tooltipActions,
                  tooltipDefaultValue,
                  tooltipMin,
                  tooltipMax,
                  tooltipInterval,
                  tooltipExpansionNote,
                  tooltipContractionNote,
                  tooltipImpact,
                }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const resolvedTypeLabel = String(typeLabel || s.type || '').trim() || 'string'
                  const renderTypeAsText = Boolean(typeLabel)
                  const resolvedValueKey = valueKey || s.key
                  const resolvedInputType = valueType || s.type
                  const resolvedInputOptions = valueOptions || s.options
                  const settingTypeIconKind = resolveFieldTypeIconKind(resolvedTypeLabel)
                  const keyTooltip = buildSettingsKeyTooltip({
                    area: details.area,
                    key: s.key,
                    responsibility: details.responsibility,
                    role: tooltipRole,
                    actions: tooltipActions,
                    outcome: tooltipImpact || details.responsibility,
                  })
                  const valueTooltip = buildSettingsValueTooltip({
                    type: resolvedTypeLabel,
                    key: s.key,
                    defaultValue: s.default ? s.default() : valueDisplayOverride ?? values[resolvedValueKey] ?? null,
                    options: resolvedInputOptions,
                    notes: details.notes,
                    impact: tooltipImpact || details.notes || details.responsibility,
                    defaultValueOverride: tooltipDefaultValue,
                    min: tooltipMin,
                    max: tooltipMax,
                    interval: tooltipInterval,
                    expansionNote: tooltipExpansionNote,
                    contractionNote: tooltipContractionNote,
                  })
                  const pillButtonClassName = `inline-flex items-center justify-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} px-2 text-xs whitespace-nowrap`
                  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
                  const isFirstRowInArea = entries[0]?.meta.key === s.key
                  return (
                    <li key={s.key}>
                      <KeyTypeValueRow
                        id={anchorId}
                        dataKgAnchor={anchorId}
                        keyNode={(
                          <Tooltip
                            content={keyTooltip}
                            maxWidthPx={250}
                            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="truncate">{s.key}</span>
                            </span>
                          </Tooltip>
                        )}
                        typeNode={(
                          renderTypeAsText
                            ? <span className={`inline-flex items-center justify-start sm:justify-end ${UI_THEME_TOKENS.text.secondary}`}>{resolvedTypeLabel}</span>
                            : (
                              <KindPill
                                kind={settingTypeIconKind}
                                label={resolvedTypeLabel}
                                className="inline-flex items-center justify-center"
                                iconClassName={settingsTypeIconSizeClass}
                                iconStrokeWidth={uiIconStrokeWidth}
                              />
                            )
                        )}
                        valueNode={(
                          <div className="flex-1">
                            {(() => {
                              const valueWrapperBaseClass = 'inline-flex w-full min-w-0 items-center min-h-[24px]'
                              const valueWrapperClass = s.type === 'boolean'
                                ? `${valueWrapperBaseClass} justify-end`
                                : valueWrapperBaseClass
                              const inputNode = (writable || hasOptions) && valueTooltip.trim().length > 0
                                ? (
                                  <Tooltip
                                    content={valueTooltip}
                                    maxWidthPx={260}
                                    contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
                                    className="w-full"
                                  >
                                    <span
                                      className={valueWrapperClass}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {renderInput(resolvedValueKey, resolvedInputType, writable, resolvedInputOptions, valueDisplayOverride)}
                                    </span>
                                  </Tooltip>
                                )
                                : (
                                  <span
                                    className={valueWrapperClass}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {renderInput(resolvedValueKey, resolvedInputType, writable, resolvedInputOptions, valueDisplayOverride)}
                                  </span>
                                )
                              if (s.key === 'chatSystemPrompt') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                    </div>
                                    <div className="shrink-0" title={chatHealthDetails || undefined}>
                                      <StatusBadge
                                        label="Chat API"
                                        ok={isCheckingHealth ? null : (chatHealthOk ?? null)}
                                        msg={
                                          isCheckingHealth
                                            ? 'Checking...'
                                            : chatHealthOk === true
                                              ? 'Success'
                                              : chatHealthOk === false
                                                ? 'Failed'
                                                : 'Idle'
                                        }
                                        details={chatHealthDetails || undefined}
                                      />
                                    </div>
                                    {normalizedChatProvider !== CHAT_PROVIDER_BYTEPLUS ? (
                                      <div className="shrink-0" title={bytePlusHealthDetails || undefined}>
                                        <StatusBadge
                                          label="BytePlus API"
                                          ok={isCheckingBytePlusHealth ? null : (bytePlusHealthOk ?? null)}
                                          msg={
                                            isCheckingBytePlusHealth
                                              ? 'Checking...'
                                              : bytePlusHealthOk === true
                                                ? 'Success'
                                                : bytePlusHealthOk === false
                                                  ? 'Failed'
                                                  : 'Idle'
                                          }
                                          details={bytePlusHealthDetails || undefined}
                                        />
                                      </div>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        checkChatHealth()
                                        if (normalizedChatProvider !== CHAT_PROVIDER_BYTEPLUS) {
                                          checkBytePlusHealth()
                                        }
                                        checkBytePlusVideoModelPreview()
                                      }}
                                      disabled={isCheckingHealth || isCheckingBytePlusHealth || isCheckingBytePlusVideoModelPreview}
                                      className={pillButtonClassName}
                                    >
                                      {isCheckingHealth || isCheckingBytePlusHealth || isCheckingBytePlusVideoModelPreview ? 'Checking...' : 'Check Health'}
                                    </button>
                                  </div>
                                )
                              }
                              if (resolvedValueKey === 'maps.grabmaps.apiKey') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                    </div>
                                    <div className="shrink-0" title={grabMapsHealthDetails || undefined}>
                                      <StatusBadge
                                        label="GrabMaps API"
                                        ok={isCheckingGrabMapsHealth ? null : (grabMapsHealthOk ?? null)}
                                        msg={
                                          isCheckingGrabMapsHealth
                                            ? 'Checking...'
                                            : grabMapsHealthOk === true
                                              ? 'Success'
                                              : grabMapsHealthOk === false
                                                ? 'Failed'
                                                : 'Idle'
                                        }
                                        details={grabMapsHealthDetails || undefined}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        void checkGrabMapsHealth()
                                      }}
                                      disabled={isCheckingGrabMapsHealth}
                                      className={pillButtonClassName}
                                    >
                                      {isCheckingGrabMapsHealth ? 'Checking...' : 'Check Health'}
                                    </button>
                                  </div>
                                )
                              }
                              if (s.key === 'stripeApi.auth.secret_key') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <input
                                        value=""
                                        readOnly
                                        placeholder="Server-managed only"
                                        className={`w-full rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} px-2 py-1.5 ${uiPanelKeyValueTextSizeClass}`}
                                        title="Server-managed only"
                                      />
                                      <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                                        Stripe secret keys are not stored in the browser. Use `STRIPE_RESTRICTED_KEY` on the dev or preview server.
                                      </div>
                                    </div>
                                    <span
                                      className={statusPillClassName}
                                      title="Restricted API key recommended; secret stays server-side."
                                    >
                                      server-managed
                                    </span>
                                  </div>
                                )
                              }
                              if (s.key === 'stripeApi.checkout.session_url') {
                                const checkoutUrlValue = String(values[resolvedValueKey] ?? '').trim()

                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <input
                                        value={checkoutUrlValue}
                                        readOnly
                                        placeholder="Server-managed Checkout Session url"
                                        className={`w-full rounded-md border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary} px-2 py-1.5 ${uiPanelKeyValueTextSizeClass}`}
                                        title={checkoutUrlValue || 'Server-managed Checkout Session url'}
                                      />
                                      {stripeCheckoutStatus ? (
                                        <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                                          {stripeCheckoutStatus}
                                        </div>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async e => {
                                        e.stopPropagation()
                                        if (isGeneratingStripeCheckout) return
                                        setStripeCheckoutStatus(null)
                                        setIsGeneratingStripeCheckout(true)
                                        try {
                                          const origin = typeof window !== 'undefined' ? window.location.origin : ''
                                          const basePath = typeof window !== 'undefined' ? window.location.pathname : '/'
                                          const successUrl = `${origin}${basePath}?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}`
                                          const cancelUrl = `${origin}${basePath}?stripeCheckout=cancel`
                                          const created = await createStripeHostedCheckoutSessionUrl({
                                            successUrl,
                                            cancelUrl,
                                          })
                                          dirtyRef.current.add(resolvedValueKey)
                                          setValues(prev => ({ ...prev, [resolvedValueKey]: created.url }))
                                          setStripeCheckoutStatus('Generated secure Checkout Session URL. Click Apply to persist.')
                                          pushUiToast({
                                            id: `stripe-checkout-generated-${created.id}`,
                                            kind: 'neutral',
                                            message: 'Generated secure Stripe Checkout Session URL. Click Apply to persist.',
                                            ttlMs: 2600,
                                          })
                                        } catch (err) {
                                          const msg = err instanceof Error ? err.message : 'Failed to generate Stripe Checkout Session.'
                                          setStripeCheckoutStatus(msg)
                                          pushUiToast({
                                            id: 'stripe-checkout-generate-failed',
                                            kind: 'error',
                                            message: msg,
                                            ttlMs: 3200,
                                          })
                                        } finally {
                                          setIsGeneratingStripeCheckout(false)
                                        }
                                      }}
                                      disabled={isGeneratingStripeCheckout}
                                      className={pillButtonClassName}
                                      title="Create a server-managed Checkout Session and fill the returned Session url."
                                    >
                                      {isGeneratingStripeCheckout ? 'Generating...' : 'Generate (secure)'}
                                    </button>
                                    <span
                                      className={statusPillClassName}
                                      title="Secret key stays server-side; browser only receives the returned Session url."
                                    >
                                      server-managed
                                    </span>
                                  </div>
                                )
                              }
                              if (s.key === 'chatHistoryWorkspacePath') {
                                const currentPath = typeof values.chatHistoryWorkspacePath === 'string'
                                  ? values.chatHistoryWorkspacePath.trim()
                                  : ''
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                      {chatHistoryPathStatus && (
                                        <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                                          {chatHistoryPathStatus}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        openFilePicker(localImportInputRef.current)
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Import Local
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        useActiveWorkspaceFileAsChatHistory()
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Use Active
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        void createAndSelectChatHistoryFile()
                                      }}
                                      disabled={isUpdatingChatHistoryPath}
                                      className={pillButtonClassName}
                                    >
                                      {isUpdatingChatHistoryPath ? 'Creating...' : 'New File'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        if (!currentPath) {
                                          setChatHistoryPathStatus('Chat history path is not set.')
                                          return
                                        }
                                        openWorkspaceFile(currentPath)
                                      }}
                                      disabled={!currentPath}
                                      className={pillButtonClassName}
                                    >
                                      Open
                                    </button>
                                  </div>
                                )
                              }
                              if (s.key === 'chatKnowgrphWorkspacePath') {
                                const currentPath = typeof values.chatKnowgrphWorkspacePath === 'string'
                                  ? values.chatKnowgrphWorkspacePath.trim()
                                  : ''
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                      {knowgrphPathStatus && (
                                        <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                                          {knowgrphPathStatus}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        openFilePicker(kgcLocalImportInputRef.current)
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Import Local
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        useActiveWorkspaceFileAsKnowgrph()
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Use Active
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        void createAndSelectKnowgrphFile()
                                      }}
                                      disabled={isUpdatingKnowgrphPath}
                                      className={pillButtonClassName}
                                    >
                                      {isUpdatingKnowgrphPath ? 'Creating...' : 'New File'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        if (!currentPath) {
                                          setKnowgrphPathStatus('chatKnowgrph path is not set.')
                                          return
                                        }
                                        openWorkspaceFile(currentPath)
                                      }}
                                      disabled={!currentPath}
                                      className={pillButtonClassName}
                                    >
                                      Open
                                    </button>
                                  </div>
                                )
                              }
                              if (s.key === 'chatHistoryCloudUrl') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        importCloudUrlForChatHistory()
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Import URL
                                    </button>
                                  </div>
                                )
                              }
                              if (s.key === 'chatKnowgrphCloudUrl') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        importCloudUrlForKnowgrph()
                                      }}
                                      className={pillButtonClassName}
                                    >
                                      Import URL
                                    </button>
                                  </div>
                                )
                              }
                              const assistNodes = [
                                ...buildSectionMetaAssistNodes(sectionMeta, isFirstRowInArea, s.key),
                                ...(area === 'Chat' ? buildChatAssistNodes(s.key) : []),
                              ]
                              if (assistNodes.length > 0) {
                                return (
                                  <div className="space-y-1">
                                    {inputNode}
                                    <div className="flex flex-wrap items-center gap-1">
                                      {assistNodes}
                                    </div>
                                  </div>
                                )
                              }
                              return inputNode
                            })()}
                          </div>
                        )}
                        onClick={() => setExpanded(isExpanded ? null : s.key)}
                      />
                      {isExpanded && (
                        <div className={`mt-0 mb-0 text-xs ${UI_THEME_TOKENS.text.secondary} border-l pl-2`}>
                          <table className={`w-full text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
                            <thead>
                              <tr>
                                <th className="font-medium p-1">Modules</th>
                                <th className="font-medium p-1">Classes/Objects</th>
                                <th className="font-medium p-1">Functions/Methods</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.modules || []).join(', ') || '—'}</td>
                                <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.classes || []).join(', ') || '—'}</td>
                                <td className={`p-1 align-top border-b ${UI_THEME_TOKENS.table.cellBorder}`}>{(details.functions || []).join(', ') || '—'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CollapsibleSection>
          )
        })}
        {mode === 'all' && (
          <CollapsibleSection
            title="Resets and data"
            collapsed={false}
            onToggle={() => void 0}
            className={`mt-2 pt-2 border-t ${UI_COLOR_DANGER_RED_BORDER}`}
          >
            <div className={`space-y-1 text-xs ${UI_THEME_TOKENS.text.primary}`}>
              <div>
                Reset all settings to defaults and clear canvas data. This action cannot be undone.
              </div>
              <button
                type="button"
                className={uiDangerButtonClassName}
                onClick={onGlobalReset}
              >
                Global Reset
              </button>
            </div>
          </CollapsibleSection>
        )}
      </section>
    </article>
  )
}
