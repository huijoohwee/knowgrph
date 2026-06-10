import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'
import {
  OPERATOR_DEPLOY_DEFAULT_AGENTCORE_ENDPOINT,
  OPERATOR_DEPLOY_DEFAULT_AGENT_API_URL,
  OPERATOR_DEPLOY_DEFAULT_AUTH_JWT_SECRET_NAME,
  OPERATOR_DEPLOY_DEFAULT_AWS_REGION,
  OPERATOR_DEPLOY_DEFAULT_CLOUD_DEPLOY_APPROVED,
  OPERATOR_DEPLOY_DEFAULT_FRONTEND_URL,
  OPERATOR_DEPLOY_DEFAULT_LIVE_CLIENTS_ENABLED,
  OPERATOR_DEPLOY_DEFAULT_MCP_ENDPOINT,
  OPERATOR_DEPLOY_DEFAULT_MODE,
  OPERATOR_DEPLOY_MCP_DOC_AREA,
  OPERATOR_DEPLOY_MCP_DOCS_URL,
  OPERATOR_DEPLOY_MODES,
  OPERATOR_DEPLOY_SETTING_KEYS,
} from '@/features/settings/operatorDeploySsot'

export { OPERATOR_DEPLOY_MCP_DOC_AREA, OPERATOR_DEPLOY_MCP_DOCS_URL }

type OperatorDeployDocRow = {
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

const OPERATOR_DEPLOY_TOOLTIP_ROLE = 'Operator Deploy MCP'

const OPERATOR_DEPLOY_DOC_ROWS: ReadonlyArray<OperatorDeployDocRow> = [
  {
    key: 'endpoint',
    typeLabel: 'url',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.mcpEndpoint,
    responsibility: 'Cloudflare control-plane MCP Streamable HTTP endpoint (deploy env MCP_ENDPOINT).',
    notes: 'Used by the AWS Agent-API + AgentCore forwarders; when unset the forwarder fails closed (HTTP 501).',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_MCP_ENDPOINT,
    searchHints: ['MCP_ENDPOINT', 'airvio.co/knowgrph/mcp', 'control plane', 'streamable http'],
  },
  {
    key: 'agentApiUrl',
    typeLabel: 'url',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.agentApiUrl,
    responsibility: 'Deployed AWS Agent-API base URL (deploy env AGENT_API_URL) the Vercel frontend calls.',
    notes: 'Set after the AWS CDK deploy (task 11.2). Drives runtime:verify reachability + the Demo_Pack urls[].',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_AGENT_API_URL,
    searchHints: ['AGENT_API_URL', 'POST /run', 'GET /runs/{id}', 'GET /health', 'api gateway lambda'],
  },
  {
    key: 'agentCoreEndpoint',
    typeLabel: 'url',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.agentCoreEndpoint,
    responsibility: 'Deployed Amazon Bedrock AgentCore Runtime MCP endpoint — the AWS-tier deployable-agent artifact (task 13.9/13.10).',
    notes: 'Optional/stretch lane; complements the REST tier. Registered in the Demo_Pack urls[] when present.',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_AGENTCORE_ENDPOINT,
    searchHints: ['agentcore', 'bedrock agentcore runtime', 'tools/list', '/ping', 'deployable agent'],
  },
  {
    key: 'frontendUrl',
    typeLabel: 'url',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.frontendUrl,
    responsibility: 'Deployed Vercel frontend URL (deploy env FRONTEND_URL) recorded in the Demo_Pack for AC-7.',
    notes: 'Set after the Vercel deploy (task 11.3).',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_FRONTEND_URL,
    searchHints: ['FRONTEND_URL', 'vercel', 'reachable frontend', 'AC-7'],
  },
  {
    key: 'awsRegion',
    typeLabel: 'string',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.awsRegion,
    responsibility: 'AWS region for the Agent-API + AgentCore Runtime deploy.',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_AWS_REGION,
    searchHints: ['aws region', 'us-east-1', 'cdk deploy'],
  },
  {
    key: 'authJwtSecretName',
    typeLabel: 'string',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.authJwtSecretName,
    responsibility: 'AWS Secrets Manager secret NAME holding the HS256 Auth_Token signing secret.',
    notes: 'Stores the secret NAME only — never the secret value (R15.7 / R11). Server-side only.',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_AUTH_JWT_SECRET_NAME,
    searchHints: ['secrets manager', 'HS256', 'auth-jwt-secret', 'server-side only'],
  },
  {
    key: 'mode',
    typeLabel: 'enum',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.mode,
    responsibility: 'Director run mode for the live-proof step: dry-run (zero spend) or live (gated paid actions).',
    notes: 'Defaults to dry-run. The live-without-approvals halt (AC-1) is always demonstrable in dry-run.',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_MODE,
    options: [...OPERATOR_DEPLOY_MODES],
    searchHints: ['dry-run', 'live', 'AC-1', 'halt', 'zero spend'],
  },
  {
    key: 'liveClientsEnabled',
    typeLabel: 'boolean',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.liveClientsEnabled,
    responsibility: 'Whether live provider clients are wired at the Director boundary (env KNOWGRPH_LIVE_CLIENTS).',
    notes: 'Off keeps deterministic mocks. On requires provider credentials on the control plane (Cloudflare).',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_LIVE_CLIENTS_ENABLED,
    searchHints: ['KNOWGRPH_LIVE_CLIENTS', 'live clients', 'exa', 'byteplus', 'stripe'],
  },
  {
    key: 'cloudDeployApproved',
    typeLabel: 'boolean',
    valueKey: OPERATOR_DEPLOY_SETTING_KEYS.cloudDeployApproved,
    responsibility: 'Operator acknowledgement that a cloud-deploy Approval_Token has been granted for this session.',
    notes: 'Fail-closed default (off). A UI acknowledgement only — it never substitutes for the actual Approval_Token at a spend boundary (R15.9).',
    tooltipDefaultValue: OPERATOR_DEPLOY_DEFAULT_CLOUD_DEPLOY_APPROVED,
    searchHints: ['cloud-deploy', 'approval token', 'operator-gated', 'auth != approval'],
  },
  {
    key: 'docs.url',
    typeLabel: 'url',
    value: OPERATOR_DEPLOY_MCP_DOCS_URL,
    responsibility: 'The 90-minute operator deploy + live-proof runbook (authoritative step-by-step).',
    searchHints: ['deploy runbook', 'operator-gated', OPERATOR_DEPLOY_MCP_DOCS_URL],
  },
]

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('float') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]') || normalized.includes('map')) return 'json'
  return 'string'
}

export function getOperatorDeployMcpApiRowAnchorId(rowKey: string): string {
  return buildSettingsRowAnchorId('mcp-row-operator-deploy', rowKey)
}

export const OPERATOR_DEPLOY_MCP_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  OPERATOR_DEPLOY_DOC_ROWS.map(row => {
    const fallbackValue = row.value ?? row.tooltipDefaultValue ?? ''
    const details: FlowDetails = {
      area: OPERATOR_DEPLOY_MCP_DOC_AREA,
      responsibility: row.responsibility,
      notes: row.notes || '',
      modules: ['Operator Deploy MCP'],
      classes: ['Configuration'],
      functions: [],
      imports: [],
    }
    return {
      meta: {
        key: `operatorDeployMcp.${row.key}`,
        type: toBaseType(row.typeLabel),
        source: row.valueKey ? 'localStorage' : 'backendEnv',
        read: () => fallbackValue,
        options: row.options,
      },
      value: fallbackValue,
      valueKey: row.valueKey,
      typeLabel: row.typeLabel,
      tooltipRole: OPERATOR_DEPLOY_TOOLTIP_ROLE,
      tooltipDefaultValue: row.tooltipDefaultValue,
      searchHints: ['operator deploy mcp configuration', 'cloud-deploy', 'agent-api', 'agentcore', row.key, ...(row.searchHints || [])],
      details,
    }
  })
