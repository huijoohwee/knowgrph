import type { SettingMeta } from './types'
import { uiGraphAndOrchestratorSettingsRegistry } from './registry-ui.graph-and-orchestrator'
import { uiUiSettingsRegistry } from './registry-ui.ui'
import { uiCanvasGridSettingsRegistry } from './registry-ui.canvas-grid'
import { uiImportPdfSettingsRegistry } from './registry-ui.import-pdf'
import { uiMarkdownSettingsRegistry } from './registry-ui.markdown'
import { uiImportYoutubeSettingsRegistry } from './registry-ui.import-youtube'
import { uiImportWebpageSettingsRegistry } from './registry-ui.import-webpage'
import { uiImportGeoSettingsRegistry } from './registry-ui.import-geo'
import { uiFlowchartSettingsRegistry } from './registry-ui.flowchart'
import { uiMonacoSettingsRegistry } from './registry-ui.monaco'
import { uiGrabMapsSettingsRegistry } from './registry-ui.grabmaps'
import { uiWorkspaceSettingsRegistry } from './registry-ui.workspace'

export const uiSettingsRegistry: SettingMeta[] = [
  ...uiUiSettingsRegistry,
  ...uiCanvasGridSettingsRegistry,
  ...uiMarkdownSettingsRegistry,
  ...uiImportGeoSettingsRegistry,
  ...uiGrabMapsSettingsRegistry,
  ...uiFlowchartSettingsRegistry,
  ...uiMonacoSettingsRegistry,
  ...uiWorkspaceSettingsRegistry,
  ...uiImportPdfSettingsRegistry,
  ...uiImportYoutubeSettingsRegistry,
  ...uiImportWebpageSettingsRegistry,
  ...uiGraphAndOrchestratorSettingsRegistry,
]
