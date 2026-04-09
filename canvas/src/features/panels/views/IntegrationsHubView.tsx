import React from 'react'
import { emitChatInputAppend, emitSidePanelOpen } from '@/features/canvas/utils'
import { emitGraphTraversalFloatingPanelOpen } from '@/features/panels/utils/graphTraversalFloatingPanel'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseIntegrationConfigsJson } from '@/features/integrations/config'

type HubAction = {
  key: string
  label: string
  description: string
  onClick: () => void
}

export default function IntegrationsHubView() {
  const panelTypography = usePanelTypography()
  const integrationConfigsJson = useGraphStore(s => s.integrationConfigsJson)
  const integrationConfigs = React.useMemo(
    () => parseIntegrationConfigsJson(integrationConfigsJson),
    [integrationConfigsJson],
  )

  const actions = React.useMemo<HubAction[]>(
    () => [
      ...(integrationConfigs.aiChat.enabled
        ? [{
            key: 'chat',
            label: UI_LABELS.chat,
            description: 'AI Chat',
            onClick: () => emitSidePanelOpen({ tab: 'chat', open: true }),
          }]
        : []),
      ...(integrationConfigs.simulationCommands.enabled
        ? [{
            key: 'simulationCommands',
            label: 'Simulation Commands',
            description: `Open via ${integrationConfigs.simulationCommands.commandPrefix} (${integrationConfigs.simulationCommands.defaultPlatform})`,
            onClick: () => {
              emitSidePanelOpen({ tab: 'chat', open: true })
              const command = `${integrationConfigs.simulationCommands.commandPrefix} ${integrationConfigs.simulationCommands.defaultSimulationId} ${integrationConfigs.simulationCommands.defaultPlatform}`
              emitChatInputAppend({ text: command, mode: 'replace' })
            },
          }]
        : []),
      {
        key: 'graphTraversal',
        label: UI_LABELS.graphTraversal,
        description: 'AgenticRAG traversal workspace',
        onClick: () => emitGraphTraversalFloatingPanelOpen(),
      },
      {
        key: 'geo',
        label: UI_LABELS.geo,
        description: 'Geo tools workspace',
        onClick: () => emitSidePanelOpen({ tab: 'geo', open: true }),
      },
      {
        key: 'inspector',
        label: UI_LABELS.inspector,
        description: 'Inspector workspace',
        onClick: () => emitSidePanelOpen({ tab: 'inspector', open: true }),
      },
    ],
    [integrationConfigs],
  )

  return (
    <section className="h-full min-h-0 overflow-auto pr-1" aria-label={UI_LABELS.integrations}>
      <section className={`space-y-2 pb-3 ${panelTypography.panelTextClass} ${UI_THEME_TOKENS.text.secondary}`}>
        <p className={UI_THEME_TOKENS.text.primary}>Centralized integration hub for native AI and simulation tooling surfaces.</p>
        <p>Open each surface from one place to prevent duplicated panel entry points.</p>
      </section>
      <section className="grid grid-cols-1 gap-2">
        {actions.map(action => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
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
