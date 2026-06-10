import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const CLOUDFLARE_AI_GATEWAY_MCP_DOC_AREA = 'Cloudflare AI Gateway MCP Configuration'
export const CLOUDFLARE_AI_GATEWAY_MCP_DOCS_URL = 'https://developers.cloudflare.com/ai-gateway/'
export const CLOUDFLARE_AI_GATEWAY_PRODUCT_URL = 'https://www.cloudflare.com/products/ai-gateway/'
export const CLOUDFLARE_MCP_SERVER_GITHUB_URL = 'https://github.com/cloudflare/mcp-server-cloudflare'
export const CLOUDFLARE_AI_GATEWAY_MCP_GITHUB_URL =
  'https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/ai-gateway'
export const CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL = 'https://ai-gateway.mcp.cloudflare.com/mcp'
export const CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY = 'cloudflare-ai-gateway'
export const CLOUDFLARE_AI_GATEWAY_UNIVERSAL_ENDPOINT =
  'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}'
export const CLOUDFLARE_AI_GATEWAY_OPENAI_ENDPOINT =
  `${CLOUDFLARE_AI_GATEWAY_UNIVERSAL_ENDPOINT}/openai`
export const CLOUDFLARE_AI_GATEWAY_ACCOUNT_HEADER = 'cf-account-id'
export const CLOUDFLARE_AI_GATEWAY_MCP_TOOL_NAMES = [
  'list_gateways',
  'list_logs',
  'get_log_details',
  'get_log_request_body',
  'get_log_response_body',
] as const
export const CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_CONFIG_KEY =
  'cloudflareAiGatewayMcp.remote_config.generic'

type CloudflareAiGatewayMcpDocRow = {
  key: string
  typeLabel: string
  value: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const CLOUDFLARE_AI_GATEWAY_MCP_TOOLTIP_ROLE = 'Cloudflare AI Gateway MCP'

export function buildCloudflareAiGatewayMcpRemoteConfigJson(): string {
  return JSON.stringify({
    mcpServers: {
      [CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY]: {
        command: 'npx',
        args: ['mcp-remote', CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL],
      },
    },
  }, null, 2)
}

export function buildCloudflareAiGatewayMcpReadinessManifestJson(): string {
  return JSON.stringify({
    cloudflareAiGatewayMcp: {
      productUrl: CLOUDFLARE_AI_GATEWAY_PRODUCT_URL,
      docsUrl: CLOUDFLARE_AI_GATEWAY_MCP_DOCS_URL,
      mcpServer: {
        source: CLOUDFLARE_AI_GATEWAY_MCP_GITHUB_URL,
        remoteUrl: CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL,
        transport: 'streamable-http',
        deprecatedTransport: 'sse',
        accountHeader: CLOUDFLARE_AI_GATEWAY_ACCOUNT_HEADER,
        tools: CLOUDFLARE_AI_GATEWAY_MCP_TOOL_NAMES,
      },
      gateway: {
        universalEndpoint: CLOUDFLARE_AI_GATEWAY_UNIVERSAL_ENDPOINT,
        openAiEndpoint: CLOUDFLARE_AI_GATEWAY_OPENAI_ENDPOINT,
        capabilities: [
          'dynamic_routing',
          'caching',
          'observability',
          'rate_limiting',
          'fallbacks',
          'guardrails',
          'unified_billing',
        ],
      },
      boundaries: {
        devOnlyUntilOperatorDeploys: true,
        browserStoresCloudflareTokens: false,
        providerKeysRemainHostOwned: true,
        accountAndGatewayIdsRemainOperatorOwned: true,
      },
    },
  }, null, 2)
}

const CLOUDFLARE_AI_GATEWAY_MCP_DOC_ROWS: ReadonlyArray<CloudflareAiGatewayMcpDocRow> = [
  {
    key: 'server_key',
    typeLabel: 'string',
    value: CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY,
    responsibility: 'MCP server key for Cloudflare AI Gateway log and usage inspection.',
    searchHints: ['mcpServers', CLOUDFLARE_AI_GATEWAY_MCP_SERVER_KEY, 'AI Gateway MCP'],
  },
  {
    key: 'remote.url',
    typeLabel: 'url',
    value: CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL,
    responsibility: 'Remote Cloudflare AI Gateway MCP Streamable HTTP endpoint.',
    notes: 'Use this domain-specific server for curated AI Gateway tools; use the broader Code Mode server only when cross-product Cloudflare API coverage is needed.',
    searchHints: ['streamable-http', 'domain-specific server', CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL],
  },
  {
    key: 'transport.primary',
    typeLabel: 'transport',
    value: 'streamable-http /mcp',
    responsibility: 'Primary Cloudflare MCP transport for AI Gateway clients.',
    notes: 'Cloudflare marks the SSE transport as deprecated, so generated config stays on /mcp.',
    searchHints: ['streamable-http', '/mcp', 'sse deprecated'],
  },
  {
    key: 'account.header',
    typeLabel: 'header',
    value: CLOUDFLARE_AI_GATEWAY_ACCOUNT_HEADER,
    responsibility: 'Optional account selector for credentials that can access multiple Cloudflare accounts.',
    notes: 'The header name can be shown to operators; the account ID value stays MCP-host owned.',
    searchHints: [CLOUDFLARE_AI_GATEWAY_ACCOUNT_HEADER, 'account_id', 'multi-account credentials'],
  },
  {
    key: 'gateway.universal_endpoint',
    typeLabel: 'url pattern',
    value: CLOUDFLARE_AI_GATEWAY_UNIVERSAL_ENDPOINT,
    responsibility: 'Universal AI Gateway base URL pattern for routing requests to supported providers.',
    notes: 'The placeholders are operator-owned deployment values; MainPanel does not persist account or gateway IDs.',
    searchHints: ['universal endpoint', 'account_id', 'gateway_id'],
  },
  {
    key: 'gateway.openai_endpoint',
    typeLabel: 'url pattern',
    value: CLOUDFLARE_AI_GATEWAY_OPENAI_ENDPOINT,
    responsibility: 'OpenAI-compatible AI Gateway base URL pattern.',
    notes: 'This documents the route shape only; provider API keys remain server-side or MCP-host owned.',
    searchHints: ['OpenAI SDK', 'baseURL', CLOUDFLARE_AI_GATEWAY_OPENAI_ENDPOINT],
  },
  {
    key: 'capability.dynamic_routing',
    typeLabel: 'capability',
    value: 'dynamic routing with provider fallbacks',
    responsibility: 'Route model requests by latency, cost, availability, or fallback rules without redeploying app code.',
    searchHints: ['dynamic routing', 'fallback routing', 'availability'],
  },
  {
    key: 'capability.caching',
    typeLabel: 'capability',
    value: 'response caching',
    responsibility: 'Reduce redundant provider calls and latency for repeat AI requests.',
    searchHints: ['caching', 'cf-aig-cache-ttl', 'cost savings'],
  },
  {
    key: 'capability.observability',
    typeLabel: 'capability',
    value: 'logs, metrics, usage analytics, evaluations',
    responsibility: 'Inspect usage, prompts, responses, token counts, request status, cost, and duration through Cloudflare-owned logs.',
    searchHints: ['logs', 'analytics', 'token counts', 'prompt performance', 'evaluations'],
  },
  {
    key: 'capability.controls',
    typeLabel: 'capability',
    value: 'rate limiting and safety guardrails',
    responsibility: 'Keep AI cost, traffic behavior, sensitive-data exposure, and compliance controls at the Cloudflare gateway boundary.',
    searchHints: ['rate limiting', 'guardrails', 'sensitive information', 'compliance'],
  },
  {
    key: 'tool.list_gateways',
    typeLabel: 'tool',
    value: 'list_gateways',
    responsibility: 'List AI Gateways for the connected Cloudflare account.',
    searchHints: ['list_gateways', 'AI Gateway MCP tools'],
  },
  {
    key: 'tool.list_logs',
    typeLabel: 'tool',
    value: 'list_logs',
    responsibility: 'Retrieve gateway logs with filters such as date range, feedback score, success status, model, and provider.',
    searchHints: ['list_logs', 'date range', 'provider', 'model'],
  },
  {
    key: 'tool.get_log_details',
    typeLabel: 'tool',
    value: 'get_log_details',
    responsibility: 'Fetch detailed metadata for a specific AI Gateway log.',
    searchHints: ['get_log_details', 'log ID'],
  },
  {
    key: 'tool.get_log_request_body',
    typeLabel: 'tool',
    value: 'get_log_request_body',
    responsibility: 'Fetch the request body associated with a specific AI Gateway log.',
    notes: 'Operators should treat prompt/request bodies as sensitive account data.',
    searchHints: ['get_log_request_body', 'prompt', 'request body'],
  },
  {
    key: 'tool.get_log_response_body',
    typeLabel: 'tool',
    value: 'get_log_response_body',
    responsibility: 'Fetch the response body associated with a specific AI Gateway log.',
    notes: 'Operators should treat model responses as sensitive account data.',
    searchHints: ['get_log_response_body', 'response body'],
  },
  {
    key: 'remote_config.generic',
    typeLabel: 'object',
    value: buildCloudflareAiGatewayMcpRemoteConfigJson(),
    responsibility: 'Generic MCP client config using mcp-remote for the Cloudflare AI Gateway server.',
    notes: 'The generated JSON intentionally excludes Cloudflare API tokens, provider API keys, account IDs, and gateway IDs.',
    searchHints: ['mcp-remote', 'mcpServers', CLOUDFLARE_AI_GATEWAY_MCP_REMOTE_URL],
  },
  {
    key: 'readiness_manifest',
    typeLabel: 'object',
    value: buildCloudflareAiGatewayMcpReadinessManifestJson(),
    responsibility: 'Agent-readable AI Gateway MCP readiness contract for dev-only operator review.',
    searchHints: ['readiness manifest', 'AI Gateway', 'MCP', 'dev only'],
  },
  {
    key: 'docs.product_url',
    typeLabel: 'url',
    value: CLOUDFLARE_AI_GATEWAY_PRODUCT_URL,
    responsibility: 'Cloudflare AI Gateway product reference for capabilities and positioning.',
    searchHints: ['Cloudflare AI Gateway', CLOUDFLARE_AI_GATEWAY_PRODUCT_URL],
  },
  {
    key: 'docs.api_url',
    typeLabel: 'url',
    value: CLOUDFLARE_AI_GATEWAY_MCP_DOCS_URL,
    responsibility: 'Cloudflare developer docs for AI Gateway integration details.',
    searchHints: ['AI Gateway docs', CLOUDFLARE_AI_GATEWAY_MCP_DOCS_URL],
  },
  {
    key: 'docs.mcp_server_repo',
    typeLabel: 'url',
    value: CLOUDFLARE_MCP_SERVER_GITHUB_URL,
    responsibility: 'Cloudflare MCP server repository covering domain-specific MCP servers.',
    searchHints: ['cloudflare/mcp-server-cloudflare', CLOUDFLARE_MCP_SERVER_GITHUB_URL],
  },
  {
    key: 'docs.ai_gateway_mcp_repo',
    typeLabel: 'url',
    value: CLOUDFLARE_AI_GATEWAY_MCP_GITHUB_URL,
    responsibility: 'Cloudflare AI Gateway MCP app source reference.',
    searchHints: ['apps/ai-gateway', CLOUDFLARE_AI_GATEWAY_MCP_GITHUB_URL],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]') || normalized.includes('manifest')) return 'json'
  return 'string'
}

export function getCloudflareAiGatewayMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-cloudflare-ai-gateway', rowKey)
}

export const CLOUDFLARE_AI_GATEWAY_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  CLOUDFLARE_AI_GATEWAY_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: CLOUDFLARE_AI_GATEWAY_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['Cloudflare AI Gateway MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `cloudflareAiGatewayMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: 'backendEnv',
        read: () => row.value,
      },
      value: row.value,
      typeLabel: row.typeLabel,
      tooltipRole: CLOUDFLARE_AI_GATEWAY_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: [
        'cloudflare ai gateway mcp configuration',
        'cloudflare/mcp-server-cloudflare',
        row.key,
        ...(row.searchHints || []),
      ],
      details,
    }
  })
