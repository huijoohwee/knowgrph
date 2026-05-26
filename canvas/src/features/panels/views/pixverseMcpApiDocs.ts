import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const PIXVERSE_MCP_DOC_AREA = 'PixVerse MCP'
export const PIXVERSE_MCP_DOCS_URL = 'https://github.com/PixVerseAI/PixVerse-MCP'
export const PIXVERSE_MCP_LOCAL_CONFIG_KEY = 'pixverseMcp.local_config'

const PIXVERSE_MCP_TOOLTIP_ROLE = 'PixVerse MCP'
const PIXVERSE_MCP_DEFAULT_SERVER_KEY = 'pixverse'
const PIXVERSE_MCP_DEFAULT_COMMAND = 'uvx'
const PIXVERSE_MCP_DEFAULT_ARGS = ['pixverse-mcp'] as const
const PIXVERSE_MCP_DEFAULT_ARGS_JSON = JSON.stringify(PIXVERSE_MCP_DEFAULT_ARGS)
const PIXVERSE_MCP_DEFAULT_ENV = {
  PIXVERSE_API_KEY: '<set-in-local-shell-or-secret-store>',
} as const
const PIXVERSE_MCP_DEFAULT_ENV_JSON = JSON.stringify(PIXVERSE_MCP_DEFAULT_ENV, null, 2)
const PIXVERSE_MCP_DEFAULT_STARTUP_TIMEOUT_MS = 120000

type PixVerseMcpDocRow = {
  key: string
  typeLabel: string
  valueKey?: string
  value?: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const readStringValue = (values: Record<string, unknown>, key: string, fallback: string): string => {
  const value = values[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

const readJsonArrayValue = (values: Record<string, unknown>, key: string, fallback: readonly string[]): string[] => {
  const value = values[key]
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return [...value]
  if (typeof value !== 'string') return [...fallback]
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [...fallback]
  } catch {
    return [...fallback]
  }
}

const readJsonObjectValue = (
  values: Record<string, unknown>,
  key: string,
  fallback: Readonly<Record<string, unknown>>,
): Record<string, string> => {
  const value = values[key]
  const parsed = (() => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
    if (typeof value !== 'string') return fallback
    try {
      const next = JSON.parse(value) as unknown
      return next && typeof next === 'object' && !Array.isArray(next) ? next : fallback
    } catch {
      return fallback
    }
  })()
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([, item]) => typeof item === 'string')
      .map(([itemKey, itemValue]) => [itemKey, itemValue as string]),
  )
}

export function buildPixVerseLocalMcpConfigJson(values: Record<string, unknown>): string {
  const serverKey = readStringValue(values, 'pixverse.mcp.serverKey', PIXVERSE_MCP_DEFAULT_SERVER_KEY)
  const command = readStringValue(values, 'pixverse.mcp.command', PIXVERSE_MCP_DEFAULT_COMMAND)
  const args = readJsonArrayValue(values, 'pixverse.mcp.args', PIXVERSE_MCP_DEFAULT_ARGS)
  const env = readJsonObjectValue(values, 'pixverse.mcp.env', PIXVERSE_MCP_DEFAULT_ENV)
  return JSON.stringify({
    mcpServers: {
      [serverKey]: {
        command,
        args,
        env,
      },
    },
  }, null, 2)
}

const PIXVERSE_MCP_DOC_ROWS: ReadonlyArray<PixVerseMcpDocRow> = [
  {
    key: 'server_key',
    typeLabel: 'string',
    valueKey: 'pixverse.mcp.serverKey',
    responsibility: 'MCP server key inside the mcpServers object for PixVerse.',
    tooltipDefaultValue: PIXVERSE_MCP_DEFAULT_SERVER_KEY,
    searchHints: ['pixverse', 'mcpServers', 'server key'],
  },
  {
    key: 'local.command',
    typeLabel: 'string',
    valueKey: 'pixverse.mcp.command',
    responsibility: 'Launcher command for a local PixVerse MCP server.',
    tooltipDefaultValue: PIXVERSE_MCP_DEFAULT_COMMAND,
    searchHints: ['uvx', 'pixverse-mcp', 'local command'],
  },
  {
    key: 'local.args',
    typeLabel: 'string[]',
    valueKey: 'pixverse.mcp.args',
    responsibility: 'CLI args array for the local PixVerse MCP launcher.',
    tooltipDefaultValue: PIXVERSE_MCP_DEFAULT_ARGS_JSON,
    searchHints: ['pixverse-mcp', 'args', 'local mcp'],
  },
  {
    key: 'local.env',
    typeLabel: 'object',
    valueKey: 'pixverse.mcp.env',
    responsibility: 'Environment object passed to the local PixVerse MCP launcher.',
    notes: 'Keep PIXVERSE_API_KEY in local shell or secret storage. Do not store it in browser state.',
    tooltipDefaultValue: PIXVERSE_MCP_DEFAULT_ENV_JSON,
    searchHints: ['PIXVERSE_API_KEY', 'env', 'secret'],
  },
  {
    key: 'startup_timeout_ms',
    typeLabel: 'integer',
    valueKey: 'pixverse.mcp.startupTimeoutMs',
    responsibility: 'PixVerse MCP process startup timeout in milliseconds.',
    tooltipDefaultValue: PIXVERSE_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
    searchHints: ['startup timeout', 'startup_timeout_ms'],
  },
  {
    key: 'local_config',
    typeLabel: 'object',
    value: buildPixVerseLocalMcpConfigJson({}),
    responsibility: 'Agent-ready mcpServers JSON for a local PixVerse MCP server.',
    notes: 'Knowgrph now supports `provider_mode="pixverse"` in the local harness through PixVerse MCP stdio, with bounded polling and mock fallback when local config or live generation is unavailable.',
    searchHints: ['local config', 'mcpServers', 'pixverse', 'uvx pixverse-mcp'],
  },
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: PIXVERSE_MCP_DOCS_URL,
    responsibility: 'Reference URL for the PixVerse MCP project.',
    searchHints: ['PixVerse MCP GitHub', 'docs'],
  },
  {
    key: 'readiness_scope',
    typeLabel: 'readiness',
    value: 'MainPanel MCP documents PixVerse local stdio setup. Downstream ownership stays MainPanel -> FloatingPanel Chat -> markdown YAML frontmatter -> shared canvas apply, and the local harness supports `provider_mode="pixverse"` with bounded polling plus mock fallback.',
    responsibility: 'States the current scope boundary for PixVerse in Knowgrph.',
    notes: 'Prevents false renderer ownership claims and forbids a second MCP-only markdown-to-canvas path.',
    searchHints: ['readiness', 'chat pipeline', 'provider_mode pixverse'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export function getPixVerseMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-pixverse', rowKey)
}

export const PIXVERSE_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  PIXVERSE_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: PIXVERSE_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['PixVerse MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `pixverseMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: row.valueKey ? 'localStorage' : 'backendEnv',
        read: () => row.value ?? 'PixVerse MCP setting',
      },
      value: row.value ?? 'PixVerse MCP setting',
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: PIXVERSE_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['pixverse mcp configuration', row.key, ...(row.searchHints || [])],
      details,
    }
  })
