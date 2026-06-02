import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'
import {
  STRIPE_MCP_DEFAULT_CONNECTION_MODE,
  STRIPE_MCP_DEFAULT_LOCAL_ARGS,
  STRIPE_MCP_DEFAULT_LOCAL_ARGS_JSON,
  STRIPE_MCP_DEFAULT_LOCAL_COMMAND,
  STRIPE_MCP_DEFAULT_LOCAL_ENV_TEMPLATE,
  STRIPE_MCP_DEFAULT_REQUIRE_CONFIRMATION,
  STRIPE_MCP_DEFAULT_SERVER_KEY,
  STRIPE_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
  STRIPE_MCP_DOC_AREA,
  STRIPE_MCP_DOCS_URL,
  STRIPE_MCP_PAYMENT_TOOL_NAMES,
  STRIPE_MCP_REGISTRY_URL,
  STRIPE_MCP_REMOTE_URL,
} from 'grph-shared/payments/stripeMcpSsot'

export { STRIPE_MCP_DOC_AREA }

type StripeMcpDocRow = {
  key: string
  typeLabel: string
  valueKey?: string
  value?: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const STRIPE_MCP_TOOLTIP_ROLE = 'Stripe MCP'
export const STRIPE_MCP_REMOTE_CONFIG_KEY = 'stripeMcp.remote_config'
export const STRIPE_MCP_LOCAL_CONFIG_KEY = 'stripeMcp.local_config'

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

export function buildStripeRemoteMcpConfigJson(values: Record<string, unknown>): string {
  const serverKey = readStringValue(values, 'payments.stripe.mcp.serverKey', STRIPE_MCP_DEFAULT_SERVER_KEY)
  const url = readStringValue(values, 'payments.stripe.mcp.remoteUrl', STRIPE_MCP_REMOTE_URL)
  return JSON.stringify({
    mcpServers: {
      [serverKey]: {
        url,
      },
    },
  }, null, 2)
}

export function buildStripeLocalMcpConfigJson(values: Record<string, unknown>): string {
  const serverKey = readStringValue(values, 'payments.stripe.mcp.serverKey', STRIPE_MCP_DEFAULT_SERVER_KEY)
  const command = readStringValue(values, 'payments.stripe.mcp.localCommand', STRIPE_MCP_DEFAULT_LOCAL_COMMAND)
  const args = readJsonArrayValue(values, 'payments.stripe.mcp.localArgs', STRIPE_MCP_DEFAULT_LOCAL_ARGS)
  return JSON.stringify({
    mcpServers: {
      [serverKey]: {
        command,
        args,
        env: STRIPE_MCP_DEFAULT_LOCAL_ENV_TEMPLATE,
      },
    },
  }, null, 2)
}

const STRIPE_MCP_DOC_ROWS: ReadonlyArray<StripeMcpDocRow> = [
  {
    key: 'server_key',
    typeLabel: 'string',
    valueKey: 'payments.stripe.mcp.serverKey',
    responsibility: 'MCP server key inside the mcpServers object for Stripe.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_SERVER_KEY,
    searchHints: ['mcpServers', STRIPE_MCP_DEFAULT_SERVER_KEY],
  },
  {
    key: 'remote.url',
    typeLabel: 'url',
    valueKey: 'payments.stripe.mcp.remoteUrl',
    responsibility: 'Remote Stripe MCP server URL for OAuth-capable MCP clients.',
    tooltipDefaultValue: STRIPE_MCP_REMOTE_URL,
    searchHints: ['remote mcp', STRIPE_MCP_REMOTE_URL, 'oauth'],
  },
  {
    key: 'remote.connection',
    typeLabel: 'enum',
    valueKey: 'payments.stripe.mcp.connectionMode',
    responsibility: 'Connection mechanism label for the remote Stripe MCP server.',
    notes: 'Use OAuth when the MCP host supports it; bearer mode must use a restricted API key from a secret vault or server environment.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_CONNECTION_MODE,
    searchHints: ['oauth', 'bearer', 'restricted api key'],
  },
  {
    key: 'local.command',
    typeLabel: 'string',
    valueKey: 'payments.stripe.mcp.localCommand',
    responsibility: 'Launcher command for the local Stripe MCP server.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_LOCAL_COMMAND,
    searchHints: ['npx', '@stripe/mcp'],
  },
  {
    key: 'local.args',
    typeLabel: 'string[]',
    valueKey: 'payments.stripe.mcp.localArgs',
    responsibility: 'CLI args array for the local Stripe MCP launcher.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_LOCAL_ARGS_JSON,
    searchHints: ['@stripe/mcp@latest', 'local mcp server'],
  },
  {
    key: 'startup_timeout_ms',
    typeLabel: 'integer',
    valueKey: 'payments.stripe.mcp.startupTimeoutMs',
    responsibility: 'MCP process startup timeout in milliseconds.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
    searchHints: ['startup timeout', 'startup_timeout_ms'],
  },
  {
    key: 'tool.confirmation_required',
    typeLabel: 'boolean',
    valueKey: 'payments.stripe.mcp.requireConfirmation',
    responsibility: 'Require human confirmation before payment-mutating Stripe MCP tool calls.',
    tooltipDefaultValue: STRIPE_MCP_DEFAULT_REQUIRE_CONFIRMATION,
    searchHints: ['human confirmation', 'payment tools', 'prompt injection'],
  },
  {
    key: 'payment_tools',
    typeLabel: 'tool list',
    value: STRIPE_MCP_PAYMENT_TOOL_NAMES.join(' | '),
    responsibility: 'Stripe MCP payment-capable tools that can create checkout, catalog, invoice, customer, payment, and refund resources.',
    notes: 'Tool availability is bounded by the authorized OAuth session or restricted API key permissions.',
    searchHints: ['create_payment_link', 'create_price', 'create_product', 'create_refund', 'list_payment_intents'],
  },
  {
    key: 'remote_config',
    typeLabel: 'object',
    value: buildStripeRemoteMcpConfigJson({}),
    responsibility: 'Agent-ready mcpServers JSON for the remote Stripe MCP server.',
    notes: 'The remote server should authenticate through OAuth when the host supports it.',
    searchHints: ['remote config', 'mcpServers', STRIPE_MCP_REMOTE_URL, STRIPE_MCP_DOCS_URL],
  },
  {
    key: 'local_config',
    typeLabel: 'object',
    value: buildStripeLocalMcpConfigJson({}),
    responsibility: 'Agent-ready mcpServers JSON for a local Stripe MCP server.',
    notes: 'The STRIPE_SECRET_KEY value is a server-side environment placeholder. Do not paste secret or restricted keys into browser storage.',
    searchHints: ['local config', 'mcpServers', '@stripe/mcp@latest', 'STRIPE_SECRET_KEY'],
  },
  {
    key: 'restricted_key_scope',
    typeLabel: 'security note',
    value: 'least_privilege_restricted_key',
    responsibility: 'Permission boundary for bearer-token or local Stripe MCP usage.',
    notes: 'OAuth is preferred for user authorization; restricted keys are for agentic/server-side flows when OAuth is unavailable.',
    searchHints: ['restricted api key', 'least privilege', 'payment link', 'price', 'product'],
  },
  {
    key: 'accept_payment_ready',
    typeLabel: 'readiness',
    value: 'ready',
    responsibility: 'Payment readiness signal for agent workflows that need Stripe without browser-stored secrets.',
    notes: 'Crawler Pay Per Crawl remains Cloudflare-owned; app and customer checkout readiness stays with Stripe MCP plus MainPanel Commerce.',
    searchHints: ['accept payment', 'payment ready', 'MainPanel Commerce', 'checkout handoff', 'crawler payment boundary'],
  },
  {
    key: 'registry.url',
    typeLabel: 'url',
    value: STRIPE_MCP_REGISTRY_URL,
    responsibility: 'GitHub MCP registry entry for the Stripe MCP server.',
    searchHints: ['mcp/com.stripe', 'stripe mcp registry'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export function getStripeMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-stripe', rowKey)
}

export const STRIPE_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  STRIPE_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: STRIPE_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['Stripe MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `stripeMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: row.valueKey ? 'localStorage' : 'backendEnv',
        read: () => row.value ?? 'MCP setting',
      },
      value: row.value ?? 'MCP setting',
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: STRIPE_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['stripe mcp configuration', 'payment-ready mcp', row.key, ...(row.searchHints || [])],
      details,
    }
  })
