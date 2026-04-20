import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
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
} from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useSettingsView } from './useSettingsView'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { createNewChatHistoryWorkspaceFilePath } from '@/features/chat/chatHistoryWorkspace'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { importLocalFilesFallback, importUrlFallback } from '@/features/toolbar/launchDropdownFallbacks'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_DEFAULT_MODEL,
  CHAT_DEFAULT_PROVIDER,
  CHAT_LOCAL_DEFAULT_MODEL,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_LM_STUDIO,
  CHAT_PROVIDER_OPENAI,
  CHAT_OPENAI_MODEL_OPTIONS,
  CHAT_LOCAL_MODEL_OPTIONS,
  buildChatProxyHeaders,
  getChatDefaultEndpointUrlForProvider,
  getChatProviderLabel,
  getChatProviderRegionLabel,
  getChatRecommendedModelHint,
  resolveChatEndpointForModels,
} from '@/lib/chatEndpoint'
import { loadAvailableModelIds } from '@/features/chat/SidePanelChat.helpers'
import {
  DEFAULT_INTEGRATION_CONFIGS,
  parseIntegrationConfigsJson,
  stringifyIntegrationConfigs,
} from '@/features/integrations/config'

const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')

export default function SettingsView({
  searchQuery,
  onRegisterActions,
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
}) {
  const {
    expanded,
    setExpanded,
    chatHealthStatus,
    isCheckingHealth,
    checkChatHealth,
    onGlobalReset,
    renderInput,
    collapsedByArea,
    groupByArea,
    normalizedQuery,
    toggleArea,
    uiPanelKeyValueTextSizeClass,
    values,
    setValues,
    dirtyRef,
  } = useSettingsView({ searchQuery, onRegisterActions })
  const [chatModelsStatus, setChatModelsStatus] = React.useState<string | null>(null)
  const [isRefreshingChatModels, setIsRefreshingChatModels] = React.useState(false)
  const [discoveredChatModels, setDiscoveredChatModels] = React.useState<string[]>([])
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
  const normalizedChatProvider = React.useMemo(
    () => String(values.chatProvider || '').trim() || CHAT_DEFAULT_PROVIDER,
    [values.chatProvider],
  )
  const chatProviderLabel = React.useMemo(
    () => getChatProviderLabel(values.chatProvider),
    [values.chatProvider],
  )
  const chatProviderRegion = React.useMemo(
    () => getChatProviderRegionLabel(values.chatProvider, values.chatEndpointUrl || CHAT_DEFAULT_ENDPOINT_URL),
    [values.chatEndpointUrl, values.chatProvider],
  )
  const chatProviderHint = React.useMemo(
    () => getChatRecommendedModelHint(values.chatProvider),
    [values.chatProvider],
  )
  const chatAuthModeLabel = React.useMemo(
    () => (String(values.chatAuthMode || '').trim() === 'byok' ? 'BYOK' : 'Server-managed Key'),
    [values.chatAuthMode],
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
    const shouldApplyProvider = dirtyRef.current.has('chatProvider')
    const shouldApplyAuthMode = dirtyRef.current.has('chatAuthMode')
    const shouldApplyApiKey = dirtyRef.current.has('chatApiKey')
    if (!shouldApplyProvider && !shouldApplyAuthMode && !shouldApplyApiKey) return

    const nextProvider = String(values.chatProvider || '').trim()
    const nextAuthMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
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
              chatModel: '',
            }
          : preset === 'byteplus-eu'
            ? {
                chatProvider: CHAT_PROVIDER_BYTEPLUS,
                chatEndpointUrl: CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
                chatModel: '',
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
  const chatModelSuggestions = React.useMemo(() => {
    const staticOptions = [
      ...CHAT_OPENAI_MODEL_OPTIONS,
      ...CHAT_LOCAL_MODEL_OPTIONS,
    ]
    const currentModel = typeof values.chatModel === 'string' ? values.chatModel.trim() : ''
    const combined = [...staticOptions, ...discoveredChatModels, currentModel].filter(Boolean)
    return Array.from(new Set(combined))
  }, [discoveredChatModels, values.chatModel])

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
        <header className={`sticky top-0 z-10 border-b ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <KeyTypeValueRow
            keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
            typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
            valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
            density="compact"
            className="h-9 py-0"
          />
        </header>
        <section className="p-2 border-b border-white/10">
          <WorkspaceTableModeControl />
        </section>
        {groupByArea.map(([area, entries]) => {
          const collapsed = normalizedQuery ? false : (collapsedByArea[area] ?? true)
          const responsibilities = entries.map(e => e.details.responsibility).filter(Boolean)
          const firstResponsibility = responsibilities[0]
          const tooltipContent = buildSettingsAreaTooltip(area, firstResponsibility)
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
                {area === 'Chat' && (
                  <>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Official AI</span>
                      <span className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatProviderLabel}
                      </span>
                      <span className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatProviderRegion}
                      </span>
                      <span className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatAuthModeLabel}
                      </span>
                      <span className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatProviderHint}
                      </span>
                    </li>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Local key entry</span>
                      <span className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        Session-only; never localStorage
                      </span>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                        onClick={() => {
                          openLocalChatApiKeyEntry()
                        }}
                      >
                        Open Local API Key
                      </button>
                    </li>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Provider profiles</span>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${
                          normalizedChatProvider === CHAT_PROVIDER_BYTEPLUS && String(values.chatEndpointUrl || '').includes(CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL.replace('https://', ''))
                            ? uiToolbarToggleActiveClassName
                            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                        }`}
                        onClick={() => {
                          applyChatPreset('byteplus-sg')
                        }}
                      >
                        BytePlus SG
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${
                          normalizedChatProvider === CHAT_PROVIDER_BYTEPLUS && String(values.chatEndpointUrl || '').includes(CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL.replace('https://', ''))
                            ? uiToolbarToggleActiveClassName
                            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                        }`}
                        onClick={() => {
                          applyChatPreset('byteplus-eu')
                        }}
                      >
                        BytePlus EU
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${
                          normalizedChatProvider === CHAT_PROVIDER_OPENAI
                            ? uiToolbarToggleActiveClassName
                            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                        }`}
                        onClick={() => {
                          applyChatPreset('openai')
                        }}
                      >
                        OpenAI
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${
                          normalizedChatProvider === CHAT_PROVIDER_LM_STUDIO
                            ? uiToolbarToggleActiveClassName
                            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                        }`}
                        onClick={() => {
                          applyChatPreset('local')
                        }}
                      >
                        Local
                      </button>
                    </li>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Context scope</span>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                        onClick={() => {
                          applyChatContextScope('selection')
                        }}
                      >
                        Selection
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                        onClick={() => {
                          applyChatContextScope('workspace')
                        }}
                      >
                        Workspace
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                        onClick={() => {
                          applyChatContextScope('hybrid')
                        }}
                      >
                        Hybrid
                      </button>
                    </li>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>AI routing</span>
                      <span className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatIntegration.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                        onClick={() => {
                          setChatIntegrationEnabled(true)
                        }}
                      >
                        Enable AI Chat
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                        onClick={() => {
                          setChatIntegrationEnabled(false)
                        }}
                      >
                        Disable AI Chat
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                        onClick={() => {
                          resetChatIntegrationRouting()
                        }}
                      >
                        Reset Routing
                      </button>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                        onClick={() => {
                          formatIntegrationJson()
                        }}
                      >
                        Format JSON
                      </button>
                    </li>
                    <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Model catalog</span>
                      <button
                        type="button"
                        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                        onClick={() => {
                          void refreshChatModels()
                        }}
                        disabled={isRefreshingChatModels}
                      >
                        {isRefreshingChatModels ? 'Refreshing...' : 'Refresh Models'}
                      </button>
                      {chatModelsStatus && (
                        <span className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                          {chatModelsStatus}
                        </span>
                      )}
                      {chatModelSuggestions.length > 0 && (
                        <datalist id="settings-chat-model-options">
                          {chatModelSuggestions.map(option => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      )}
                    </li>
                  </>
                )}
                {entries.map(({ meta: s, details, writable, anchorId }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const keyTooltip = buildSettingsKeyTooltip({
                    area: details.area,
                    key: s.key,
                    responsibility: details.responsibility,
                  })
                  const valueTooltip = buildSettingsValueTooltip({
                    type: s.type,
                    key: s.key,
                    defaultValue: s.default ? s.default() : null,
                    options: s.options,
                    notes: details.notes,
                    impact: details.notes || details.responsibility,
                  })
                  const pillButtonClassName = `inline-flex items-center justify-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} px-2 text-xs whitespace-nowrap`
                  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
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
                        typeNode={s.type}
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
                                      {renderInput(s.key, s.type, writable, s.options)}
                                    </span>
                                  </Tooltip>
                                )
                                : (
                                  <span
                                    className={valueWrapperClass}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {renderInput(s.key, s.type, writable, s.options)}
                                  </span>
                                )
                              if (s.key === 'chatSystemPrompt') {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      {inputNode}
                                    </div>
                                    {chatHealthStatus && (
                                      <span className={statusPillClassName} title={chatHealthStatus}>
                                        <span className="truncate overflow-hidden whitespace-nowrap">
                                          {chatHealthStatus}
                                        </span>
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation()
                                        checkChatHealth()
                                      }}
                                      disabled={isCheckingHealth}
                                      className={pillButtonClassName}
                                    >
                                      {isCheckingHealth ? 'Checking...' : 'Check Health'}
                                    </button>
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
                              return inputNode
                            })()}
                          </div>
                        )}
                        onClick={() => setExpanded(isExpanded ? null : s.key)}
                      />
                      {isExpanded && (
                        <div className={`mt-0 mb-0 text-xs ${UI_THEME_TOKENS.text.primary} border-l pl-2`}>
                          <table className={`w-full text-left border-collapse ${uiPanelKeyValueTextSizeClass || ''}`}>
                            <thead>
                              <tr>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Modules</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Classes/Objects</th>
                                <th className={`font-medium p-1 border-b ${UI_THEME_TOKENS.table.cellBorder}`}>Functions/Methods</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.modules || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.classes || []).join(', ') || '—'}</td>
                                <td className={`p-1 border-b ${UI_THEME_TOKENS.table.cellBorder} align-top`}>{(details.functions || []).join(', ') || '—'}</td>
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
      </section>
    </article>
  )
}
