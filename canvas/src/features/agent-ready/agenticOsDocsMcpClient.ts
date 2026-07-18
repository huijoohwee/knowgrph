import {
  AGENTIC_OS_DOCS_MCP_BRIDGE_PATH,
  normalizeAgenticOsDocsMcpBridgeRequest,
  type AgenticOsDocsMcpBridgeRequest,
  type AgenticOsDocsMcpBridgeSuccess,
} from './agenticOsDocsMcpBridgeContract'

const readFailureMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { error?: unknown }
    return String(payload?.error || '').trim()
  } catch {
    return ''
  }
}

export async function invokeAgenticOsDocsMcpBridge(
  request: AgenticOsDocsMcpBridgeRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<AgenticOsDocsMcpBridgeSuccess> {
  const boundedRequest = normalizeAgenticOsDocsMcpBridgeRequest(request)
  if (!boundedRequest) throw new Error('Agentic OS docs MCP request requires at least one valid invocation token.')
  const response = await fetchImpl(AGENTIC_OS_DOCS_MCP_BRIDGE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boundedRequest),
  })
  if (!response.ok) {
    throw new Error(await readFailureMessage(response) || `Agentic OS docs MCP bridge failed (${response.status}).`)
  }
  const payload = await response.json() as Partial<AgenticOsDocsMcpBridgeSuccess> & { error?: unknown }
  if (payload.ok !== true || payload.mcpInvoked !== true || !Array.isArray(payload.invocations)) {
    throw new Error(String(payload.error || '').trim() || 'Agentic OS docs MCP bridge returned an invalid response.')
  }
  return payload as AgenticOsDocsMcpBridgeSuccess
}
