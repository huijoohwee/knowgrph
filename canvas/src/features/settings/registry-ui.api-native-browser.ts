import { LS_KEYS } from '@/lib/config.ls.keys'
import {
  API_NATIVE_BROWSER_DEFAULT_CONFIRM_COOKIE_IMPORT,
  API_NATIVE_BROWSER_DEFAULT_CONFIRM_UNSAFE,
  API_NATIVE_BROWSER_DEFAULT_CONFIRM_THIRD_PARTY_TERMS,
  API_NATIVE_BROWSER_DEFAULT_DRY_RUN,
  API_NATIVE_BROWSER_DEFAULT_INTENT,
  API_NATIVE_BROWSER_DEFAULT_MCP_ARGS_JSON,
  API_NATIVE_BROWSER_DEFAULT_MCP_COMMAND,
  API_NATIVE_BROWSER_DEFAULT_MCP_ENV_JSON,
  API_NATIVE_BROWSER_DEFAULT_MCP_SERVER_KEY,
  API_NATIVE_BROWSER_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
  API_NATIVE_BROWSER_DEFAULT_RUNTIME_URL,
  API_NATIVE_BROWSER_DEFAULT_TARGET_URL,
} from 'grph-shared/browser/apiNativeBrowserMcpSsot'
import type { SettingMeta } from './types'
import { localBooleanSetting, localJsonSetting, localNumberSetting, localStringSetting } from './registry-local-settings'

export const uiApiNativeBrowserMcpSettingsRegistry: SettingMeta[] = [
  localStringSetting({
    key: 'browser.apiNative.mcp.serverKey',
    storageKey: LS_KEYS.apiNativeBrowserMcpServerKey,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_MCP_SERVER_KEY,
    docKey: 'browser.apiNative.mcp.serverKey',
  }),
  localStringSetting({
    key: 'browser.apiNative.mcp.command',
    storageKey: LS_KEYS.apiNativeBrowserMcpCommand,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_MCP_COMMAND,
    docKey: 'browser.apiNative.mcp.command',
  }),
  localJsonSetting({
    key: 'browser.apiNative.mcp.args',
    storageKey: LS_KEYS.apiNativeBrowserMcpArgsJson,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_MCP_ARGS_JSON,
    docKey: 'browser.apiNative.mcp.args',
  }),
  localJsonSetting({
    key: 'browser.apiNative.mcp.env',
    storageKey: LS_KEYS.apiNativeBrowserMcpEnvJson,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_MCP_ENV_JSON,
    docKey: 'browser.apiNative.mcp.env',
  }),
  localNumberSetting({
    key: 'browser.apiNative.mcp.startupTimeoutMs',
    storageKey: LS_KEYS.apiNativeBrowserMcpStartupTimeoutMs,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
    min: 1000,
    max: 300000,
    docKey: 'browser.apiNative.mcp.startupTimeoutMs',
  }),
  localStringSetting({
    key: 'browser.apiNative.mcp.runtimeUrl',
    storageKey: LS_KEYS.apiNativeBrowserMcpRuntimeUrl,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_RUNTIME_URL,
    docKey: 'browser.apiNative.mcp.runtimeUrl',
  }),
  localStringSetting({
    key: 'browser.apiNative.mcp.defaultIntent',
    storageKey: LS_KEYS.apiNativeBrowserMcpDefaultIntent,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_INTENT,
    docKey: 'browser.apiNative.mcp.defaultIntent',
  }),
  localStringSetting({
    key: 'browser.apiNative.mcp.targetUrl',
    storageKey: LS_KEYS.apiNativeBrowserMcpTargetUrl,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_TARGET_URL,
    docKey: 'browser.apiNative.mcp.targetUrl',
  }),
  localBooleanSetting({
    key: 'browser.apiNative.mcp.dryRun',
    storageKey: LS_KEYS.apiNativeBrowserMcpDryRun,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_DRY_RUN,
    docKey: 'browser.apiNative.mcp.dryRun',
  }),
  localBooleanSetting({
    key: 'browser.apiNative.mcp.confirmUnsafe',
    storageKey: LS_KEYS.apiNativeBrowserMcpConfirmUnsafe,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_CONFIRM_UNSAFE,
    docKey: 'browser.apiNative.mcp.confirmUnsafe',
  }),
  localBooleanSetting({
    key: 'browser.apiNative.mcp.confirmThirdPartyTerms',
    storageKey: LS_KEYS.apiNativeBrowserMcpConfirmThirdPartyTerms,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_CONFIRM_THIRD_PARTY_TERMS,
    docKey: 'browser.apiNative.mcp.confirmThirdPartyTerms',
  }),
  localBooleanSetting({
    key: 'browser.apiNative.mcp.confirmCookieImport',
    storageKey: LS_KEYS.apiNativeBrowserMcpConfirmCookieImport,
    defaultValue: API_NATIVE_BROWSER_DEFAULT_CONFIRM_COOKIE_IMPORT,
    docKey: 'browser.apiNative.mcp.confirmCookieImport',
  }),
]
