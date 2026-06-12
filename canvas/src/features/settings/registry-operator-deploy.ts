import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import {
  OPERATOR_DEPLOY_DEFAULT_CLOUD_DEPLOY_APPROVED,
  OPERATOR_DEPLOY_DEFAULT_FRONTEND_URL,
  OPERATOR_DEPLOY_DEFAULT_LIVE_CLIENTS_ENABLED,
  OPERATOR_DEPLOY_DEFAULT_MCP_ENDPOINT,
  OPERATOR_DEPLOY_DEFAULT_MODE,
  OPERATOR_DEPLOY_MODES,
  OPERATOR_DEPLOY_SETTING_KEYS,
} from './operatorDeploySsot'
import { localBooleanSetting, localStringSetting } from './registry-local-settings'

// Operator Deploy MCP settings — editable in MainPanel Integrations / MCP /
// Settings. These hold Cloudflare endpoints and toggles only (no model keys,
// no raw secret values). The deploy runbook reads these instead of requiring
// env-var-only configuration.
export const operatorDeployMcpSettingsRegistry: SettingMeta[] = [
  localStringSetting({
    key: OPERATOR_DEPLOY_SETTING_KEYS.mcpEndpoint,
    storageKey: LS_KEYS.operatorDeployMcpEndpoint,
    defaultValue: OPERATOR_DEPLOY_DEFAULT_MCP_ENDPOINT,
    docKey: OPERATOR_DEPLOY_SETTING_KEYS.mcpEndpoint,
  }),
  localStringSetting({
    key: OPERATOR_DEPLOY_SETTING_KEYS.frontendUrl,
    storageKey: LS_KEYS.operatorDeployFrontendUrl,
    defaultValue: OPERATOR_DEPLOY_DEFAULT_FRONTEND_URL,
    docKey: OPERATOR_DEPLOY_SETTING_KEYS.frontendUrl,
  }),
  localStringSetting({
    key: OPERATOR_DEPLOY_SETTING_KEYS.mode,
    storageKey: LS_KEYS.operatorDeployMode,
    defaultValue: OPERATOR_DEPLOY_DEFAULT_MODE,
    options: [...OPERATOR_DEPLOY_MODES],
    docKey: OPERATOR_DEPLOY_SETTING_KEYS.mode,
  }),
  localBooleanSetting({
    key: OPERATOR_DEPLOY_SETTING_KEYS.liveClientsEnabled,
    storageKey: LS_KEYS.operatorDeployLiveClientsEnabled,
    defaultValue: OPERATOR_DEPLOY_DEFAULT_LIVE_CLIENTS_ENABLED,
    docKey: OPERATOR_DEPLOY_SETTING_KEYS.liveClientsEnabled,
  }),
  localBooleanSetting({
    key: OPERATOR_DEPLOY_SETTING_KEYS.cloudDeployApproved,
    storageKey: LS_KEYS.operatorDeployCloudDeployApproved,
    defaultValue: OPERATOR_DEPLOY_DEFAULT_CLOUD_DEPLOY_APPROVED,
    docKey: OPERATOR_DEPLOY_SETTING_KEYS.cloudDeployApproved,
  }),
]
