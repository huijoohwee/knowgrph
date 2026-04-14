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
import { useSettingsView } from './useSettingsView'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import {
  CHAT_BYTEPLUS_AP_SOUTHEAST_ENDPOINT_URL,
  CHAT_BYTEPLUS_EU_WEST_ENDPOINT_URL,
  CHAT_DEFAULT_ENDPOINT_URL,
  CHAT_DEFAULT_MODEL,
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
  const normalizedChatProvider = React.useMemo(
    () => String(values.chatProvider || '').trim() || CHAT_PROVIDER_BYTEPLUS,
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
      const ids = await loadAvailableModelIds(endpoint, buildChatProxyHeaders({
        provider: values.chatProvider,
        apiKey: values.chatApiKey,
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
  }, [values.chatApiKey, values.chatEndpointUrl, values.chatProvider])

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
                      <span className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
                        {chatProviderHint}
                      </span>
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
                              if (s.key !== 'chatSystemPrompt') return inputNode
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
