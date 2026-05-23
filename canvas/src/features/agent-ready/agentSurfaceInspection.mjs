export const buildAgentSurfaceInspectionPayload = (args = {}) => {
  const baseUrl = String(args.baseUrl || '').replace(/\/+$/, '')
  return {
    baseUrl,
    healthUrl: `${baseUrl}/health`,
    mcpUrl: `${baseUrl}/mcp`,
    apiCatalogUrl: `${baseUrl}/.well-known/api-catalog`,
    openApiUrl: `${baseUrl}/.well-known/openapi.json`,
    mcpServerCardUrl: `${baseUrl}/.well-known/mcp/server-card.json`,
    agentCardUrl: `${baseUrl}/.well-known/agent-card.json`,
    agentSkillsUrl: `${baseUrl}/.well-known/agent-skills/index.json`,
    health: args.health,
    apiCatalog: args.apiCatalog,
    openApi: args.openApi,
    mcpServerCard: args.mcpServerCard,
    agentCard: args.agentCard,
    agentSkills: args.agentSkills,
  }
}

export const createAgentSurfaceInspectionExecutor = (args = {}) => {
  const baseUrl = String(args.baseUrl || '').replace(/\/+$/, '')
  const fetchJson = args.fetchJson
  if (!baseUrl) {
    throw new Error('baseUrl is required')
  }
  if (typeof fetchJson !== 'function') {
    throw new Error('fetchJson is required')
  }
  return async () => {
    const [health, apiCatalog, openApi, mcpServerCard, agentCard, agentSkills] = await Promise.all([
      fetchJson(`${baseUrl}/health`, 'application/health+json'),
      fetchJson(`${baseUrl}/.well-known/api-catalog`, 'application/linkset+json'),
      fetchJson(`${baseUrl}/.well-known/openapi.json`, 'application/json'),
      fetchJson(`${baseUrl}/.well-known/mcp/server-card.json`, 'application/json'),
      fetchJson(`${baseUrl}/.well-known/agent-card.json`, 'application/json'),
      fetchJson(`${baseUrl}/.well-known/agent-skills/index.json`, 'application/json'),
    ])
    return buildAgentSurfaceInspectionPayload({
      baseUrl,
      health,
      apiCatalog,
      openApi,
      mcpServerCard,
      agentCard,
      agentSkills,
    })
  }
}
