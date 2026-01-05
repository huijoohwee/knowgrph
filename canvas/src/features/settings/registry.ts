import flowDetailsStatic from './settings-flow.schema.json'
import type { FlowDetails, SettingMeta } from './types'
import { uiSettingsRegistry } from './registry-ui'
import { threeSettingsRegistry } from './registry-three'
import { presetAndEnvSettingsRegistry } from './registry-presets'

export const settingsRegistry: SettingMeta[] = [
  ...uiSettingsRegistry,
  ...threeSettingsRegistry,
  ...presetAndEnvSettingsRegistry,
]

const flowDetailsObject: Record<string, FlowDetails> =
  flowDetailsStatic && typeof flowDetailsStatic === 'object' && !Array.isArray(flowDetailsStatic)
    ? (flowDetailsStatic as Record<string, FlowDetails>)
    : {}

export async function loadFlowDetails(): Promise<Record<string, FlowDetails>> {
  return flowDetailsObject
}
