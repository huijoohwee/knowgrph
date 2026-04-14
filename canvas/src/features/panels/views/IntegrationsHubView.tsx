import React from 'react'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseIntegrationConfigsJson } from '@/features/integrations/config'
import { useShallow } from 'zustand/react/shallow'
import { getChatProviderLabel, getChatProviderRegionLabel } from '@/lib/chatEndpoint'

type HubAction = {
  key: string
  label: string
  description: string
  settingsSearchQuery: string
  status: string[]
}

export default function IntegrationsHubView() {
  const panelTypography = usePanelTypography()
  const {
    chatProvider,
    chatModel,
    chatEndpointUrl,
    integrationConfigsJson,
  } = useGraphStore(
    useShallow(state => ({
      chatProvider: state.chatProvider,
      chatModel: state.chatModel,
      chatEndpointUrl: state.chatEndpointUrl,
      integrationConfigsJson: state.integrationConfigsJson,
    })),
  )
  const integrations = React.useMemo(
    () => parseIntegrationConfigsJson(integrationConfigsJson),
    [integrationConfigsJson],
  )
  const settingsActions = React.useMemo<ReadonlyArray<HubAction>>(() => {
    const chatProviderLabel = getChatProviderLabel(chatProvider)
    const chatProviderRegion = getChatProviderRegionLabel(chatProvider, chatEndpointUrl)
    const chatEndpointLabel =
      String(chatEndpointUrl || '').trim().startsWith('/__chat_proxy/')
        ? 'Proxy endpoint'
        : 'Official endpoint'
    return [
      {
        key: 'chat',
        label: UI_LABELS.chat,
        description: 'Configure official AI chat routing, provider, endpoint, model, and key policy in Settings.',
        settingsSearchQuery: 'chat',
        status: [
          integrations.aiChat.enabled ? 'Enabled' : 'Disabled',
          chatProviderLabel,
          chatProviderRegion,
          chatModel || 'model',
          chatEndpointLabel,
        ],
      },
      {
        key: 'simulationCommands',
        label: 'Simulation Commands',
        description: 'Configure simulation command prefix, defaults, and enablement in Settings.',
        settingsSearchQuery: 'integrationConfigsJson',
        status: [
          integrations.simulationCommands.enabled ? 'Enabled' : 'Disabled',
          integrations.simulationCommands.commandPrefix || '/simulate',
          integrations.simulationCommands.defaultPlatform,
        ],
      },
      {
        key: 'graphTraversal',
        label: UI_LABELS.graphTraversal,
        description: 'Configure traversal integration behavior and defaults in Settings.',
        settingsSearchQuery: 'integrationConfigsJson',
        status: ['Settings-driven'],
      },
      {
        key: 'geo',
        label: UI_LABELS.geo,
        description: 'Configure geo integration and workspace behavior in Settings.',
        settingsSearchQuery: 'geospatial',
        status: ['Settings-driven'],
      },
      {
        key: 'inspector',
        label: UI_LABELS.inspector,
        description: 'Configure inspector integration behavior in Settings.',
        settingsSearchQuery: 'inspector',
        status: ['Settings-driven'],
      },
    ]
  }, [chatEndpointUrl, chatModel, chatProvider, integrations.aiChat.enabled, integrations.simulationCommands.commandPrefix, integrations.simulationCommands.defaultPlatform, integrations.simulationCommands.enabled])
  const openIntegrationsSettings = React.useCallback((settingsSearchQuery: string) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent(MAIN_PANEL_OPEN_EVENT, {
        detail: {
          tab: 'settings' as const,
          searchQuery: settingsSearchQuery,
        },
      }),
    )
  }, [])

  return (
    <section className="h-full min-h-0 overflow-auto pr-1" aria-label={UI_LABELS.integrations}>
      <section className={`space-y-2 pb-3 ${panelTypography.panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>
        <p className={UI_THEME_TOKENS.text.primary}>Centralized integration hub for native AI and simulation tooling surfaces.</p>
        <p>Each card reflects current runtime state and opens the matching Settings slice without duplicating integration state.</p>
      </section>
      <section className="grid grid-cols-1 gap-2">
        {settingsActions.map(action => (
          <button
            key={action.key}
            type="button"
            onClick={() => openIntegrationsSettings(action.settingsSearchQuery)}
            className={`w-full text-left rounded-md border px-3 py-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
          >
            <section className="flex flex-wrap items-start justify-between gap-2">
              <p className={`${panelTypography.panelTextClass} ${UI_THEME_TOKENS.text.primary}`}>{action.label}</p>
              <section className="flex flex-wrap justify-end gap-1">
                {action.status.map(token => (
                  <span
                    key={`${action.key}-${token}`}
                    className={`inline-flex items-center rounded-full border px-2 py-[1px] ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}
                  >
                    {token}
                  </span>
                ))}
              </section>
            </section>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>{action.description}</p>
          </button>
        ))}
      </section>
    </section>
  )
}
