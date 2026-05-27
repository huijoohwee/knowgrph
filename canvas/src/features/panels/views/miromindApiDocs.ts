import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import type { SettingMeta } from '@/features/settings/types'
import {
  CHAT_MIROMIND_ENDPOINT_URL,
  CHAT_MIROMIND_MODEL_OPTIONS,
  CHAT_PROVIDER_MIROMIND,
} from '@/lib/chatEndpoint'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const MIROMIND_API_DOC_AREA = 'MiroMind API'
export const MIROMIND_API_DOCS_URL = 'https://api.miromind.ai/v1/chat/completions'

export function getMiroMindApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('miromind-chat-api-row', rowKey)
}

const MIROMIND_TOOLTIP_ROLE = 'MiroMind API'

type MiroMindDocRow = {
  key: string
  typeLabel: string
  value?: string | number | boolean
  valueKey?: string
  responsibility: string
  notes?: string
  searchHints?: string[]
}

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

const MIROMIND_API_DOC_ROWS: ReadonlyArray<MiroMindDocRow> = [
  {
    key: 'provider',
    typeLabel: 'string',
    valueKey: 'chatProvider',
    value: CHAT_PROVIDER_MIROMIND,
    responsibility: 'Shared chat provider id for MiroMind on the existing FloatingPanel Chat transport path.',
    notes: 'Uses the shared provider/model/auth owner instead of a second assistant runtime.',
    searchHints: ['provider', 'chatProvider', 'miromind'],
  },
  {
    key: 'auth_mode',
    typeLabel: 'string',
    valueKey: 'chatAuthMode',
    responsibility: 'Shared auth mode for the upstream MiroMind API key.',
    notes: 'Prefer server-managed auth; BYOK stays session-only and never persists to localStorage.',
    searchHints: ['auth', 'byok', 'serverManaged'],
  },
  {
    key: 'api_key',
    typeLabel: 'string',
    valueKey: 'chatApiKey',
    responsibility: 'Session-only BYOK field for MiroMind API access.',
    notes: 'Browser state must not persist the raw key.',
    searchHints: ['api key', 'bearer', 'MIROMIND_API_KEY'],
  },
  {
    key: 'endpoint_url',
    typeLabel: 'string',
    valueKey: 'chatEndpointUrl',
    value: CHAT_MIROMIND_ENDPOINT_URL,
    responsibility: 'OpenAI-compatible MiroMind chat-completions endpoint routed through the shared chat proxy.',
    searchHints: ['endpoint', 'chat completions', '/v1/chat/completions'],
  },
  {
    key: 'model',
    typeLabel: 'string',
    valueKey: 'chatModel',
    value: CHAT_MIROMIND_MODEL_OPTIONS[0],
    responsibility: 'Model id for MiroMind deep-research chat completions.',
    searchHints: ['model', 'mirothinker-1-7-deepresearch-mini', 'mirothinker-1-7-deepresearch'],
  },
  {
    key: 'messages',
    typeLabel: 'array',
    value: 'Shared prompt contract composes system messages, packed graph/workspace context, optional scoped context, and conversation history.',
    responsibility: 'States that MiroMind reuses the canonical Knowgrph chat request message assembly.',
    notes: 'No provider-specific prompt schema fork is allowed.',
    searchHints: ['messages', 'prompt contract', 'context pack'],
  },
  {
    key: 'stream',
    typeLabel: 'boolean',
    valueKey: 'chatStream',
    value: true,
    responsibility: 'Streaming toggle for the shared SSE request path.',
    notes: 'Raw SSE parsing preserves MiroMind reasoning_steps and final usage metadata.',
    searchHints: ['stream', 'sse', 'reasoning_steps'],
  },
  {
    key: 'max_tokens',
    typeLabel: 'integer',
    valueKey: 'chatMaxCompletionTokens',
    value: 4000,
    responsibility: 'Completion-token cap for the shared chat-completions request.',
    searchHints: ['max_tokens', 'completion tokens'],
  },
  {
    key: 'mcp_servers',
    typeLabel: 'array',
    value: 'Optional provider-side array of external MCP server configs. Capability guidance belongs in MainPanel MCP and does not replace Knowgrph MCP runtime ownership.',
    responsibility: 'Documents the optional provider request field without creating a second MainPanel-to-canvas pipeline.',
    notes: 'Treat as provider capability only; downstream ownership still stays chat -> markdown -> workspace -> canvas.',
    searchHints: ['mcp_servers', 'provider-side mcp', 'optional'],
  },
  {
    key: 'streaming.reasoning_steps',
    typeLabel: 'streaming',
    value: 'Reasoning chunks arrive in delta.reasoning_steps before delta.content. Final usage may include reasoning_tokens and num_search_queries.',
    responsibility: 'Documents the additive SSE extensions that the shared raw stream parser can surface.',
    notes: 'Reasoning remains observational metadata and must not directly mutate the graph.',
    searchHints: ['reasoning_steps', 'reasoning_tokens', 'num_search_queries', 'usage'],
  },
]

export const MIROMIND_API_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  MIROMIND_API_DOC_ROWS.map(row => ({
    meta: {
      key: `miromindApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: row.valueKey ? 'localStorage' : 'backendEnv',
      read: () => row.value ?? 'MiroMind API setting',
    },
    value: row.value ?? 'MiroMind API setting',
    valueKey: row.valueKey,
    typeLabel: row.typeLabel,
    tooltipRole: row.valueKey ? MIROMIND_TOOLTIP_ROLE : undefined,
    searchHints: ['miromind api', row.key, ...(row.searchHints || [])],
    details: {
      area: MIROMIND_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['POST /v1/chat/completions'],
      classes: ['Request body'],
      functions: ['MiroMind Chat Completions API'],
    },
  }))
