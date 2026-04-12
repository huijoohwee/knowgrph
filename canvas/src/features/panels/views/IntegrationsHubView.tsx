import React from 'react'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

type HubAction = {
  key: string
  label: string
  description: string
  settingsSearchQuery: string
}

const INTEGRATIONS_SETTINGS_ACTIONS: ReadonlyArray<HubAction> = [
  {
    key: 'chat',
    label: UI_LABELS.chat,
    description: 'Configure AI chat provider, endpoint, and key policy in Settings.',
    settingsSearchQuery: 'chat',
  },
  {
    key: 'simulationCommands',
    label: 'Simulation Commands',
    description: 'Configure simulation command prefix, defaults, and enablement in Settings.',
    settingsSearchQuery: 'integrationConfigsJson',
  },
  {
    key: 'graphTraversal',
    label: UI_LABELS.graphTraversal,
    description: 'Configure traversal integration behavior and defaults in Settings.',
    settingsSearchQuery: 'integrationConfigsJson',
  },
  {
    key: 'geo',
    label: UI_LABELS.geo,
    description: 'Configure geo integration and workspace behavior in Settings.',
    settingsSearchQuery: 'geospatial',
  },
  {
    key: 'inspector',
    label: UI_LABELS.inspector,
    description: 'Configure inspector integration behavior in Settings.',
    settingsSearchQuery: 'inspector',
  },
]

export default function IntegrationsHubView() {
  const panelTypography = usePanelTypography()
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
        <p>Open Integrations settings to configure behavior, providers, and defaults from one user-editable control path.</p>
      </section>
      <section className="grid grid-cols-1 gap-2">
        {INTEGRATIONS_SETTINGS_ACTIONS.map(action => (
          <button
            key={action.key}
            type="button"
            onClick={() => openIntegrationsSettings(action.settingsSearchQuery)}
            className={`w-full text-left rounded-md border px-3 py-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}
          >
            <p className={`${panelTypography.panelTextClass} ${UI_THEME_TOKENS.text.primary}`}>{action.label}</p>
            <p className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>{action.description}</p>
          </button>
        ))}
      </section>
    </section>
  )
}
