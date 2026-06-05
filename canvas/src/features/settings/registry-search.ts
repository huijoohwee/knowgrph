import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import {
  EXA_MCP_ACTIVE_TOOLS_JSON,
  EXA_MCP_CONNECTION_MODES,
  EXA_MCP_DEFAULT_CONNECTION_MODE,
  EXA_MCP_DEFAULT_ENABLED_TOOLS_JSON,
  EXA_MCP_DEFAULT_FETCH_CONTENT_LIMIT,
  EXA_MCP_DEFAULT_MAX_RESULTS,
  EXA_MCP_DEFAULT_REQUIRE_FETCH_REVIEW,
  EXA_MCP_DEFAULT_SERVER_KEY,
  EXA_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
  EXA_MCP_DEFAULT_TOOL_PROFILE,
  EXA_MCP_REMOTE_URL,
  EXA_MCP_TOOL_PROFILES,
} from 'grph-shared/search/exaMcpSsot'
import { localBooleanSetting, localJsonSetting, localNumberSetting, localStringSetting } from './registry-local-settings'

export const searchSettingsRegistry: SettingMeta[] = [
  localStringSetting({
    key: 'search.exa.mcp.serverKey',
    storageKey: LS_KEYS.searchExaMcpServerKey,
    defaultValue: EXA_MCP_DEFAULT_SERVER_KEY,
    docKey: 'search.exa.mcp.serverKey',
  }),
  localStringSetting({
    key: 'search.exa.mcp.remoteUrl',
    storageKey: LS_KEYS.searchExaMcpRemoteUrl,
    defaultValue: EXA_MCP_REMOTE_URL,
    docKey: 'search.exa.mcp.remoteUrl',
  }),
  localStringSetting({
    key: 'search.exa.mcp.toolProfile',
    storageKey: LS_KEYS.searchExaMcpToolProfile,
    defaultValue: EXA_MCP_DEFAULT_TOOL_PROFILE,
    options: [...EXA_MCP_TOOL_PROFILES],
    docKey: 'search.exa.mcp.toolProfile',
  }),
  localJsonSetting({
    key: 'search.exa.mcp.enabledTools',
    storageKey: LS_KEYS.searchExaMcpEnabledToolsJson,
    defaultValue: EXA_MCP_DEFAULT_ENABLED_TOOLS_JSON,
    docKey: 'search.exa.mcp.enabledTools',
  }),
  localStringSetting({
    key: 'search.exa.mcp.connectionMode',
    storageKey: LS_KEYS.searchExaMcpConnectionMode,
    defaultValue: EXA_MCP_DEFAULT_CONNECTION_MODE,
    options: [...EXA_MCP_CONNECTION_MODES],
    docKey: 'search.exa.mcp.connectionMode',
  }),
  localNumberSetting({
    key: 'search.exa.mcp.startupTimeoutMs',
    storageKey: LS_KEYS.searchExaMcpStartupTimeoutMs,
    defaultValue: EXA_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
    min: 1000,
    max: 300000,
    docKey: 'search.exa.mcp.startupTimeoutMs',
  }),
  localNumberSetting({
    key: 'search.exa.mcp.maxResults',
    storageKey: LS_KEYS.searchExaMcpMaxResults,
    defaultValue: EXA_MCP_DEFAULT_MAX_RESULTS,
    min: 1,
    max: 100,
    docKey: 'search.exa.mcp.maxResults',
  }),
  localNumberSetting({
    key: 'search.exa.mcp.fetchContentLimit',
    storageKey: LS_KEYS.searchExaMcpFetchContentLimit,
    defaultValue: EXA_MCP_DEFAULT_FETCH_CONTENT_LIMIT,
    min: 1000,
    max: 100000,
    docKey: 'search.exa.mcp.fetchContentLimit',
  }),
  localBooleanSetting({
    key: 'search.exa.mcp.requireFetchReview',
    storageKey: LS_KEYS.searchExaMcpRequireFetchReview,
    defaultValue: EXA_MCP_DEFAULT_REQUIRE_FETCH_REVIEW,
    docKey: 'search.exa.mcp.requireFetchReview',
  }),
]

export const EXA_MCP_ENABLED_TOOLS_ADVANCED_PROFILE_JSON = EXA_MCP_ACTIVE_TOOLS_JSON
