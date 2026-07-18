export const AGENTIC_OS_DOCS_MCP_BRIDGE_PATH = '/__knowgrph_mcp_agentic_os_docs_invoke' as const
export const AGENTIC_OS_DOCS_MCP_TOOL_NAME = 'knowgrph.agentic_canvas_os.docs.invoke' as const
export const AGENTIC_OS_DOCS_MCP_MAX_INVOCATION_TOKENS = 12

export type AgenticOsDocsMcpInvocationResolution = {
  token: string
  ok: boolean
  kind?: string
  label?: string
  summary?: string
  sourcePath?: string
  error?: string
}

export type AgenticOsDocsMcpBridgeRequest = {
  invocationTokens: string[]
}

export type AgenticOsDocsMcpBridgeSuccess = {
  ok: true
  tool: typeof AGENTIC_OS_DOCS_MCP_TOOL_NAME
  mcpInvoked: true
  invocations: AgenticOsDocsMcpInvocationResolution[]
}

export const normalizeAgenticOsDocsMcpInvocationTokens = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const candidate of value) {
    const token = String(candidate || '').trim()
    if (!/^[/#@][A-Za-z0-9_.-]{1,96}$/.test(token)) continue
    const identity = token.toLowerCase()
    if (seen.has(identity)) continue
    seen.add(identity)
    tokens.push(token)
    if (tokens.length >= AGENTIC_OS_DOCS_MCP_MAX_INVOCATION_TOKENS) break
  }
  return tokens
}

export const normalizeAgenticOsDocsMcpBridgeRequest = (value: unknown): AgenticOsDocsMcpBridgeRequest | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const invocationTokens = normalizeAgenticOsDocsMcpInvocationTokens(
    (value as { invocationTokens?: unknown }).invocationTokens,
  )
  return invocationTokens.length > 0 ? { invocationTokens } : null
}
