export const EXA_MCP_DOC_AREA = 'Exa MCP Configuration'

export const EXA_MCP_DOCS_URL = 'https://exa.ai/docs/reference/exa-mcp'

export const EXA_MCP_DOCS_MARKDOWN_URL = 'https://exa.ai/docs/reference/exa-mcp.md'

export const EXA_MCP_GITHUB_URL = 'https://github.com/exa-labs/exa-mcp-server'

export const EXA_MCP_DASHBOARD_URL = 'https://dashboard.exa.ai'

export const EXA_MCP_REMOTE_URL = 'https://mcp.exa.ai/mcp'

export const EXA_MCP_DEFAULT_SERVER_KEY = 'exa'

export const EXA_MCP_CONNECTION_MODES = [
  'hosted-free',
  'api-key-header',
  'local-env',
] as const

export const EXA_MCP_DEFAULT_CONNECTION_MODE = 'hosted-free'

export const EXA_MCP_TOOL_PROFILES = [
  'default',
  'all_non_deprecated',
] as const

export const EXA_MCP_DEFAULT_TOOL_PROFILE = 'default'

export const EXA_MCP_DEFAULT_TOOL_NAMES = [
  'web_search_exa',
  'web_fetch_exa',
] as const

export const EXA_MCP_ADVANCED_TOOL_NAMES = [
  'web_search_advanced_exa',
] as const

export const EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES = [
  ...EXA_MCP_DEFAULT_TOOL_NAMES,
  ...EXA_MCP_ADVANCED_TOOL_NAMES,
] as const

export const EXA_MCP_DEPRECATED_TOOL_REPLACEMENTS = {
  get_code_context_exa: 'web_search_exa',
  company_research_exa: 'web_search_advanced_exa',
  crawling_exa: 'web_fetch_exa',
  people_search_exa: 'web_search_advanced_exa',
  linkedin_search_exa: 'web_search_advanced_exa',
  deep_researcher_start: 'Research API: https://exa.ai/docs/reference/research/create-a-task',
  deep_researcher_check: 'Research API: https://exa.ai/docs/reference/research/get-a-task',
  deep_search_exa: 'web_search_advanced_exa',
} as const

export const EXA_MCP_API_KEY_HEADER = 'x-api-key'

export const EXA_MCP_LOCAL_API_KEY_ENV = 'EXA_API_KEY'

export const EXA_MCP_DEFAULT_STARTUP_TIMEOUT_MS = 60000

export const EXA_MCP_DEFAULT_MAX_RESULTS = 10

export const EXA_MCP_DEFAULT_FETCH_CONTENT_LIMIT = 12000

export const EXA_MCP_DEFAULT_REQUIRE_FETCH_REVIEW = true

const ALLOWED_EXA_MCP_TOOLS = new Set<string>(EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES)

export const normalizeExaMcpToolNames = (tools: readonly string[]): string[] => {
  const unique: string[] = []
  for (const tool of tools) {
    const normalized = String(tool || '').trim()
    if (!ALLOWED_EXA_MCP_TOOLS.has(normalized)) continue
    if (!unique.includes(normalized)) unique.push(normalized)
  }
  return unique.length > 0 ? unique : [...EXA_MCP_DEFAULT_TOOL_NAMES]
}

export const buildExaMcpRemoteUrl = (tools: readonly string[]): string => {
  const enabledTools = normalizeExaMcpToolNames(tools)
  const isDefaultProfile =
    enabledTools.length === EXA_MCP_DEFAULT_TOOL_NAMES.length
    && enabledTools.every((tool, index) => tool === EXA_MCP_DEFAULT_TOOL_NAMES[index])
  if (isDefaultProfile) return EXA_MCP_REMOTE_URL
  return `${EXA_MCP_REMOTE_URL}?tools=${enabledTools.join(',')}`
}

export const EXA_MCP_DEFAULT_ENABLED_TOOLS_JSON = JSON.stringify(EXA_MCP_DEFAULT_TOOL_NAMES, null, 2)

export const EXA_MCP_ALL_NON_DEPRECATED_TOOLS_JSON = JSON.stringify(EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES, null, 2)

export const EXA_MCP_ALL_NON_DEPRECATED_REMOTE_URL = buildExaMcpRemoteUrl(EXA_MCP_ALL_NON_DEPRECATED_TOOL_NAMES)
