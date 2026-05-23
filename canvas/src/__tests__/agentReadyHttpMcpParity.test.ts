import { buildKnowgrphAgentReadyToolContracts } from '@/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import { buildAgentSurfaceInspectionPayload } from '@/features/agent-ready/agentSurfaceInspection.mjs'
import { createPublishedAgentReadyToolExecutors } from '@/features/agent-ready/publishedToolExecutors.mjs'
import { onRequest, buildAgentReadyStaticFiles } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'

const EXPECTED_PUBLISHED_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: 'kgws:canonical-docs',
})

const EXPECTED_MCP_TOOL_ENTRIES = EXPECTED_PUBLISHED_TOOL_CONTRACTS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
})).sort((left, right) => left.name.localeCompare(right.name))

const createMockMarkdownResponse = (body: string, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }) as Response

const requestAgentReadyJson = async (pathname: string): Promise<unknown> => {
  const response = await onRequest({
    request: new Request(`https://airvio.co${pathname}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  if (!response.ok) {
    throw new Error(`expected GET ${pathname} to succeed, received ${response.status}`)
  }
  return response.json()
}

export async function testPublishedToolExecutorsSharePublishedBehavior(): Promise<void> {
  const fetchCalls: string[] = []
  const executors = createPublishedAgentReadyToolExecutors({
    toolNames: {
      listSourceFiles: 'list_source_files',
      readSourceFile: 'read_source_file',
      readSharedDocument: 'read_shared_document',
      inspectSharedDocumentStructure: 'inspect_shared_document_structure',
      inspectAgentSurface: 'inspect_agent_surface',
    },
    defaultWorkspaceId: 'kgws:canonical-docs',
    buildStorageDocPath: (canonicalPath: string, workspaceId = '') =>
      workspaceId ? `/api/storage/doc/${workspaceId}/${canonicalPath}` : `/api/storage/doc-default/${canonicalPath}`,
    fetchSourceFilesIndexResponse: async () => {
      fetchCalls.push('/api/storage/source-files')
      return createMockMarkdownResponse('# Source Files')
    },
    fetchStorageMarkdownResponse: async (path: string) => {
      fetchCalls.push(path)
      return createMockMarkdownResponse(`# ${path}`)
    },
    resolveSharedDocumentInput: (input?: Record<string, unknown>) =>
      input?.shareToken || input?.shareUrl
        ? { workspaceId: 'wk_shared', canonicalPath: 'docs/shared.md' }
        : null,
    inspectSharedDocumentStructure: ({ workspaceId, canonicalPath, markdown }: Record<string, unknown>) => ({
      available: true,
      workspaceId,
      canonicalPath,
      markdownLength: String(markdown || '').length,
    }),
    buildAgentSurfaceInspection: async () => ({ ok: true, baseUrl: 'https://airvio.co/knowgrph' }),
  })

  const listResult = await executors.list_source_files()
  const readSourceResult = await executors.read_source_file({ canonicalPath: 'docs/example.md' })
  const readSharedResult = await executors.read_shared_document({ shareToken: 'share-token' })
  const inspectSharedResult = await executors.inspect_shared_document_structure({ shareUrl: '/knowgrph/share/share-token' })
  const inspectAgentSurfaceResult = await executors.inspect_agent_surface()

  if ((listResult as { workspaceId?: unknown }).workspaceId !== 'kgws:canonical-docs') {
    throw new Error(`expected list_source_files to default the workspace id, got ${JSON.stringify(listResult)}`)
  }
  if ((readSourceResult as { canonicalPath?: unknown }).canonicalPath !== 'docs/example.md') {
    throw new Error(`expected read_source_file to preserve the requested canonical path, got ${JSON.stringify(readSourceResult)}`)
  }
  if ((readSharedResult as { workspaceId?: unknown }).workspaceId !== 'wk_shared') {
    throw new Error(`expected read_shared_document to resolve the shared workspace id, got ${JSON.stringify(readSharedResult)}`)
  }
  if ((inspectSharedResult as { markdownLength?: unknown }).markdownLength !== '# /api/storage/doc/wk_shared/docs/shared.md'.length) {
    throw new Error(`expected inspect_shared_document_structure to inspect the fetched shared markdown, got ${JSON.stringify(inspectSharedResult)}`)
  }
  if ((inspectAgentSurfaceResult as { ok?: unknown }).ok !== true) {
    throw new Error(`expected inspect_agent_surface to return the injected agent-surface payload, got ${JSON.stringify(inspectAgentSurfaceResult)}`)
  }
  if (!fetchCalls.includes('/api/storage/source-files')) {
    throw new Error(`expected list_source_files to fetch the source-files index, got ${fetchCalls.join(', ')}`)
  }
  if (!fetchCalls.includes('/api/storage/doc-default/docs/example.md')) {
    throw new Error(`expected read_source_file to fetch the default doc path, got ${fetchCalls.join(', ')}`)
  }
  if (!fetchCalls.includes('/api/storage/doc/wk_shared/docs/shared.md')) {
    throw new Error(`expected shared-document executors to fetch the resolved shared doc path, got ${fetchCalls.join(', ')}`)
  }
}

export async function testAgentReadyHttpMcpTransportMatchesSharedContractExactly(): Promise<void> {
  const staticArtifacts = await buildAgentReadyStaticFiles()
  const serverCard = JSON.parse(staticArtifacts['.well-known/mcp/server-card.json'].body)
  const serverCardTools = Array.isArray(serverCard.capabilities?.tools)
    ? serverCard.capabilities.tools.map((tool: Record<string, unknown>) => ({
        name: tool?.name,
        description: tool?.description,
        inputSchema: tool?.inputSchema || {},
      })).sort((left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name))
    : null
  if (!Array.isArray(serverCardTools) || JSON.stringify(serverCardTools) !== JSON.stringify(EXPECTED_MCP_TOOL_ENTRIES)) {
    throw new Error(`expected mcp server-card tools to match the shared contract exactly, got ${JSON.stringify(serverCardTools)}`)
  }

  const response = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)

  if (!response.ok) {
    throw new Error(`expected MCP tools/list to succeed, received ${response.status}`)
  }
  const payload = await response.json() as { result?: { tools?: Array<Record<string, unknown>> } }
  const tools = Array.isArray(payload.result?.tools)
    ? payload.result.tools.map((tool) => ({
        name: tool?.name,
        description: tool?.description,
        inputSchema: tool?.inputSchema || {},
      })).sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
    : null
  if (!Array.isArray(tools) || JSON.stringify(tools) !== JSON.stringify(EXPECTED_MCP_TOOL_ENTRIES)) {
    throw new Error(`expected MCP tools/list payload to match the shared contract exactly, got ${JSON.stringify(tools)}`)
  }

  const inspectResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'inspect_agent_surface',
          arguments: {},
        },
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)

  if (!inspectResponse.ok) {
    throw new Error(`expected MCP inspect_agent_surface to succeed, received ${inspectResponse.status}`)
  }
  const inspectPayload = await inspectResponse.json() as { result?: { structuredContent?: unknown } }
  const expectedInspection = buildAgentSurfaceInspectionPayload({
    baseUrl: 'https://airvio.co/knowgrph',
    health: await requestAgentReadyJson('/knowgrph/health'),
    apiCatalog: await requestAgentReadyJson('/knowgrph/.well-known/api-catalog'),
    openApi: await requestAgentReadyJson('/knowgrph/.well-known/openapi.json'),
    mcpServerCard: await requestAgentReadyJson('/knowgrph/.well-known/mcp/server-card.json'),
    agentCard: await requestAgentReadyJson('/knowgrph/.well-known/agent-card.json'),
    agentSkills: await requestAgentReadyJson('/knowgrph/.well-known/agent-skills/index.json'),
  })
  if (JSON.stringify(inspectPayload.result?.structuredContent) !== JSON.stringify(expectedInspection)) {
    throw new Error(`expected MCP inspect_agent_surface payload to match the shared inspection payload exactly, got ${JSON.stringify(inspectPayload.result?.structuredContent)}`)
  }
}
