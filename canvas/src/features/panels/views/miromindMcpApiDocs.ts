import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

export const MIROMIND_MCP_DOC_AREA = 'MiroMind MCP'
export const MIROMIND_MCP_DOCS_URL = 'https://api.miromind.ai/v1/chat/completions'

type MiroMindMcpDocRow = {
  key: string
  typeLabel: string
  value: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
}

const MIROMIND_MCP_DOC_ROWS: ReadonlyArray<MiroMindMcpDocRow> = [
  {
    key: 'request_field',
    typeLabel: 'array',
    value: 'mcp_servers',
    responsibility: 'Names the optional MiroMind chat-completions request field for provider-side MCP connectivity.',
    searchHints: ['mcp_servers', 'request field'],
  },
  {
    key: 'transport',
    typeLabel: 'string',
    value: 'remote_request_descriptors',
    responsibility: 'Clarifies that MiroMind MCP support is request-scoped provider capability, not a local stdio/runtime replacement.',
    searchHints: ['remote mcp', 'provider-side'],
  },
  {
    key: 'availability',
    typeLabel: 'string',
    value: 'optional_plan_dependent',
    responsibility: 'Keeps MainPanel MCP guidance neutral when the capability is unavailable.',
    searchHints: ['availability', 'private beta', 'optional'],
  },
  {
    key: 'boundary',
    typeLabel: 'readiness',
    value: 'shared chat -> markdown YAML frontmatter -> canvas apply boundary',
    responsibility: 'Prevents a second E2E runtime contract and preserves upstream/downstream boundaries.',
    notes: 'Do not treat provider-side MCP as authority for renderer, widget, grouping, markdown YAML frontmatter, or direct graph mutation behavior.',
    searchHints: ['boundary', 'chat pipeline', 'markdown YAML frontmatter', 'canvas'],
  },
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: MIROMIND_MCP_DOCS_URL,
    responsibility: 'Reference URL for MiroMind chat-completions and optional mcp_servers guidance.',
    searchHints: ['docs', 'miromind'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export function getMiroMindMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-miromind', rowKey)
}

export const MIROMIND_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  MIROMIND_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: MIROMIND_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['MiroMind MCP capability'],
      classes: ['Capability boundary'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `miromindMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: 'backendEnv',
        read: () => row.value,
      },
      value: row.value,
      typeLabel: row.typeLabel,
      searchHints: ['miromind mcp', row.key, ...(row.searchHints || [])],
      details,
    }
  })
