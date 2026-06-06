import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import {
  FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
  FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
  FEISHU_BASE_MCP_DEFAULT_PHASE,
  FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
  FEISHU_BASE_MCP_DOCS_URL,
  FEISHU_BASE_MCP_PHASE_2_STATUS,
  FEISHU_BASE_MCP_PHASE_3_STATUS,
} from 'grph-shared/search/feishuBaseMcpSsot'
import { localStringSetting } from './registry-local-settings'

export const feishuBaseMcpSettingsRegistry: SettingMeta[] = [
  localStringSetting({
    key: 'search.feishuBase.mcp.serverKey',
    storageKey: LS_KEYS.searchFeishuBaseMcpServerKey,
    defaultValue: FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
    docKey: 'search.feishuBase.mcp.serverKey',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.connectionMode',
    storageKey: LS_KEYS.searchFeishuBaseMcpConnectionMode,
    defaultValue: FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
    docKey: 'search.feishuBase.mcp.connectionMode',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.authBoundary',
    storageKey: LS_KEYS.searchFeishuBaseMcpAuthBoundary,
    defaultValue: FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
    docKey: 'search.feishuBase.mcp.authBoundary',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.docsUrl',
    storageKey: LS_KEYS.searchFeishuBaseMcpDocsUrl,
    defaultValue: FEISHU_BASE_MCP_DOCS_URL,
    docKey: 'search.feishuBase.mcp.docsUrl',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.phase',
    storageKey: LS_KEYS.searchFeishuBaseMcpPhase,
    defaultValue: FEISHU_BASE_MCP_DEFAULT_PHASE,
    docKey: 'search.feishuBase.mcp.phase',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.phase2Status',
    storageKey: LS_KEYS.searchFeishuBaseMcpPhase2Status,
    defaultValue: FEISHU_BASE_MCP_PHASE_2_STATUS,
    docKey: 'search.feishuBase.mcp.phase2Status',
  }),
  localStringSetting({
    key: 'search.feishuBase.mcp.phase3Status',
    storageKey: LS_KEYS.searchFeishuBaseMcpPhase3Status,
    defaultValue: FEISHU_BASE_MCP_PHASE_3_STATUS,
    docKey: 'search.feishuBase.mcp.phase3Status',
  }),
]
