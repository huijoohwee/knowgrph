import type { SettingMeta } from './types'
import { uiGraphAndOrchestratorSettingsRegistry } from './registry-ui.graph-and-orchestrator'
import { uiGraphDataTableSettingsRegistry } from './registry-ui.graph-data-table'
import { uiUiSettingsRegistry } from './registry-ui.ui'
import { uiImportPdfSettingsRegistry } from './registry-ui.import-pdf'
import { uiMarkdownSettingsRegistry } from './registry-ui.markdown'

export const uiSettingsRegistry: SettingMeta[] = [
  ...uiUiSettingsRegistry,
  ...uiMarkdownSettingsRegistry,
  ...uiImportPdfSettingsRegistry,
  ...uiGraphDataTableSettingsRegistry,
  ...uiGraphAndOrchestratorSettingsRegistry,
]
