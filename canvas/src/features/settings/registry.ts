import type { FlowDetails, SettingMeta } from './types'
import { uiSettingsRegistry } from './registry-ui'
import { threeSettingsRegistry } from './registry-three'
import { presetAndEnvSettingsRegistry } from './registry-presets'
import { paymentsSettingsRegistry } from './registry-payments'
import { searchSettingsRegistry } from './registry-search'
import { openAiMcpSettingsRegistry } from './registry-openai-mcp'
import { feishuBaseMcpSettingsRegistry } from './registry-feishu-base-mcp'
import { operatorDeployMcpSettingsRegistry } from './registry-operator-deploy'

export const settingsRegistry: SettingMeta[] = [
  ...uiSettingsRegistry,
  ...threeSettingsRegistry,
  ...presetAndEnvSettingsRegistry,
  ...searchSettingsRegistry,
  ...feishuBaseMcpSettingsRegistry,
  ...openAiMcpSettingsRegistry,
  ...operatorDeployMcpSettingsRegistry,
  ...paymentsSettingsRegistry,
]

let flowDetailsPromise: Promise<Record<string, FlowDetails>> | null = null

export async function loadFlowDetails(): Promise<Record<string, FlowDetails>> {
  flowDetailsPromise ??= import('./settings-flow.schema.json').then(module => {
    const value: unknown = module.default
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, FlowDetails>)
      : {}
  })
  return flowDetailsPromise
}
