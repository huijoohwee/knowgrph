import {
  KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
  buildKnowgrphAgentReadyToolContracts,
} from '@/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import {
  KNOWGRPH_AGENT_READY_PROMPT_NAMES,
  buildKnowgrphAgentReadyPromptContracts,
} from '@/features/agent-ready/knowgrphAgentReadyPromptContract.mjs'
import {
  KNOWGRPH_SOURCE_FILE_RESOURCE_MIME_TYPE,
  buildKnowgrphAgentReadyResourceTemplateContracts,
  buildKnowgrphSourceFileResourceUri,
} from '@/features/agent-ready/knowgrphAgentReadyResourceContract.mjs'
import {
  KNOWGRPH_MCP_APPS_EXTENSION_ID,
  KNOWGRPH_MCP_APPS_PROTOCOL_VERSION,
  KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
  KNOWGRPH_MCP_APP_RESOURCE_URI,
  KNOWGRPH_MCP_CLIENT_IDS,
  KNOWGRPH_MCP_REMOTE_TRANSPORT_TYPE,
} from '@/features/agent-ready/mcpAppsReadyContract.mjs'
import { buildAgentSurfaceInspectionPayload } from '@/features/agent-ready/agentSurfaceInspection.mjs'
import { createPublishedAgentReadyToolExecutors } from '@/features/agent-ready/publishedToolExecutors.mjs'
import { onRequest, buildAgentReadyStaticFiles } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'
import { buildKnowgrphCommerceDiscovery, buildKnowgrphX402PaymentRequiredResponse } from '../../../cloudflare/pages/knowgrph-agent-ready-commerce.mjs'

const EXPECTED_PUBLISHED_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: KNOWGRPH_AGENT_READY_DEFAULT_WORKSPACE_ID,
})
const EXPECTED_PROMPT_CONTRACTS = buildKnowgrphAgentReadyPromptContracts()
const EXPECTED_RESOURCE_TEMPLATE_CONTRACTS = buildKnowgrphAgentReadyResourceTemplateContracts()

const toComparableMcpToolEntry = (tool: Record<string, unknown>) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.inputSchema,
  outputSchema: tool.outputSchema,
  securitySchemes: tool.securitySchemes,
  annotations: tool.annotations,
  _meta: tool._meta,
})

const EXPECTED_MCP_TOOL_ENTRIES = EXPECTED_PUBLISHED_TOOL_CONTRACTS
  .map((tool) => toComparableMcpToolEntry(tool as unknown as Record<string, unknown>))
  .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))

const assertReadOnlyAnnotations = (tool: { name?: string, annotations?: Record<string, unknown> } | undefined): void => {
  if (
    tool?.annotations?.readOnlyHint !== true
    || tool.annotations.destructiveHint !== false
    || tool.annotations.openWorldHint !== false
    || tool.annotations.idempotentHint !== true
  ) {
    throw new Error(`expected complete read-only MCP annotations for ${String(tool?.name || 'unknown')}, got ${JSON.stringify(tool?.annotations)}`)
  }
}

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
      search: 'search',
      fetch: 'fetch',
      listSourceFiles: 'list_source_files',
      readSourceFile: 'read_source_file',
      readSharedDocument: 'read_shared_document',
      inspectSharedDocumentStructure: 'inspect_shared_document_structure',
      inspectAgentSurface: 'inspect_agent_surface',
    },
    defaultWorkspaceId: 'kgws:canonical-docs',
    publicBaseUrl: 'https://airvio.co',
    buildStorageDocPath: (canonicalPath: string, workspaceId = '') =>
      workspaceId ? `/api/storage/doc/${workspaceId}/${canonicalPath}` : `/api/storage/doc-default/${canonicalPath}`,
    fetchSourceFilesIndexResponse: async () => {
      fetchCalls.push('/api/storage/source-files')
      return createMockMarkdownResponse([
        '# Source Files',
        '- [Example](/api/storage/doc-default/docs%2Fexample.md)',
        '- [Shared](/api/storage/doc/wk_shared/docs%2Fshared.md) shared document notes',
      ].join('\n'))
    },
    fetchStorageMarkdownResponse: async (path: string) => {
      fetchCalls.push(path)
      return createMockMarkdownResponse(path.includes('docs/example.md')
        ? `# ${path}\n\nRenderer architecture includes runtime topology and MCP-ready canvas search evidence.`
        : `# ${path}`)
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
  const searchResult = await executors.search({ query: 'renderer architecture', limit: 5 }) as { ids?: string[], results?: Array<{ id?: string, canonicalPath?: string, url?: string }> }
  const contentSearchResult = await executors.search({ query: 'runtime topology', limit: 5 }) as { ids?: string[], results?: Array<{ id?: string, canonicalPath?: string, snippet?: string }> }
  const fetchResult = await executors.fetch({ id: searchResult.ids?.[0] }) as { id?: string, content?: string, text?: string, url?: string, metadata?: { canonicalPath?: string } }
  const sourceFileResourceUri = buildKnowgrphSourceFileResourceUri(String(fetchResult.id || ''))
  const readSourceResult = await executors.read_source_file({ canonicalPath: 'docs/example.md' })
  const readSharedResult = await executors.read_shared_document({ shareToken: 'share-token' })
  const inspectSharedResult = await executors.inspect_shared_document_structure({ shareUrl: '/knowgrph/share/share-token' })
  const inspectAgentSurfaceResult = await executors.inspect_agent_surface()

  if ((listResult as { workspaceId?: unknown }).workspaceId !== 'kgws:canonical-docs') {
    throw new Error(`expected list_source_files to default the workspace id, got ${JSON.stringify(listResult)}`)
  }
  if (!searchResult.ids?.[0] || searchResult.results?.[0]?.canonicalPath !== 'docs/example.md' || searchResult.results?.[0]?.url !== 'https://airvio.co/api/storage/doc-default/docs/example.md') {
    throw new Error(`expected search to return stable source-file ids from the Source Files index, got ${JSON.stringify(searchResult)}`)
  }
  if (!contentSearchResult.ids?.[0] || contentSearchResult.results?.[0]?.canonicalPath !== 'docs/example.md' || !contentSearchResult.results?.[0]?.snippet?.includes('runtime topology')) {
    throw new Error(`expected search to rank fetched markdown content, got ${JSON.stringify(contentSearchResult)}`)
  }
  if (!fetchResult.id?.startsWith('kgdoc::') || fetchResult.metadata?.canonicalPath !== 'docs/example.md' || fetchResult.url !== 'https://airvio.co/api/storage/doc-default/docs/example.md' || fetchResult.text !== fetchResult.content || !fetchResult.content?.includes('/api/storage/doc-default/docs/example.md')) {
    throw new Error(`expected fetch to resolve and read the source file id returned by search, got ${JSON.stringify(fetchResult)}`)
  }
  if (!sourceFileResourceUri.startsWith('kgdoc://source-file/')) {
    throw new Error(`expected stable Source Files resource URI from fetch id, got ${sourceFileResourceUri}`)
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
    || !String(staticMcpAppHtml.body || '').includes('window.openai')
    || !String(staticMcpAppHtml.body || '').includes('openai:set_globals')
    || !String(staticMcpAppHtml.body || '').includes('openaiAppsBridge')
    || !String(staticMcpAppHtml.body || '').includes('mcpAppsServerReadiness')
    || !String(staticMcpAppHtml.body || '').includes('MCP Apps server-ready')
  ) {
    throw new Error(`expected static MCP Apps HTML artifact to be generated from the shared app resource contract, got ${JSON.stringify(staticMcpAppHtml)}`)
  }
  if (!serverCard.capabilities?.extensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)) {
    throw new Error(`expected mcp server-card to advertise MCP Apps extension capability, got ${JSON.stringify(serverCard.capabilities)}`)
  }
  const removedSseFlag = ['leg', 'acySse'].join('')
  if (serverCard.transport?.type !== KNOWGRPH_MCP_REMOTE_TRANSPORT_TYPE || serverCard.transport?.stateless !== true || Object.prototype.hasOwnProperty.call(serverCard.transport || {}, removedSseFlag)) {
    throw new Error(`expected mcp server-card to advertise stateless Streamable HTTP without stale SSE flags, got ${JSON.stringify(serverCard.transport)}`)
  }
  const qwenSetup = serverCard.clientSetups?.[KNOWGRPH_MCP_CLIENT_IDS.qwenCode]
  if (qwenSetup?.transport !== 'http' || qwenSetup?.url !== 'https://airvio.co/knowgrph/mcp' || !String(qwenSetup?.command || '').includes('qwen mcp add --transport http knowgrph https://airvio.co/knowgrph/mcp') || qwenSetup?.settingsJson?.mcpServers?.knowgrph?.httpUrl !== 'https://airvio.co/knowgrph/mcp' || !qwenSetup.settingsJson.mcpServers.knowgrph.includeTools?.includes('search') || !qwenSetup.settingsJson.mcpServers.knowgrph.includeTools?.includes('fetch')) {
    throw new Error(`expected mcp server-card to advertise Qwen Code HTTP setup metadata, got ${JSON.stringify(qwenSetup)}`)
  }
  const kimiSetup = serverCard.clientSetups?.[KNOWGRPH_MCP_CLIENT_IDS.kimiCli]
  if (kimiSetup?.transport !== 'http' || kimiSetup?.url !== 'https://airvio.co/knowgrph/mcp' || !String(kimiSetup?.command || '').includes('kimi mcp add --transport http knowgrph https://airvio.co/knowgrph/mcp') || kimiSetup?.configFile !== '~/.kimi/mcp.json' || kimiSetup?.mcpJson?.mcpServers?.knowgrph?.url !== 'https://airvio.co/knowgrph/mcp' || kimiSetup?.mcpJson?.mcpServers?.knowgrph?.transport !== 'http') {
    throw new Error(`expected mcp server-card to advertise Kimi CLI HTTP setup metadata, got ${JSON.stringify(kimiSetup)}`)
  }
  const bytePlusSetup = serverCard.clientSetups?.[KNOWGRPH_MCP_CLIENT_IDS.bytePlusModelArk]
  if (bytePlusSetup?.transport !== KNOWGRPH_MCP_REMOTE_TRANSPORT_TYPE || bytePlusSetup?.url !== 'https://airvio.co/knowgrph/mcp' || bytePlusSetup?.endpoint !== '/responses' || bytePlusSetup?.requiredHeaders?.['ark-beta-mcp'] !== 'true' || bytePlusSetup?.tools?.[0]?.type !== 'mcp' || bytePlusSetup?.tools?.[0]?.server_label !== 'knowgrph' || bytePlusSetup?.tools?.[0]?.server_url !== 'https://airvio.co/knowgrph/mcp' || bytePlusSetup?.tools?.[0]?.require_approval !== 'never' || bytePlusSetup?.openAiCompatible?.responsesCreate?.tools?.[0]?.server_url !== 'https://airvio.co/knowgrph/mcp') {
    throw new Error(`expected mcp server-card to advertise BytePlus ModelArk Responses API MCP setup metadata, got ${JSON.stringify(bytePlusSetup)}`)
  }
  if (!serverCard.capabilities?.resources) {
    throw new Error(`expected mcp server-card to advertise resources capability, got ${JSON.stringify(serverCard.capabilities)}`)
  }
  if (JSON.stringify(serverCard.resourceTemplates) !== JSON.stringify(EXPECTED_RESOURCE_TEMPLATE_CONTRACTS)) {
    throw new Error(`expected mcp server-card to advertise shared resource templates, got ${JSON.stringify(serverCard.resourceTemplates)}`)
  }
  if (serverCard.capabilities?.prompts?.listChanged !== false || JSON.stringify(serverCard.prompts) !== JSON.stringify(EXPECTED_PROMPT_CONTRACTS)) {
    throw new Error(`expected mcp server-card to advertise shared prompt templates, got ${JSON.stringify({ capabilities: serverCard.capabilities?.prompts, prompts: serverCard.prompts })}`)
  }
  const serverCardTools = Array.isArray(serverCard.capabilities?.tools)
    ? serverCard.capabilities.tools
      .map((tool: Record<string, unknown>) => toComparableMcpToolEntry(tool || {}))
      .sort((left: { name?: unknown }, right: { name?: unknown }) => String(left.name || '').localeCompare(String(right.name || '')))
    : null
  if (!Array.isArray(serverCardTools) || JSON.stringify(serverCardTools) !== JSON.stringify(EXPECTED_MCP_TOOL_ENTRIES)) {
    throw new Error(`expected mcp server-card tools to match the shared contract exactly, got ${JSON.stringify(serverCardTools)}`)
  }
  const serverCardInspectTool = serverCard.capabilities.tools.find((tool: Record<string, unknown>) => tool?.name === 'inspect_agent_surface')
  const serverCardSearchTool = serverCard.capabilities.tools.find((tool: Record<string, unknown>) => tool?.name === 'search')
  const serverCardFetchTool = serverCard.capabilities.tools.find((tool: Record<string, unknown>) => tool?.name === 'fetch')
  if (serverCardSearchTool?.outputSchema?.type !== 'object' || !serverCardSearchTool.outputSchema.required?.includes('ids') || !serverCardSearchTool.outputSchema.required?.includes('results')) {
    throw new Error(`expected search server-card tool to expose deep-research ids outputSchema, got ${JSON.stringify(serverCardSearchTool)}`)
  }
  if (serverCardFetchTool?.outputSchema?.type !== 'object' || !serverCardFetchTool.outputSchema.required?.includes('content') || !serverCardFetchTool.outputSchema.required?.includes('text') || !serverCardFetchTool.outputSchema.required?.includes('url')) {
    throw new Error(`expected fetch server-card tool to expose content outputSchema, got ${JSON.stringify(serverCardFetchTool)}`)
  }
  if (serverCardInspectTool?._meta?.ui?.resourceUri !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected inspect_agent_surface server-card tool to link the MCP Apps UI resource, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (serverCardInspectTool?._meta?.['openai/outputTemplate'] !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected inspect_agent_surface server-card tool to expose OpenAI output template metadata, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (serverCardInspectTool?.securitySchemes?.[0]?.type !== 'noauth' || serverCardInspectTool?._meta?.securitySchemes?.[0]?.type !== 'noauth') {
    throw new Error(`expected inspect_agent_surface server-card tool to expose mirrored noauth security schemes, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (serverCardInspectTool?._meta?.['openai/widgetAccessible'] !== true) {
    throw new Error(`expected inspect_agent_surface server-card tool to expose OpenAI widget accessibility metadata, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (serverCardInspectTool?.outputSchema?.type !== 'object') {
    throw new Error(`expected inspect_agent_surface server-card tool to expose a structured outputSchema, got ${JSON.stringify(serverCardInspectTool)}`)
  }
  if (
    serverCard.surfaceRoles?.publicReadMcpUrl !== 'https://airvio.co/knowgrph/mcp'
    || serverCard.surfaceRoles?.controlPlaneMcpUrl !== 'https://airvio.co/knowgrph/control-plane/mcp'
    || serverCard.surfaceRoles?.remoteGrammarInvokePublic !== true
    || serverCard.surfaceRoles?.remoteGrammarInvokeToolName !== 'knowgrph.agentic_canvas_os.docs.invoke'
    || serverCard.surfaceRoles?.remoteGrammarInvokeStatus !== 'live-control-plane'
  ) {
    throw new Error(`expected mcp server-card surface roles to advertise live remote grammar invocation on the control plane, got ${JSON.stringify(serverCard.surfaceRoles)}`)
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
  if ((initializePayload.result?.capabilities as { prompts?: { listChanged?: boolean } } | undefined)?.prompts?.listChanged !== false) {
    throw new Error(`expected MCP initialize to advertise prompts capability, got ${JSON.stringify(initializePayload)}`)
  }
  const initializeExtensions = (initializePayload.result?.capabilities as { extensions?: Record<string, { mimeTypes?: string[] }> } | undefined)?.extensions
  if (!initializeExtensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)) {
    throw new Error(`expected MCP initialize to advertise MCP Apps mime type, got ${JSON.stringify(initializePayload)}`)
  }

  const transportMetadataResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'GET',
      headers: { accept: 'application/json' },
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const transportMetadata = await transportMetadataResponse.json() as { transport?: { type?: string, stateless?: boolean } & Record<string, unknown> }
  if (!transportMetadataResponse.ok || transportMetadata.transport?.type !== KNOWGRPH_MCP_REMOTE_TRANSPORT_TYPE || transportMetadata.transport?.stateless !== true || Object.prototype.hasOwnProperty.call(transportMetadata.transport || {}, removedSseFlag)) {
    throw new Error(`expected MCP GET metadata to advertise Streamable HTTP transport, got ${JSON.stringify(transportMetadata)}`)
  }

  const eventStreamGetResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', { method: 'GET', headers: { accept: 'text/event-stream' } }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const eventStreamGetBody = await eventStreamGetResponse.text()
  if (eventStreamGetResponse.status !== 405 || eventStreamGetBody !== '') {
    throw new Error(`expected MCP GET text/event-stream to be declined with empty 405, got ${eventStreamGetResponse.status} ${JSON.stringify(eventStreamGetBody)}`)
  }

  const initializedNotificationResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const initializedNotificationBody = await initializedNotificationResponse.text()
  if (initializedNotificationResponse.status !== 202 || initializedNotificationBody !== '') {
    throw new Error(`expected MCP client notification to be accepted with empty 202, got ${initializedNotificationResponse.status} ${JSON.stringify(initializedNotificationBody)}`)
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
    ? payload.result.tools
      .map((tool) => toComparableMcpToolEntry(tool || {}))
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
    : null
  if (!Array.isArray(tools) || JSON.stringify(tools) !== JSON.stringify(EXPECTED_MCP_TOOL_ENTRIES)) {
    throw new Error(`expected MCP tools/list payload to match the shared contract exactly, got ${JSON.stringify(tools)}`)
  }
  const inspectTool = payload.result?.tools?.find((tool) => tool?.name === 'inspect_agent_surface')
  const searchTool = payload.result?.tools?.find((tool) => tool?.name === 'search')
  const fetchTool = payload.result?.tools?.find((tool) => tool?.name === 'fetch')
  if (searchTool?.outputSchema?.type !== 'object' || !searchTool.outputSchema.required?.includes('ids') || !searchTool.outputSchema.required?.includes('results')) {
    throw new Error(`expected MCP tools/list search tool to expose ids outputSchema, got ${JSON.stringify(searchTool)}`)
  }
  assertReadOnlyAnnotations(searchTool)
  if (fetchTool?.outputSchema?.type !== 'object' || !fetchTool.outputSchema.required?.includes('content') || !fetchTool.outputSchema.required?.includes('text') || !fetchTool.outputSchema.required?.includes('url')) {
    throw new Error(`expected MCP tools/list fetch tool to expose content outputSchema, got ${JSON.stringify(fetchTool)}`)
  }
  assertReadOnlyAnnotations(fetchTool)
  if (inspectTool?._meta?.ui?.resourceUri !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to link the MCP Apps UI resource, got ${JSON.stringify(inspectTool)}`)
  }
  if (inspectTool?._meta?.['openai/outputTemplate'] !== KNOWGRPH_MCP_APP_RESOURCE_URI) {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to expose OpenAI output template metadata, got ${JSON.stringify(inspectTool)}`)
  }
  if (inspectTool?.securitySchemes?.[0]?.type !== 'noauth' || inspectTool?._meta?.securitySchemes?.[0]?.type !== 'noauth') {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to expose mirrored noauth security schemes, got ${JSON.stringify(inspectTool)}`)
  }
  if (inspectTool?._meta?.['openai/widgetAccessible'] !== true) {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to expose OpenAI widget accessibility metadata, got ${JSON.stringify(inspectTool)}`)
  }
  if (inspectTool?.outputSchema?.type !== 'object') {
    throw new Error(`expected MCP tools/list inspect_agent_surface tool to expose outputSchema, got ${JSON.stringify(inspectTool)}`)
  }
  assertReadOnlyAnnotations(inspectTool)

  const promptsListResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 13,
        method: 'prompts/list',
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const promptsListPayload = await promptsListResponse.json() as { result?: { prompts?: Array<any> } }
  if (!promptsListResponse.ok || JSON.stringify(promptsListPayload.result?.prompts) !== JSON.stringify(EXPECTED_PROMPT_CONTRACTS)) {
    throw new Error(`expected MCP prompts/list to return shared prompt templates, got ${JSON.stringify(promptsListPayload)}`)
  }

  const promptGetResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 14,
        method: 'prompts/get',
        params: {
          name: KNOWGRPH_AGENT_READY_PROMPT_NAMES.researchSourceFiles,
          arguments: {
            query: 'renderer architecture',
            limit: '3',
          },
        },
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const promptGetPayload = await promptGetResponse.json() as { result?: { messages?: Array<{ role?: string, content?: { type?: string, text?: string } }> } }
  const promptText = String(promptGetPayload.result?.messages?.[0]?.content?.text || '')
  if (!promptGetResponse.ok || promptGetPayload.result?.messages?.[0]?.role !== 'user' || !promptText.includes('Call search') || !promptText.includes('call fetch') || !promptText.includes('renderer architecture')) {
    throw new Error(`expected MCP prompts/get to render the Source Files research prompt, got ${JSON.stringify(promptGetPayload)}`)
  }

  const resourceTemplatesListResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 15,
        method: 'resources/templates/list',
      }),
    }),
    env: {},
    next: async () => new Response('unexpected next()'),
  } as never)
  const resourceTemplatesListPayload = await resourceTemplatesListResponse.json() as { result?: { resourceTemplates?: Array<any> } }
  if (!resourceTemplatesListResponse.ok || JSON.stringify(resourceTemplatesListPayload.result?.resourceTemplates) !== JSON.stringify(EXPECTED_RESOURCE_TEMPLATE_CONTRACTS)) {
    throw new Error(`expected MCP resources/templates/list to return shared Source Files resource templates, got ${JSON.stringify(resourceTemplatesListPayload)}`)
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
    || !String(appResourceContent?.text || '').includes('window.openai')
    || !String(appResourceContent?.text || '').includes('openai:set_globals')
    || !String(appResourceContent?.text || '').includes('openaiAppsBridge')
    || !String(appResourceContent?.text || '').includes('mcpAppsServerReadiness')
    || appResourceContent?._meta?.ui?.prefersBorder !== true
  ) {
    throw new Error(`expected MCP resources/read to return native MCP Apps HTML content, got ${JSON.stringify(resourcesReadPayload)}`)
  }

  const appPrefixedResourceResponse = await onRequest({
    request: new Request('https://airvio.co/knowgrph/.well-known/mcp/apps/knowgrph-agent-ready.html', {
      method: 'GET',
      headers: { accept: 'text/html' },
    }),
    env: {},
    next: async () => new Response('<!DOCTYPE html><div id="root"></div>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }),
  } as never)
  const appPrefixedResourceHtml = await appPrefixedResourceResponse.text()
  if (
    !appPrefixedResourceResponse.ok
    || !String(appPrefixedResourceResponse.headers.get('content-type') || '').includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)
    || !appPrefixedResourceHtml.includes(KNOWGRPH_MCP_APP_RESOURCE_URI)
    || !appPrefixedResourceHtml.includes('window.openai')
    || !appPrefixedResourceHtml.includes('openai:set_globals')
    || !appPrefixedResourceHtml.includes('openaiAppsBridge')
    || appPrefixedResourceHtml.includes('<div id="root"></div>')
  ) {
    throw new Error(`expected prefixed MCP Apps HTML route to return the shared app resource, got ${appPrefixedResourceResponse.status} ${appPrefixedResourceHtml.slice(0, 120)}`)
  }

  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/storage/doc-default/docs%2Fresource-template.md')) {
        return new Response('# Resource Template Source File', {
          status: 200,
          headers: { 'content-type': 'text/markdown' },
        })
      }
      return originalFetch(input, init)
    }) as typeof fetch
    const sourceFileResourceUri = buildKnowgrphSourceFileResourceUri('kgdoc::docs%2Fresource-template.md')
    const sourceFileReadResponse = await onRequest({
      request: new Request('https://airvio.co/knowgrph/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 16,
          method: 'resources/read',
          params: { uri: sourceFileResourceUri },
        }),
      }),
      env: {},
      next: async () => new Response('unexpected next()'),
    } as never)
    const sourceFileReadPayload = await sourceFileReadResponse.json() as { result?: { contents?: Array<any> } }
    const sourceFileContent = sourceFileReadPayload.result?.contents?.[0]
    if (!sourceFileReadResponse.ok || sourceFileContent?.uri !== sourceFileResourceUri || sourceFileContent?.mimeType !== KNOWGRPH_SOURCE_FILE_RESOURCE_MIME_TYPE || sourceFileContent?.text !== '# Resource Template Source File' || sourceFileContent?._meta?.metadata?.canonicalPath !== 'docs/resource-template.md') {
      throw new Error(`expected MCP resources/read to resolve Source Files resource URI through fetch, got ${JSON.stringify(sourceFileReadPayload)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
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
  const readiness = (inspectPayload.result?.structuredContent as {
    mcpAppsServerReadiness?: {
      ready?: boolean
      checklist?: Array<{ ok?: boolean }>
      prompts?: {
        ready?: boolean
        names?: string[]
        requiredPrompts?: string[]
      }
      resourceTemplates?: {
        ready?: boolean
        uriTemplates?: string[]
      }
      clients?: Record<string, any>
      tool?: {
        securitySchemes?: Array<{ type?: string }>
        mirroredSecuritySchemes?: Array<{ type?: string }>
        widgetAccessible?: boolean
        openAiWidgetBridge?: boolean
        annotationsReady?: boolean
        openWorld?: boolean
        destructive?: boolean
        idempotent?: boolean
      }
      retrieval?: {
        mode?: string
        tools?: Array<{
          name?: string
          readOnly?: boolean
          outputSchemaReady?: boolean
          annotationsReady?: boolean
          openWorld?: boolean
          destructive?: boolean
          idempotent?: boolean
          requiredOutputFields?: string[]
        }>
      }
    }
  } | undefined)?.mcpAppsServerReadiness
  if (readiness?.ready !== true || !Array.isArray(readiness.checklist) || !readiness.checklist.every((check) => check.ok === true)) {
    throw new Error(`expected inspect_agent_surface to expose complete MCP Apps server-readiness, got ${JSON.stringify(readiness)}`)
  }
  const readinessIds = readiness.checklist.map((check) => String((check as { id?: string }).id || ''))
  if (!readinessIds.includes('deep-research-search-fetch') || !readinessIds.includes('qwen-code-http-client-setup') || !readinessIds.includes('kimi-cli-http-client-setup') || !readinessIds.includes('byteplus-modelark-responses-mcp-setup') || !readinessIds.includes('openai-output-template') || !readinessIds.includes('openai-widget-bridge') || !readinessIds.includes('tool-security-schemes') || !readinessIds.includes('tool-impact-annotations') || !readinessIds.includes('widget-accessible') || !readinessIds.includes('prompt-discovery') || !readinessIds.includes('source-file-resource-template')) {
    throw new Error(`expected readiness to cover deep-research and OpenAI Apps metadata, got ${JSON.stringify(readiness)}`)
  }
  if (readiness.clients?.[KNOWGRPH_MCP_CLIENT_IDS.qwenCode]?.settingsJson?.mcpServers?.knowgrph?.httpUrl !== 'https://airvio.co/knowgrph/mcp') {
    throw new Error(`expected readiness clients to include Qwen Code HTTP setup, got ${JSON.stringify(readiness.clients)}`)
  }
  if (readiness.clients?.[KNOWGRPH_MCP_CLIENT_IDS.kimiCli]?.mcpJson?.mcpServers?.knowgrph?.url !== 'https://airvio.co/knowgrph/mcp') {
    throw new Error(`expected readiness clients to include Kimi CLI HTTP setup, got ${JSON.stringify(readiness.clients)}`)
  }
  if (readiness.clients?.[KNOWGRPH_MCP_CLIENT_IDS.bytePlusModelArk]?.tools?.[0]?.server_url !== 'https://airvio.co/knowgrph/mcp' || readiness.clients?.[KNOWGRPH_MCP_CLIENT_IDS.bytePlusModelArk]?.requiredHeaders?.['ark-beta-mcp'] !== 'true') {
    throw new Error(`expected readiness clients to include BytePlus ModelArk Responses API MCP setup, got ${JSON.stringify(readiness.clients)}`)
  }
  if (readiness.prompts?.ready !== true || !readiness.prompts.names?.includes(KNOWGRPH_AGENT_READY_PROMPT_NAMES.researchSourceFiles) || !readiness.prompts.names?.includes(KNOWGRPH_AGENT_READY_PROMPT_NAMES.inspectAgentSurface)) {
    throw new Error(`expected readiness prompt details to prove shared prompt discovery, got ${JSON.stringify(readiness.prompts)}`)
  }
  if (readiness.resourceTemplates?.ready !== true || !readiness.resourceTemplates.uriTemplates?.includes(EXPECTED_RESOURCE_TEMPLATE_CONTRACTS[0].uriTemplate)) {
    throw new Error(`expected readiness resource-template details to prove Source Files template discovery, got ${JSON.stringify(readiness.resourceTemplates)}`)
  }
  if (readiness.tool?.securitySchemes?.[0]?.type !== 'noauth' || readiness.tool?.mirroredSecuritySchemes?.[0]?.type !== 'noauth' || readiness.tool?.widgetAccessible !== true || readiness.tool?.openAiWidgetBridge !== true || readiness.tool?.annotationsReady !== true || readiness.tool?.openWorld !== false || readiness.tool?.destructive !== false || readiness.tool?.idempotent !== true) {
    throw new Error(`expected readiness tool details to prove mirrored noauth security, widget accessibility, and complete read-only annotations, got ${JSON.stringify(readiness.tool)}`)
  }
  if (
    readiness.retrieval?.mode !== 'deep-research-search-fetch'
    || !readiness.retrieval.tools?.every((tool) => tool.readOnly === true && tool.outputSchemaReady === true && tool.annotationsReady === true && tool.openWorld === false && tool.destructive === false && tool.idempotent === true)
    || !readiness.retrieval.tools?.some((tool) => tool.name === 'search' && tool.requiredOutputFields?.includes('ids'))
    || !readiness.retrieval.tools?.some((tool) => tool.name === 'fetch' && tool.requiredOutputFields?.includes('content') && tool.requiredOutputFields?.includes('text'))
  ) {
    throw new Error(`expected readiness retrieval details to prove search/fetch output-schema compatibility, got ${JSON.stringify(readiness.retrieval)}`)
  }
}
