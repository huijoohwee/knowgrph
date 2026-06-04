import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import {
  OPENAI_MCP_AUTH_MODES,
  OPENAI_MCP_DEFAULT_ALLOWED_TOOLS_JSON,
  OPENAI_MCP_DEFAULT_API_KEY_ENV,
  OPENAI_MCP_DEFAULT_AUTH_MODE,
  OPENAI_MCP_DEFAULT_REQUIRE_APPROVAL,
  OPENAI_MCP_DEFAULT_REQUIRE_TOOL_REVIEW,
  OPENAI_MCP_DEFAULT_RESPONSES_MODEL,
  OPENAI_MCP_DEFAULT_SERVER_LABEL,
  OPENAI_MCP_DEFAULT_SERVER_PORT,
  OPENAI_MCP_DEFAULT_SERVER_URL,
  OPENAI_MCP_DEFAULT_TRANSPORT,
  OPENAI_MCP_DEFAULT_VECTOR_STORE_ENV,
} from 'grph-shared/openai/openaiMcpSsot'
import { localBooleanSetting, localJsonSetting, localNumberSetting, localStringSetting } from './registry-local-settings'

export const openAiMcpSettingsRegistry: SettingMeta[] = [
  localStringSetting({
    key: 'openai.mcp.serverLabel',
    storageKey: LS_KEYS.openAiMcpServerLabel,
    defaultValue: OPENAI_MCP_DEFAULT_SERVER_LABEL,
    docKey: 'openai.mcp.serverLabel',
  }),
  localStringSetting({
    key: 'openai.mcp.serverUrl',
    storageKey: LS_KEYS.openAiMcpServerUrl,
    defaultValue: OPENAI_MCP_DEFAULT_SERVER_URL,
    docKey: 'openai.mcp.serverUrl',
  }),
  localStringSetting({
    key: 'openai.mcp.transport',
    storageKey: LS_KEYS.openAiMcpTransport,
    defaultValue: OPENAI_MCP_DEFAULT_TRANSPORT,
    docKey: 'openai.mcp.transport',
  }),
  localJsonSetting({
    key: 'openai.mcp.allowedTools',
    storageKey: LS_KEYS.openAiMcpAllowedToolsJson,
    defaultValue: OPENAI_MCP_DEFAULT_ALLOWED_TOOLS_JSON,
    docKey: 'openai.mcp.allowedTools',
  }),
  localStringSetting({
    key: 'openai.mcp.requireApproval',
    storageKey: LS_KEYS.openAiMcpRequireApproval,
    defaultValue: OPENAI_MCP_DEFAULT_REQUIRE_APPROVAL,
    docKey: 'openai.mcp.requireApproval',
  }),
  localStringSetting({
    key: 'openai.mcp.responsesModel',
    storageKey: LS_KEYS.openAiMcpResponsesModel,
    defaultValue: OPENAI_MCP_DEFAULT_RESPONSES_MODEL,
    docKey: 'openai.mcp.responsesModel',
  }),
  localStringSetting({
    key: 'openai.mcp.authMode',
    storageKey: LS_KEYS.openAiMcpAuthMode,
    defaultValue: OPENAI_MCP_DEFAULT_AUTH_MODE,
    options: [...OPENAI_MCP_AUTH_MODES],
    docKey: 'openai.mcp.authMode',
  }),
  localStringSetting({
    key: 'openai.mcp.apiKeyEnv',
    storageKey: LS_KEYS.openAiMcpApiKeyEnv,
    defaultValue: OPENAI_MCP_DEFAULT_API_KEY_ENV,
    docKey: 'openai.mcp.apiKeyEnv',
  }),
  localStringSetting({
    key: 'openai.mcp.vectorStoreEnv',
    storageKey: LS_KEYS.openAiMcpVectorStoreEnv,
    defaultValue: OPENAI_MCP_DEFAULT_VECTOR_STORE_ENV,
    docKey: 'openai.mcp.vectorStoreEnv',
  }),
  localNumberSetting({
    key: 'openai.mcp.serverPort',
    storageKey: LS_KEYS.openAiMcpServerPort,
    defaultValue: OPENAI_MCP_DEFAULT_SERVER_PORT,
    min: 1,
    max: 65535,
    docKey: 'openai.mcp.serverPort',
  }),
  localBooleanSetting({
    key: 'openai.mcp.requireToolReview',
    storageKey: LS_KEYS.openAiMcpRequireToolReview,
    defaultValue: OPENAI_MCP_DEFAULT_REQUIRE_TOOL_REVIEW,
    docKey: 'openai.mcp.requireToolReview',
  }),
]
