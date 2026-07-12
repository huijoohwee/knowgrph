import type { SettingMeta } from './types'
import { uiGraphAndOrchestratorSettingsRegistryPart1 } from '@/lib/settings/registry-ui.graph-and-orchestrator.part1'
import { uiGraphAndOrchestratorSettingsRegistryPart2 } from './registry-ui.graph-and-orchestrator.part2'
import { uiGraphAndOrchestratorSettingsRegistryPart3 } from '@/lib/settings/registry-ui.graph-and-orchestrator.part3'

export const uiGraphAndOrchestratorSettingsRegistry: SettingMeta[] = [
  ...uiGraphAndOrchestratorSettingsRegistryPart1,
  ...uiGraphAndOrchestratorSettingsRegistryPart2,
  ...uiGraphAndOrchestratorSettingsRegistryPart3,
]
