import type { SettingMeta } from './types'
import { uiGraphAndOrchestratorSettingsRegistry } from './registry-ui.graph-and-orchestrator'
import { uiUiSettingsRegistry } from './registry-ui.ui'
import { uiCanvasGridSettingsRegistry } from './registry-ui.canvas-grid'
import { uiImportPdfSettingsRegistry } from './registry-ui.import-pdf'
import { uiMarkdownSettingsRegistry } from './registry-ui.markdown'
import { uiImportYoutubeSettingsRegistry } from './registry-ui.import-youtube'
import { uiImportWebpageSettingsRegistry } from './registry-ui.import-webpage'
import { uiImportGeoSettingsRegistry } from './registry-ui.import-geo'
import { uiBipartiteSettingsRegistry } from './registry-ui.bipartite'
import { uiMonacoSettingsRegistry } from './registry-ui.monaco'

export const uiSettingsRegistry: SettingMeta[] = [
  ...uiUiSettingsRegistry,
  ...uiCanvasGridSettingsRegistry,
  ...uiMarkdownSettingsRegistry,
  ...uiImportGeoSettingsRegistry,
  ...uiBipartiteSettingsRegistry,
  ...uiMonacoSettingsRegistry,
  ...uiImportPdfSettingsRegistry,
  ...uiImportYoutubeSettingsRegistry,
  ...uiImportWebpageSettingsRegistry,
  ...uiGraphAndOrchestratorSettingsRegistry,
]
