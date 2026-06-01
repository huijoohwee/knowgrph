import { buildKnowgrphAgentReadyToolContracts } from '@/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import {
  KNOWGRPH_MCP_APPS_EXTENSION_ID,
  KNOWGRPH_MCP_APPS_PROTOCOL_VERSION,
  KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
  KNOWGRPH_MCP_APP_RESOURCE_URI,
} from '@/features/agent-ready/mcpAppsReadyContract.mjs'
import { buildAgentSurfaceInspectionPayload } from '@/features/agent-ready/agentSurfaceInspection.mjs'
import { createPublishedAgentReadyToolExecutors } from '@/features/agent-ready/publishedToolExecutors.mjs'
import { onRequest, buildAgentReadyStaticFiles } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'
import { buildKnowgrphCommerceDiscovery, buildKnowgrphX402PaymentRequiredResponse } from '../../../cloudflare/pages/knowgrph-agent-ready-commerce.mjs'

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
  const staticMcpAppHtml = staticArtifacts['.well-known/mcp/apps/knowgrph-agent-ready.html']
  const acpDiscovery = JSON.parse(staticArtifacts['.well-known/acp.json'].body)
  const ucpProfile = JSON.parse(staticArtifacts['.well-known/ucp'].body)
  const mppOpenApi = JSON.parse(staticArtifacts['openapi.json'].body)
  if (acpDiscovery.protocol?.name !== 'acp' || !acpDiscovery.protocol?.supported_versions?.includes(acpDiscovery.protocol.version) || !acpDiscovery.transports?.includes('rest') || !acpDiscovery.capabilities?.services?.includes('checkout')) {
    throw new Error(`expected root ACP discovery static artifact, got ${JSON.stringify(acpDiscovery)}`)
  }
  if (!ucpProfile.ucp?.services || !ucpProfile.ucp.capabilities || !ucpProfile.ucp.payment_handlers || !ucpProfile.ucp.endpoints?.x402_payment_required || !Array.isArray(ucpProfile.services) || !ucpProfile.endpoints?.x402_payment_required) {
    throw new Error(`expected root UCP profile static artifact, got ${JSON.stringify(ucpProfile)}`)
  }
  if (!Object.values(mppOpenApi.paths || {}).some((pathItem: unknown) => Object.values(pathItem as Record<string, Record<string, unknown>> || {}).some((operation) => operation['x-payment-info']))) {
    throw new Error(`expected root MPP OpenAPI static artifact with x-payment-info, got ${JSON.stringify(mppOpenApi)}`)
  }
  const paymentRequired = await buildKnowgrphX402PaymentRequiredResponse(new Request('https://airvio.co/api/payments/commerce/x402'), {}).json() as { accepts?: unknown[] }
  if (!Array.isArray(paymentRequired.accepts) || paymentRequired.accepts.length <= 0) {
    throw new Error(`expected x402 payment-required response body, got ${JSON.stringify(paymentRequired)}`)
  }
  if (
    !staticMcpAppHtml
    || !String(staticMcpAppHtml.contentType || '').includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)
    || !String(staticMcpAppHtml.body || '').includes(KNOWGRPH_MCP_APP_RESOURCE_URI)
    || !String(staticMcpAppHtml.body || '').includes(KNOWGRPH_MCP_APPS_PROTOCOL_VERSION)
    || !String(staticMcpAppHtml.body || '').includes("request('ui/initialize'")
    || !String(staticMcpAppHtml.body || '').includes('appCapabilities')
    || !String(staticMcpAppHtml.body || '').includes('ui/notifications/initialized')
    || !String(staticMcpAppHtml.body || '').includes('ui/notifications/size-changed')
    || !String(staticMcpAppHtml.body || '').includes('ui/notifications/host-context-changed')
    || !String(staticMcpAppHtml.body || '').includes('mcpAppsServerReadiness')
    || !String(staticMcpAppHtml.body || '').includes('MCP Apps server-ready')
  ) {
    throw new Error(`expected static MCP Apps HTML artifact to be generated from the shared app resource contract, got ${JSON.stringify(staticMcpAppHtml)}`)
  }
  if (!serverCard.capabilities?.extensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)) {
    throw new Error(`expected mcp server-card to advertise MCP Apps extension capability, got ${JSON.stringify(serverCard.capabilities)}`)
  }
  if (!serverCard.capabilities?.resources) {
    throw new Error(`expected mcp server-card to advertise resources capability, got ${JSON.stringify(serverCard.capabilities)}`)
  }
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
  const serverCardInspectTool = serverCard.capabilities.tools.find((tool: Record<string, unknown>) => tool?.name === 'inspect_agent_surface')
  if (serverCardInspectTool?._meta?.ui?.resourceUri !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected inspect_agent_surface server-card tool to link the MCP Apps UI resource, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (serverCardInspectTool?.outputSchema?.type !== 'object') {
    throw new Error(`expected inspect_agent_surface server-card tool to expose a structured outputSchema, got ${JSON.stringify(serverCardInspectTool)}`)
  }

  const initializeResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {
            extensions: {
              [KNOWGRPH_MCP_APPS_EXTENSION_ID]: {
                mimeTypes: [KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE],
              },
            },
          },
          clientInfo: { name: 'knowgrph-test-host', version: '1.0.0' },
        },
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)

  const initializePayload = await initializeResponse.json() as { result?: { capabilities?: Record<string, unknown> } }
  if (!initializeResponse.ok || !(initializePayload.result?.capabilities as Record<string, unknown>)?.resources) {
    throw new Error(`expected MCP initialize to advertise resources, got ${JSON.stringify(initializePayload)}`)
  }
  const initializeExtensions = (initializePayload.result?.capabilities as { extensions?: Record<string, { mimeTypes?: string[] }> } | undefined)?.extensions
  if (!initializeExtensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)) {
    throw new Error(`expected MCP initialize to advertise MCP Apps mime type, got ${JSON.stringify(initializePayload)}`)
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
  const payload = await response.json() as { result?: { tools?: Array<any> } }
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
  const inspectTool = payload.result?.tools?.find((tool) => tool?.name === 'inspect_agent_surface')
  if (inspectTool?._meta?.ui?.resourceUri !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to link the MCP Apps UI resource, got ${JSON.stringify(inspectTool)}`)
  }
  if (inspectTool?.outputSchema?.type !== 'object') {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to expose outputSchema, got ${JSON.stringify(inspectTool)}`)
  }

  const resourcesListResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 11,
        method: 'resources/list',
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const resourcesListPayload = await resourcesListResponse.json() as { result?: { resources?: Array<any> } }
  const appResource = resourcesListPayload.result?.resources?.find((resource) => resource?.uri === KNOWGRPH_MCP_APP_RESOURCE_URI)
  if (!resourcesListResponse.ok || appResource?.mimeType !== KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE || appResource?._meta?.ui?.prefersBorder !== true) {
    throw new Error(`expected MCP resources/list to expose the MCP Apps HTML resource, got ${JSON.stringify(resourcesListPayload)}`)
  }

  const resourcesReadResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 12,
        method: 'resources/read',
        params: { uri: KNOWGRPH_MCP_APP_RESOURCE_URI },
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const resourcesReadPayload = await resourcesReadResponse.json() as { result?: { contents?: Array<any> } }
  const appResourceContent = resourcesReadPayload.result?.contents?.[0]
  if (
    !resourcesReadResponse.ok
    || appResourceContent?.mimeType !== KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE
    || !String(appResourceContent?.text || '').includes("request('ui/initialize'")
    || !String(appResourceContent?.text || '').includes('ui/notifications/tool-result')
    || !String(appResourceContent?.text || '').includes('ui/notifications/tool-input-partial')
    || !String(appResourceContent?.text || '').includes('ui/notifications/tool-cancelled')
    || !String(appResourceContent?.text || '').includes('ui/notifications/size-changed')
    || !String(appResourceContent?.text || '').includes('mcpAppsServerReadiness')
    || appResourceContent?._meta?.ui?.prefersBorder !== true
  ) {
    throw new Error(`expected MCP resources/read to return native MCP Apps HTML content, got ${JSON.stringify(resourcesReadPayload)}`)
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
    commerce: buildKnowgrphCommerceDiscovery({ origin: 'https://airvio.co' }),
  })
  if (JSON.stringify(inspectPayload.result?.structuredContent) !== JSON.stringify(expectedInspection)) {
    throw new Error(`expected MCP inspect_agent_surface payload to match the shared inspection payload exactly, got ${JSON.stringify(inspectPayload.result?.structuredContent)}`)
  }
  const readiness = (inspectPayload.result?.structuredContent as { mcpAppsServerReadiness?: { ready?: boolean, checklist?: Array<{ ok?: boolean }> } } | undefined)?.mcpAppsServerReadiness
  if (readiness?.ready !== true || !Array.isArray(readiness.checklist) || !readiness.checklist.every((check) => check.ok === true)) {
    throw new Error(`expected inspect_agent_surface to expose complete MCP Apps server-readiness, got ${JSON.stringify(readiness)}`)
  }
}
