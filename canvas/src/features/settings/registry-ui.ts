import type { SettingMeta } from './types'
import { uiGraphAndOrchestratorSettingsRegistry } from './registry-ui.graph-and-orchestrator'
import { uiGraphDataTableSettingsRegistry } from './registry-ui.graph-data-table'
import { uiUiSettingsRegistry } from './registry-ui.ui'
import { uiMapSettingsRegistry } from './registry-ui.map'

export const uiSettingsRegistry: SettingMeta[] = [
  ...uiUiSettingsRegistry,
  ...uiGraphDataTableSettingsRegistry,
  ...uiGraphAndOrchestratorSettingsRegistry,
  ...uiMapSettingsRegistry,
]
