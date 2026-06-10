// Operator Deploy settings SSOT (single source of truth).
//
// Spec: knowgrph-acos-mcp-connector — surfaces the OPERATOR-GATED deploy
// configuration (the env the 90-minute deploy runbook needs) as USER SETTINGS
// editable in MainPanel Integrations / MCP / Settings, instead of env-only.
//
// This is a NEUTRAL LEAF module: it imports nothing from the settings registry
// or the panels views, so it can be shared by both the registry
// (`registry-operator-deploy.ts`) and the docs/virtual-entries module
// (`../panels/views/operatorDeployMcpApiDocs.ts`) without an import cycle.
//
// R11 boundary: these are operator-facing ENDPOINTS, NAMES, and TOGGLES only —
// never a model provider key or a raw secret value. `authJwtSecretName` stores
// the AWS Secrets Manager secret NAME, not the secret. Stored in localStorage
// like every other MainPanel setting.

/** Section label used to group the rows under MainPanel MCP / Integrations. */
export const OPERATOR_DEPLOY_MCP_DOC_AREA = 'Operator Deploy MCP'

/** Operator runbook reference (kept in-repo; not a network dependency). */
export const OPERATOR_DEPLOY_MCP_DOCS_URL =
  'https://github.com/huijoohwee/knowgrph/blob/main/docs/knowgrph-acos-deploy-runbook.md'

export const OPERATOR_DEPLOY_MODES = ['dry-run', 'live'] as const
export type OperatorDeployMode = (typeof OPERATOR_DEPLOY_MODES)[number]

// --- Defaults ---------------------------------------------------------------

/** Cloudflare control-plane MCP Streamable HTTP endpoint (env `MCP_ENDPOINT`). */
export const OPERATOR_DEPLOY_DEFAULT_MCP_ENDPOINT = 'https://airvio.co/knowgrph/mcp'

/** Deployed AWS Agent-API base URL (env `AGENT_API_URL`). Empty until deployed. */
export const OPERATOR_DEPLOY_DEFAULT_AGENT_API_URL = ''

/** Deployed AgentCore Runtime MCP endpoint (the deployable-agent artifact). Empty until deployed. */
export const OPERATOR_DEPLOY_DEFAULT_AGENTCORE_ENDPOINT = ''

/** Deployed Vercel frontend URL (env `FRONTEND_URL`). Empty until deployed. */
export const OPERATOR_DEPLOY_DEFAULT_FRONTEND_URL = ''

/** AWS region for the Agent-API + AgentCore deploy. */
export const OPERATOR_DEPLOY_DEFAULT_AWS_REGION = 'us-east-1'

/** AWS Secrets Manager secret NAME holding the HS256 Auth_Token signing secret (never the value). */
export const OPERATOR_DEPLOY_DEFAULT_AUTH_JWT_SECRET_NAME = 'knowgrph/agent-api/auth-jwt-secret'

/** Director run mode for the live-proof step. Defaults to the safe dry-run. */
export const OPERATOR_DEPLOY_DEFAULT_MODE: OperatorDeployMode = 'dry-run'

/** Whether live clients (paid providers) are wired (`KNOWGRPH_LIVE_CLIENTS`). Default off. */
export const OPERATOR_DEPLOY_DEFAULT_LIVE_CLIENTS_ENABLED = false

/** Operator acknowledgement that a `cloud-deploy` Approval_Token has been granted. Default off (fail-closed). */
export const OPERATOR_DEPLOY_DEFAULT_CLOUD_DEPLOY_APPROVED = false

// --- Setting + storage key strings (mirrors the openai.mcp.* precedent) -----

export const OPERATOR_DEPLOY_KEY_PREFIX = 'operatorDeploy.mcp.'

export const OPERATOR_DEPLOY_SETTING_KEYS = {
  mcpEndpoint: `${OPERATOR_DEPLOY_KEY_PREFIX}endpoint`,
  agentApiUrl: `${OPERATOR_DEPLOY_KEY_PREFIX}agentApiUrl`,
  agentCoreEndpoint: `${OPERATOR_DEPLOY_KEY_PREFIX}agentCoreEndpoint`,
  frontendUrl: `${OPERATOR_DEPLOY_KEY_PREFIX}frontendUrl`,
  awsRegion: `${OPERATOR_DEPLOY_KEY_PREFIX}awsRegion`,
  authJwtSecretName: `${OPERATOR_DEPLOY_KEY_PREFIX}authJwtSecretName`,
  mode: `${OPERATOR_DEPLOY_KEY_PREFIX}mode`,
  liveClientsEnabled: `${OPERATOR_DEPLOY_KEY_PREFIX}liveClientsEnabled`,
  cloudDeployApproved: `${OPERATOR_DEPLOY_KEY_PREFIX}cloudDeployApproved`,
} as const
