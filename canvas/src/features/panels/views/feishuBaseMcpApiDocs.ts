import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'
import {
  FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
  FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
  FEISHU_BASE_MCP_DEFAULT_PHASE,
  FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
  FEISHU_BASE_MCP_DOC_AREA,
  FEISHU_BASE_MCP_DOCS_URL,
  FEISHU_BASE_MCP_OPERATOR_GUIDANCE,
  FEISHU_BASE_MCP_PHASE_2_STATUS,
  FEISHU_BASE_MCP_PHASE_3_STATUS,
  FEISHU_BASE_MCP_PHASE_SCOPE,
  FEISHU_BASE_MCP_SKILL_ROUTE,
  FEISHU_BASE_MCP_TROUBLESHOOTING,
} from 'grph-shared/search/feishuBaseMcpSsot'

export { FEISHU_BASE_MCP_DOC_AREA, FEISHU_BASE_MCP_DOCS_URL }

type FeishuBaseMcpDocRow = {
  key: string
  typeLabel: string
  valueKey?: string
  value?: string | number | boolean
  responsibility: string
  notes?: string
  searchHints?: string[]
  tooltipDefaultValue?: string | number | boolean | null
}

const FEISHU_BASE_MCP_TOOLTIP_ROLE = 'Feishu Base MCP'

const FEISHU_BASE_MCP_KEY_PREFIX = 'search.feishuBase.mcp.'

const FEISHU_BASE_MCP_DOC_ROWS: ReadonlyArray<FeishuBaseMcpDocRow> = [
  {
    key: 'server_key',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}serverKey`,
    responsibility: 'MCP server key label used when a host-managed Feishu Base integration is named inside an MCP host.',
    tooltipDefaultValue: FEISHU_BASE_MCP_DEFAULT_SERVER_KEY,
    searchHints: ['mcpServers', FEISHU_BASE_MCP_DEFAULT_SERVER_KEY, 'host-managed'],
  },
  {
    key: 'connection.mode',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}connectionMode`,
    responsibility: 'Phase 1 connection posture for Feishu Base integration ownership.',
    notes: 'Phase 1 is host-managed only. The browser documents the integration, but it does not own a direct Feishu Base runtime.',
    tooltipDefaultValue: FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE,
    searchHints: ['host-managed', 'phase 1', 'configuration surface'],
  },
  {
    key: 'auth_boundary',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}authBoundary`,
    responsibility: 'Explicit auth boundary for Feishu Base credentials and privileged tokens.',
    notes: 'Base tokens, app secrets, and privileged credentials stay with the MCP host or server environment, not browser settings.',
    tooltipDefaultValue: FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY,
    searchHints: ['host-or-server-owned', 'no browser secrets', 'Base token'],
  },
  {
    key: 'phase',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}phase`,
    responsibility: 'Current Feishu Base implementation phase surfaced in MainPanel MCP.',
    notes: 'This phase exposes configuration and documentation only.',
    tooltipDefaultValue: FEISHU_BASE_MCP_DEFAULT_PHASE,
    searchHints: ['phase 1', 'configuration surface', 'docs only'],
  },
  {
    key: 'phase_2_status',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}phase2Status`,
    responsibility: 'Status label for future Feishu Base content-source adaptation.',
    notes: 'Phase 2 is planned, but it is not implemented in this rollout.',
    tooltipDefaultValue: FEISHU_BASE_MCP_PHASE_2_STATUS,
    searchHints: ['phase 2', 'source adapter', 'planned-not-implemented'],
  },
  {
    key: 'phase_3_status',
    typeLabel: 'string',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}phase3Status`,
    responsibility: 'Status label for future Feishu Base publish or promotion write-back.',
    notes: 'Phase 3 is planned, but it is not implemented in this rollout.',
    tooltipDefaultValue: FEISHU_BASE_MCP_PHASE_3_STATUS,
    searchHints: ['phase 3', 'publish target', 'planned-not-implemented'],
  },
  {
    key: 'skill.route',
    typeLabel: 'string',
    value: FEISHU_BASE_MCP_SKILL_ROUTE,
    responsibility: 'Current operator-facing routing hint for Feishu Base operations.',
    notes: 'Use lark-base for actual Base operations until a dedicated Phase 2 or Phase 3 owner is implemented.',
    searchHints: ['lark-base', 'skill route', 'Base operations'],
  },
  {
    key: 'docs.url',
    typeLabel: 'url',
    valueKey: `${FEISHU_BASE_MCP_KEY_PREFIX}docsUrl`,
    responsibility: 'Canonical external Feishu operator documentation landing page for Phase 1.',
    tooltipDefaultValue: FEISHU_BASE_MCP_DOCS_URL,
    searchHints: ['docs url', FEISHU_BASE_MCP_DOCS_URL, 'Feishu open platform'],
  },
  {
    key: 'operator_guidance',
    typeLabel: 'guidance',
    value: FEISHU_BASE_MCP_OPERATOR_GUIDANCE,
    responsibility: 'Operator-facing guidance for how Feishu Base should be used during Phase 1.',
    searchHints: ['operator guidance', 'host-managed auth', 'no browser secrets'],
  },
  {
    key: 'phase_scope',
    typeLabel: 'guidance',
    value: FEISHU_BASE_MCP_PHASE_SCOPE,
    responsibility: 'Explicit scope boundary for the current Phase 1 rollout.',
    searchHints: ['phase scope', 'docs and settings only', 'no source ingestion', 'no write-back'],
  },
  {
    key: 'troubleshooting',
    typeLabel: 'guidance',
    value: FEISHU_BASE_MCP_TROUBLESHOOTING,
    responsibility: 'Troubleshooting guidance for Feishu Base Phase 1 operator confusion and host-boundary issues.',
    searchHints: ['troubleshooting', 'host auth', 'validated path'],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]') || normalized.includes('map')) return 'json'
  return 'string'
}

export function getFeishuBaseMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-feishu-base', rowKey)
}

export const FEISHU_BASE_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  FEISHU_BASE_MCP_DOC_ROWS.map(row => {
    const details: FlowDetails = {
      area: FEISHU_BASE_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['Feishu Base MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `feishuBaseMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: row.valueKey ? 'localStorage' : 'backendEnv',
        read: () => row.value ?? 'Feishu Base MCP setting',
      },
      value: row.value ?? 'Feishu Base MCP setting',
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: FEISHU_BASE_MCP_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['feishu base mcp configuration', 'lark-base', row.key, ...(row.searchHints || [])],
      details,
    }
  })
