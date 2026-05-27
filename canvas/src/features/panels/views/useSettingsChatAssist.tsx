import React from 'react'
import { loadAvailableModelIds } from '@/features/chat/FloatingPanelChat.helpers'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_DEFAULT_MODEL,
  CHAT_MIROMIND_MODEL_OPTIONS,
  CHAT_DEFAULT_PROVIDER,
  CHAT_LOCAL_DEFAULT_MODEL,
  CHAT_LOCAL_MODEL_OPTIONS,
  CHAT_OPENAI_MODEL_OPTIONS,
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_LM_STUDIO,
  CHAT_PROVIDER_MIROMIND,
  CHAT_PROVIDER_OPENAI,
  buildChatProxyHeaders,
  getChatDefaultEndpointUrlForProvider,
  getDefaultChatModelForProvider,
  getSharedChatModelSuggestionOptions,
  resolveChatEndpointForModels,
} from '@/lib/chatEndpoint'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { uiToolbarToggleActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { parseIntegrationConfigsJson, stringifyIntegrationConfigs, DEFAULT_INTEGRATION_CONFIGS } from '@/features/integrations/config'
import {
  clearLocalSettingsChatReadinessSurfaceSnapshot,
  publishLocalSettingsChatReadinessSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { CHAT_KTV_ROW_KEYS } from './settingsView.constants'

type UseSettingsChatAssistArgs = {
  dirtyRef: React.MutableRefObject<Set<string>>
  openLocalChatApiKeyEntry: () => void
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>
  values: Record<string, string | number | boolean>
}

export function useSettingsChatAssist({
  dirtyRef,
  openLocalChatApiKeyEntry,
  setValues,
  values,
}: UseSettingsChatAssistArgs) {
  const [chatModelsStatus, setChatModelsStatus] = React.useState<string | null>(null)
  const [isRefreshingChatModels, setIsRefreshingChatModels] = React.useState(false)
  const [discoveredChatModels, setDiscoveredChatModels] = React.useState<string[]>([])

  const normalizedChatProvider = React.useMemo(
    () => String(values.chatProvider || '').trim() || CHAT_DEFAULT_PROVIDER,
    [values.chatProvider],
  )

  const patchChatValues = React.useCallback((patch: Record<string, string>) => {
    Object.keys(patch).forEach(key => dirtyRef.current.add(key))
    setValues(prev => ({ ...prev, ...patch }))
  }, [dirtyRef, setValues])

  const patchIntegrationJson = React.useCallback((updater: (current: ReturnType<typeof parseIntegrationConfigsJson>) => ReturnType<typeof parseIntegrationConfigsJson>) => {
    const current = parseIntegrationConfigsJson(
      typeof values.integrationConfigsJson === 'string' ? values.integrationConfigsJson : null,
    )
    const next = stringifyIntegrationConfigs(updater(current))
    dirtyRef.current.add('integrationConfigsJson')
    setValues(prev => ({ ...prev, integrationConfigsJson: next }))
  }, [dirtyRef, setValues, values.integrationConfigsJson])

  const applyChatPreset = React.useCallback((preset: 'byteplus-sg' | 'byteplus-eu' | 'miromind' | 'openai' | 'local') => {
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
          : preset === 'miromind'
            ? {
                chatProvider: CHAT_PROVIDER_MIROMIND,
                chatEndpointUrl: getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_MIROMIND),
                chatModel: CHAT_MIROMIND_MODEL_OPTIONS[0],
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
  }, [patchChatValues])

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

  const setPixVerseVideoIntegration = React.useCallback((
    enabled: boolean,
    strategy: 'auto' | 'image-to-video' | 'transition-video' | 'text-to-video' = 'auto',
  ) => {
    patchIntegrationJson(current => ({
      ...current,
      pixverseVideo: {
        ...DEFAULT_INTEGRATION_CONFIGS.pixverseVideo,
        ...current.pixverseVideo,
        enabled,
        strategy,
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
  const pixverseVideoIntegration = React.useMemo(
    () => parseIntegrationConfigsJson(typeof values.integrationConfigsJson === 'string' ? values.integrationConfigsJson : null).pixverseVideo,
    [values.integrationConfigsJson],
  )
  const chatModelSuggestions = React.useMemo(() => {
    return getSharedChatModelSuggestionOptions({
      provider: values.chatProvider,
      discoveredModels: discoveredChatModels,
      currentModel: values.chatModel,
    })
  }, [discoveredChatModels, values.chatModel, values.chatProvider])

  React.useEffect(() => {
    publishLocalSettingsChatReadinessSurfaceSnapshot({
      normalizedChatProvider,
      chatEndpointUrl: String(values.chatEndpointUrl || '').trim(),
      chatModel: String(values.chatModel || '').trim(),
      chatAuthMode: String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged',
      chatContextScope: String(values.chatContextScope || '').trim() || 'hybrid',
      integrationEnabled: chatIntegration.enabled === true,
      integrationOpenTab: String(chatIntegration.openTab || '').trim(),
      pixverseVideoEnabled: pixverseVideoIntegration.enabled === true,
      pixverseVideoStrategy: String(pixverseVideoIntegration.strategy || '').trim() || 'auto',
      pixverseVideoTransport: String(pixverseVideoIntegration.transport || '').trim() || 'mcp-stdio',
      isRefreshingChatModels,
      chatModelsStatus,
      discoveredChatModelCount: discoveredChatModels.length,
      suggestedChatModelCount: chatModelSuggestions.length,
    })
    return () => {
      clearLocalSettingsChatReadinessSurfaceSnapshot()
    }
  }, [
    chatIntegration.enabled,
    chatIntegration.openTab,
    pixverseVideoIntegration.enabled,
    pixverseVideoIntegration.strategy,
    pixverseVideoIntegration.transport,
    chatModelSuggestions.length,
    chatModelsStatus,
    discoveredChatModels.length,
    isRefreshingChatModels,
    normalizedChatProvider,
    values.chatAuthMode,
    values.chatContextScope,
    values.chatEndpointUrl,
    values.chatModel,
  ])

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
          key="chat-provider-miromind"
          type="button"
          className={`App-toolbar__btn text-xs ${
            normalizedChatProvider === CHAT_PROVIDER_MIROMIND
              ? uiToolbarToggleActiveClassName
              : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
          }`}
          onClick={e => {
            e.stopPropagation()
            applyChatPreset('miromind')
          }}
        >
          MiroMind
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
        <span
          key="chat-pixverse-status"
          className={`inline-flex items-center h-6 rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {pixverseVideoIntegration.enabled
            ? `PixVerse ${String(pixverseVideoIntegration.strategy || 'auto')}`
            : 'PixVerse disabled'}
        </span>,
        <button
          key="chat-pixverse-auto"
          type="button"
          className={`App-toolbar__btn text-xs ${pixverseVideoIntegration.enabled === true && pixverseVideoIntegration.strategy === 'auto'
            ? uiToolbarToggleActiveClassName
            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={e => {
            e.stopPropagation()
            setPixVerseVideoIntegration(true, 'auto')
          }}
        >
          PixVerse Auto
        </button>,
        <button
          key="chat-pixverse-i2v"
          type="button"
          className={`App-toolbar__btn text-xs ${pixverseVideoIntegration.enabled === true && pixverseVideoIntegration.strategy === 'image-to-video'
            ? uiToolbarToggleActiveClassName
            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={e => {
            e.stopPropagation()
            setPixVerseVideoIntegration(true, 'image-to-video')
          }}
        >
          PixVerse I2V
        </button>,
        <button
          key="chat-pixverse-transition"
          type="button"
          className={`App-toolbar__btn text-xs ${pixverseVideoIntegration.enabled === true && pixverseVideoIntegration.strategy === 'transition-video'
            ? uiToolbarToggleActiveClassName
            : `border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}`}
          onClick={e => {
            e.stopPropagation()
            setPixVerseVideoIntegration(true, 'transition-video')
          }}
        >
          PixVerse Transition
        </button>,
        <button
          key="chat-pixverse-disable"
          type="button"
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          onClick={e => {
            e.stopPropagation()
            setPixVerseVideoIntegration(false, 'auto')
          }}
        >
          Disable PixVerse
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
    pixverseVideoIntegration.enabled,
    pixverseVideoIntegration.strategy,
    refreshChatModels,
    resetChatIntegrationRouting,
    setChatIntegrationEnabled,
    setPixVerseVideoIntegration,
    values.chatEndpointUrl,
  ])

  return {
    buildChatAssistNodes,
  }
}
