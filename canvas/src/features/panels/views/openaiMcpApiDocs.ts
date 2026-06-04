import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'
import {
  OPENAI_MCP_AUTH_MODES,
  OPENAI_MCP_CHATGPT_CONNECT_URL,
  OPENAI_MCP_DEFAULT_ALLOWED_TOOLS,
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
  OPENAI_MCP_DOC_AREA,
  OPENAI_MCP_DOCS_URL,
  OPENAI_MCP_TRANSPORTS,
  normalizeOpenAiMcpAllowedTools,
} from 'grph-shared/openai/openaiMcpSsot'

export { OPENAI_MCP_DOC_AREA, OPENAI_MCP_DOCS_URL }

type OpenAiMcpDocRow = {
  key: string
  typeLabel: string
  valueKey?: string
  value?: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
  options?: string[]
}

const OPENAI_MCP_TOOLTIP_ROLE = 'OpenAI MCP'
export const OPENAI_MCP_RESPONSES_TOOL_CONFIG_KEY = 'openaiMcp.responses_api_tool_config'
export const OPENAI_MCP_RESPONSES_REQUEST_KEY = 'openaiMcp.responses_api_request'
export const OPENAI_MCP_CHATGPT_APP_CONFIG_KEY = 'openaiMcp.chatgpt_app_connection'

const OPENAI_MCP_KEY_PREFIX = 'openai.mcp.'

const readStringValue = (values: Record<string, unknown>, key: string, fallback: string): string => {
  const value = values[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

const readNumberValue = (values: Record<string, unknown>, key: string, fallback: number): number => {
  const value = Number(values[key])
  return Number.isFinite(value) ? value : fallback
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

export function buildOpenAiMcpResponsesToolConfigJson(values: Record<string, unknown>): string {
  const serverLabel = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}serverLabel`, OPENAI_MCP_DEFAULT_SERVER_LABEL)
  const serverUrl = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}serverUrl`, OPENAI_MCP_DEFAULT_SERVER_URL)
  const allowedTools = normalizeOpenAiMcpAllowedTools(
    readJsonArrayValue(values, `${OPENAI_MCP_KEY_PREFIX}allowedTools`, OPENAI_MCP_DEFAULT_ALLOWED_TOOLS),
  )
  const requireApproval = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}requireApproval`, OPENAI_MCP_DEFAULT_REQUIRE_APPROVAL)
  return JSON.stringify({
    type: 'mcp',
    server_label: serverLabel,
    server_url: serverUrl,
    allowed_tools: allowedTools,
    require_approval: requireApproval,
  }, null, 2)
}

export function buildOpenAiMcpResponsesRequestJson(values: Record<string, unknown>): string {
  const model = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}responsesModel`, OPENAI_MCP_DEFAULT_RESPONSES_MODEL)
  return JSON.stringify({
    model,
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text: 'Search the configured MCP server for grounded answers.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Summarize the most relevant available evidence.',
          },
        ],
      },
    ],
    reasoning: {
      summary: 'auto',
    },
    tools: [
      JSON.parse(buildOpenAiMcpResponsesToolConfigJson(values)) as Record<string, unknown>,
    ],
  }, null, 2)
}

export function buildOpenAiMcpChatGptAppConnectionJson(values: Record<string, unknown>): string {
  const serverUrl = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}serverUrl`, OPENAI_MCP_DEFAULT_SERVER_URL)
  const authMode = readStringValue(values, `${OPENAI_MCP_KEY_PREFIX}authMode`, OPENAI_MCP_DEFAULT_AUTH_MODE)
  return JSON.stringify({
    connect_surface: 'ChatGPT settings > Apps & Connectors',
    server_url: serverUrl,
    auth_mode: authMode,
    docs_url: OPENAI_MCP_CHATGPT_CONNECT_URL,
  }, null, 2)
}

const OPENAI_MCP_DOC_ROWS: ReadonlyArray<OpenAiMcpDocRow> = [
  {
    key: 'server_label',
    typeLabel: 'string',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}serverLabel`,
    responsibility: 'Responses API MCP tool server_label for the remote server.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_SERVER_LABEL,
    searchHints: ['server_label', OPENAI_MCP_DEFAULT_SERVER_LABEL],
  },
  {
    key: 'server_url',
    typeLabel: 'url',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}serverUrl`,
    responsibility: 'Remote MCP server URL used by ChatGPT Apps and Responses API calls.',
    notes: 'The current OpenAI guide uses the SSE endpoint shape for test servers; keep the URL configurable for hosted deployments.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_SERVER_URL,
    searchHints: ['server_url', 'sse', '/sse/', OPENAI_MCP_DOCS_URL],
  },
  {
    key: 'transport',
    typeLabel: 'enum',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}transport`,
    responsibility: 'Remote MCP transport exposed by the custom server.',
    notes: 'ChatGPT developer-mode app creation supports SSE and streaming HTTP MCP transports; Responses API examples use the remote server URL directly.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_TRANSPORT,
    options: [...OPENAI_MCP_TRANSPORTS],
    searchHints: ['sse', 'server-sent events', 'streaming http', 'transport'],
  },
  {
    key: 'allowed_tools',
    typeLabel: 'string[]',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}allowedTools`,
    responsibility: 'Responses API allowed_tools list for the OpenAI MCP tool.',
    notes: 'The OpenAI guide uses read-oriented search and fetch for ChatGPT apps and deep research.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_ALLOWED_TOOLS_JSON,
    searchHints: ['allowed_tools', 'search', 'fetch'],
  },
  {
    key: 'require_approval',
    typeLabel: 'enum',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}requireApproval`,
    responsibility: 'Responses API require_approval value for deep research MCP use.',
    notes: 'OpenAI documents no approval required for deep research API testing.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_REQUIRE_APPROVAL,
    searchHints: ['require_approval', 'never', 'deep research'],
  },
  {
    key: 'responses_model',
    typeLabel: 'string',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}responsesModel`,
    responsibility: 'Responses API model used when testing the remote MCP server.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_RESPONSES_MODEL,
    searchHints: ['o4-mini-deep-research', 'responses api', 'model'],
  },
  {
    key: 'auth_mode',
    typeLabel: 'enum',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}authMode`,
    responsibility: 'Authentication posture for ChatGPT app connection to the remote MCP server.',
    notes: 'OpenAI recommends OAuth with CIMD when supported; developer-mode app creation also supports static OAuth credentials, dynamic client registration, no authentication, and mixed authentication.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_AUTH_MODE,
    options: [...OPENAI_MCP_AUTH_MODES],
    searchHints: ['oauth', 'cimd', 'dynamic client registration', 'static credentials', 'no authentication', 'mixed authentication'],
  },
  {
    key: 'api_key_env',
    typeLabel: 'string',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}apiKeyEnv`,
    responsibility: 'Server-side environment variable name for OpenAI API access.',
    notes: 'MainPanel stores only the environment variable name, never the API key value.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_API_KEY_ENV,
    searchHints: ['OPENAI_API_KEY', 'secret', 'server env'],
  },
  {
    key: 'vector_store_env',
    typeLabel: 'string',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}vectorStoreEnv`,
    responsibility: 'Server-side environment variable name for the vector store id used by search and fetch.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_VECTOR_STORE_ENV,
    searchHints: ['VECTOR_STORE_ID', 'vector store', 'search', 'fetch'],
  },
  {
    key: 'server_port',
    typeLabel: 'integer',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}serverPort`,
    responsibility: 'Local development port for the sample FastMCP SSE server.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_SERVER_PORT,
    searchHints: ['8000', 'fastmcp', 'sse'],
  },
  {
    key: 'require_tool_review',
    typeLabel: 'boolean',
    valueKey: `${OPENAI_MCP_KEY_PREFIX}requireToolReview`,
    responsibility: 'Require operator review of tool parameters and untrusted content before connecting custom MCPs.',
    tooltipDefaultValue: OPENAI_MCP_DEFAULT_REQUIRE_TOOL_REVIEW,
    searchHints: ['prompt injection', 'tool parameters', 'privacy overreach'],
  },
  {
    key: 'responses_api_tool_config',
    typeLabel: 'object',
    value: buildOpenAiMcpResponsesToolConfigJson({}),
    responsibility: 'Generated Responses API MCP tool object using the configured server label, URL, allowed tools, and approval mode.',
    searchHints: ['type mcp', 'server_label', 'server_url', 'allowed_tools', 'require_approval'],
  },
  {
    key: 'responses_api_request',
    typeLabel: 'object',
    value: buildOpenAiMcpResponsesRequestJson({}),
    responsibility: 'Generated Responses API request body for testing the configured remote MCP server.',
    searchHints: ['responses api', 'tools', 'reasoning summary auto', OPENAI_MCP_DEFAULT_RESPONSES_MODEL],
  },
  {
    key: 'chatgpt_app_connection',
    typeLabel: 'object',
    value: buildOpenAiMcpChatGptAppConnectionJson({}),
    responsibility: 'ChatGPT Apps & Connectors connection summary for the configured remote MCP server.',
    searchHints: ['ChatGPT settings', 'Apps & Connectors', OPENAI_MCP_CHATGPT_CONNECT_URL],
  },
  {
    key: 'docs.url',
    typeLabel: 'url',
    value: OPENAI_MCP_DOCS_URL,
    responsibility: 'Canonical OpenAI guide for building MCP servers for ChatGPT Apps and API integrations.',
    searchHints: ['OpenAI MCP docs', OPENAI_MCP_DOCS_URL],
  },
  {
    key: 'safety.prompt_injection',
    typeLabel: 'security note',
    value: 'review_tool_parameters_and_untrusted_content',
    responsibility: 'Prompt-injection and privacy-overreach guard for custom MCP tools.',
    notes: 'OpenAI recommends reviewing custom MCP risk, minimizing access, and checking requested parameters.',
    searchHints: ['prompt injection', 'privacy overreach', 'custom MCP risk'],
  },
  {
    key: 'safety.trusted_servers',
    typeLabel: 'security note',
    value: 'prefer_official_or_verified_remote_mcp_server',
    responsibility: 'Trust boundary for choosing custom or third-party MCP servers.',
    notes: 'Prefer official servers hosted by the service provider; verify custom server data handling before connecting.',
    searchHints: ['trusted servers', 'official servers', 'data handling'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]') || normalized.includes('map')) return 'json'
  return 'string'
}

export function getOpenAiMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-openai', rowKey)
}

export const OPENAI_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPENAI_MCP_DOC_ROWS.map(row => {
    const fallbackValue = row.value ?? row.tooltipDefaultValue ?? ''
    const details: FlowDetails = {
      area: OPENAI_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['OpenAI MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `openaiMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: row.valueKey ? 'localStorage' : 'backendEnv',
        read: () => fallbackValue,
        options: row.options,
      },
      value: fallbackValue,
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: OPENAI_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['openai mcp configuration', 'chatgpt apps', 'responses api', row.key, ...(row.searchHints || [])],
      details,
    }
  })
