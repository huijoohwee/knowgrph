export const FEISHU_BASE_MCP_DOC_AREA = 'Feishu Base MCP Configuration'

export const FEISHU_BASE_MCP_DOCS_URL = 'https://open.feishu.cn/'

export const FEISHU_BASE_MCP_DEFAULT_SERVER_KEY = 'feishu-base'

export const FEISHU_BASE_MCP_CONNECTION_MODES = [
  'host-managed',
] as const

export const FEISHU_BASE_MCP_DEFAULT_CONNECTION_MODE = 'host-managed'

export const FEISHU_BASE_MCP_AUTH_BOUNDARIES = [
  'host-or-server-owned',
] as const

export const FEISHU_BASE_MCP_DEFAULT_AUTH_BOUNDARY = 'host-or-server-owned'

export const FEISHU_BASE_MCP_PHASES = [
  'phase-1-configuration-surface',
] as const

export const FEISHU_BASE_MCP_DEFAULT_PHASE = 'phase-1-configuration-surface'

export const FEISHU_BASE_MCP_PHASE_2_STATUS = 'planned-not-implemented'

export const FEISHU_BASE_MCP_PHASE_3_STATUS = 'planned-not-implemented'

export const FEISHU_BASE_MCP_SKILL_ROUTE = 'lark-base'

export const FEISHU_BASE_MCP_OPERATOR_GUIDANCE =
  'Use lark-base and host-managed auth; do not paste Base secrets into browser settings.'

export const FEISHU_BASE_MCP_PHASE_SCOPE =
  'Phase 1 is documentation and settings only; it does not ship Base source ingestion or Base write-back.'

export const FEISHU_BASE_MCP_TROUBLESHOOTING =
  'Confirm MCP host auth ownership, confirm Base token ownership outside the browser, and keep Base flows on the validated path.'
