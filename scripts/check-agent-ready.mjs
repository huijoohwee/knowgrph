import { buildKnowgrphAgentReadyToolContracts } from '../canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import {
  KNOWGRPH_MCP_APPS_EXTENSION_ID,
  KNOWGRPH_MCP_APPS_PROTOCOL_VERSION,
  KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
  KNOWGRPH_MCP_APP_RESOURCE_URI,
} from '../canvas/src/features/agent-ready/mcpAppsReadyContract.mjs'
import { encodePublishedDocShareToken, PUBLISHED_DOC_SHARE_TOKEN_PARAM } from '../canvas/src/features/canvas/canvasDocShareToken.mjs'
import { buildAgentReadyDiscoveryExpectations } from '../cloudflare/pages/knowgrph-agent-ready-discovery.mjs'
import { buildAgentReadyCommerceChecks } from './agent-ready-commerce-checks.mjs'

const canonicalOriginUrl = 'https://airvio.co'
const canonicalBaseUrl = `${canonicalOriginUrl}/knowgrph`
const baseUrl = (process.env.KNOWGRPH_AGENT_READY_BASE_URL || canonicalBaseUrl).replace(/\/+$/, '')
const originUrl = new URL(baseUrl).origin
const rootA2aAgentCardUrl = `${originUrl}/.well-known/agent-card.json`
const appBasePath = new URL(baseUrl).pathname.replace(/\/+$/, '') || '/'
const expectedTools = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: 'kgws:canonical-docs',
})
const expectedMcpToolEntries = expectedTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
})).sort((left, right) => left.name.localeCompare(right.name))
const expectedBrowserOnlyTools = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: 'kgws:canonical-docs',
  includeBrowserOnlyTools: true,
}).filter((tool) => !expectedTools.some((sharedTool) => sharedTool.webName === tool.webName))
const expectedWebToolNames = expectedTools.map((tool) => tool.webName)
const expectedBrowserOnlyWebToolNames = expectedBrowserOnlyTools.map((tool) => tool.webName)
const expectedDiscovery = buildAgentReadyDiscoveryExpectations({
  appBasePath,
  appA2aAgentCardPath: `${appBasePath}/.well-known/agent-card.json`,
  healthPath: `${appBasePath}/health`,
  toolContracts: expectedTools,
})
const expectedOpenApiPathKeys = expectedDiscovery.openApiPathKeys
const expectedA2aSkills = expectedDiscovery.a2aSkills
const expectedAgentSkills = expectedDiscovery.agentSkills
const expectedAgentSkillNames = expectedAgentSkills.map((skill) => skill.name)
const includesAll = (values, expected) => Array.isArray(values) && expected.every(value => values.includes(value))
const hasExpectedAuthResourceReference = (payload) => payload.resource === `${baseUrl}/` && includesAll(payload.authorization_servers, [originUrl]) && includesAll(payload.scopes_supported, ['knowgrph:read'])
const hasExpectedProtectedResource = (payload) => hasExpectedAuthResourceReference(payload) && includesAll(payload.bearer_methods_supported, ['header'])
const hasExpectedAgentAuth = (agentAuth) => agentAuth?.skill === `${originUrl}/auth.md` && agentAuth?.register_uri === `${baseUrl}/agent/auth` && agentAuth?.claim_uri === `${baseUrl}/agent/auth/claim` && agentAuth?.revocation_uri === `${baseUrl}/agent/auth/revoke` && includesAll(agentAuth?.identity_types_supported, ['anonymous', 'identity_assertion']) && includesAll(agentAuth?.anonymous?.credential_types_supported, ['api_key']) && includesAll(agentAuth?.identity_assertion?.assertion_types_supported, ['urn:ietf:params:oauth:token-type:id-jag', 'verified_email']) && includesAll(agentAuth?.identity_assertion?.credential_types_supported, ['access_token', 'api_key']) && includesAll(agentAuth?.events_supported, ['https://schemas.workos.com/events/agent/auth/identity/assertion/revoked'])
const preferredSharedDocSample = {
  workspaceId: 'kgws:canonical-docs',
  canonicalPath: 'huijoohwee/docs/knowgrph-design-demo.md',
}
const buildSharedDocSample = async ({ workspaceId, canonicalPath }) => {
  const encodedWorkspaceId = workspaceId ? encodeURIComponent(workspaceId) : ''
  const encodedCanonicalPath = encodeURIComponent(canonicalPath)
  const shareToken = encodePublishedDocShareToken({ workspaceId, canonicalPath })
  const storagePath = workspaceId
    ? `/api/storage/doc/${encodedWorkspaceId}/${encodedCanonicalPath}`
    : `/api/storage/doc-default/${encodedCanonicalPath}`
  const markdownResponse = await fetch(`${canonicalOriginUrl}${storagePath}`, {
    headers: { accept: 'text/markdown' },
  })
  if (!markdownResponse.ok) return null
  return {
    workspaceId,
    canonicalPath,
    markdown: await markdownResponse.text(),
    shareUrl: `${baseUrl}/share/${encodeURIComponent(shareToken)}`,
  }
}

const resolveSharedDocSampleFromIndex = async () => {
  const response = await fetch(`${canonicalOriginUrl}/api/storage/source-files`, {
    headers: { accept: 'text/markdown' },
  })
  if (!response.ok) return null
  const body = await response.text()
  const match = body.match(/\/api\/storage\/doc(?:-default)?\/([A-Za-z0-9._~!$&'()*+,;=:@%-]+)(?:\/([A-Za-z0-9._~!$&'()*+,;=:@%-]+))?/)
  if (!match?.[1]) return null
  const hasWorkspaceId = typeof match[2] === 'string'
  const encodedWorkspaceId = hasWorkspaceId ? match[1] : ''
  const encodedCanonicalPath = hasWorkspaceId ? String(match[2] || '') : match[1]
  const workspaceId = encodedWorkspaceId ? decodeURIComponent(encodedWorkspaceId) : ''
  const canonicalPath = decodeURIComponent(encodedCanonicalPath)
  const storagePath = workspaceId
    ? `/api/storage/doc/${encodedWorkspaceId}/${encodedCanonicalPath}`
    : `/api/storage/doc-default/${encodedCanonicalPath}`
  return buildSharedDocSample({
    workspaceId,
    canonicalPath,
  })
}

const sharedDocSample = await buildSharedDocSample(preferredSharedDocSample) || await resolveSharedDocSampleFromIndex()

const sharedDocAliasUrls = sharedDocSample
  ? {
      kgShare: `${baseUrl}/?${PUBLISHED_DOC_SHARE_TOKEN_PARAM}=${encodeURIComponent(encodePublishedDocShareToken({
        workspaceId: sharedDocSample.workspaceId,
        canonicalPath: sharedDocSample.canonicalPath,
      }))}`,
      kgWorkspaceCanonical: `${baseUrl}/?kgWorkspaceId=${encodeURIComponent(sharedDocSample.workspaceId)}&kgCanonicalPath=${encodeURIComponent(sharedDocSample.canonicalPath)}`,
      kgPath: `${baseUrl}/?kgPath=${encodeURIComponent(`/doc/${sharedDocSample.workspaceId}/${sharedDocSample.canonicalPath}`)}`,
    }
  : null

const isRootRedirectHtml = (body) => {
  const text = String(body || '')
  return text.includes('Root entrypoint for airvio.co')
    && text.includes('url=/knowgrph/')
    && text.includes('<title>Knowgrph</title>')
}

const describeFailure = (checkName, response, body) => {
  const contentType = response.headers.get('content-type') || ''
  const routeOwner = response.headers.get('x-knowgrph-route-owner') || ''
  const routeTag = response.headers.get('x-knowgrph-route-tag') || ''
  if (checkName === 'shared-doc-markdown-negotiation' && isRootRedirectHtml(body)) {
    return `${response.status} ${contentType} (received apex root redirect HTML instead of shared markdown; routeOwner=${routeOwner || 'missing'}; routeTag=${routeTag || 'missing'})`
  }
  if (routeOwner || routeTag) {
    return `${response.status} ${contentType} (routeOwner=${routeOwner || 'missing'}; routeTag=${routeTag || 'missing'})`
  }
  return `${response.status} ${contentType}`
}

const checks = [
  {
    name: 'robots',
    url: `${baseUrl}/robots.txt`,
    accept: '*/*',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/plain')
      && /User-agent: GPTBot/.test(body)
      && /Content-Signal: ai-train=no, search=yes, ai-input=yes/.test(body)
      && /Sitemap:/.test(body),
  },
  {
    name: 'sitemap',
    url: `${baseUrl}/sitemap.xml`,
    accept: '*/*',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('application/xml')
      && /<urlset\b/.test(body)
      && /<loc>/.test(body)
      && /<lastmod>/.test(body),
  },
  {
    name: 'link-headers',
    url: `${baseUrl}/`,
    method: 'HEAD',
    accept: '*/*',
    assert: async (response) => {
      const link = response.headers.get('link') || ''
      return response.ok
        && link.includes('</.well-known/api-catalog>; rel="api-catalog"')
        && link.includes('rel="service-desc"')
        && link.includes('rel="service-doc"')
        && link.includes('rel="status"')
        && link.includes('rel="mcp-server-card"')
        && link.includes('rel="describedby"')
    },
  },
  {
    name: 'root-homepage-link-headers',
    url: `${originUrl}/`,
    method: 'HEAD',
    accept: '*/*',
    assert: async (response) => {
      const link = response.headers.get('link') || ''
      return response.ok
        && link.includes('</.well-known/api-catalog>; rel="api-catalog"')
        && link.includes('rel="service-desc"')
        && link.includes('rel="service-doc"')
        && link.includes('rel="status"')
        && link.includes('rel="mcp-server-card"')
        && link.includes('</.well-known/agent-card.json>; rel="describedby"')
    },
  },
  {
    name: 'root-markdown-negotiation',
    url: `${originUrl}/`,
    accept: 'text/markdown',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/markdown')
      && Number(response.headers.get('x-markdown-tokens') || 0) > 0
      && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
      && body.trim().startsWith('# Knowgrph'),
  },
  {
    name: 'root-homepage-app-alias',
    url: `${originUrl}/`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/html')
      && body.includes('<div id="root"></div>')
      && body.includes('/knowgrph/assets/')
      && body.includes('name="x-knowgrph-root-alias" content="/knowgrph/"')
      && body.includes('id="knowgrph-root-fallback"')
      && body.includes('data-knowgrph-root-fallback="visible"')
      && body.includes('Agent-actionable chat-to-canvas knowledge graph workspace')
      && !body.includes(['Agent-readable', 'knowledge graph workspace'].join(' '))
      && !/http-equiv=["']refresh["']/i.test(body)
      && !body.includes('url=/knowgrph/'),
  },
  {
    name: 'markdown-negotiation',
    url: `${baseUrl}/`,
    accept: 'text/markdown',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/markdown')
      && Number(response.headers.get('x-markdown-tokens') || 0) > 0
      && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
      && body.trim().startsWith('# Knowgrph'),
  },
  ...(sharedDocSample
    ? [{
        name: 'shared-doc-markdown-negotiation',
        url: sharedDocSample.shareUrl,
        accept: 'text/markdown',
        assert: async (response, body) =>
          response.ok
          && response.headers.get('content-type')?.includes('text/markdown')
          && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
          && body.trim() === sharedDocSample.markdown.trim(),
      }, {
        name: 'shared-doc-markdown-negotiation-kgshare-alias',
        url: sharedDocAliasUrls.kgShare,
        accept: 'text/markdown',
        assert: async (response, body) =>
          response.ok
          && response.headers.get('content-type')?.includes('text/markdown')
          && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
          && body.trim() === sharedDocSample.markdown.trim(),
      }, {
        name: 'shared-doc-markdown-negotiation-kgworkspace-canonical-alias',
        url: sharedDocAliasUrls.kgWorkspaceCanonical,
        accept: 'text/markdown',
        assert: async (response, body) =>
          response.ok
          && response.headers.get('content-type')?.includes('text/markdown')
          && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
          && body.trim() === sharedDocSample.markdown.trim(),
      }, {
        name: 'shared-doc-markdown-negotiation-kgpath-alias',
        url: sharedDocAliasUrls.kgPath,
        accept: 'text/markdown',
        assert: async (response, body) =>
          response.ok
          && response.headers.get('content-type')?.includes('text/markdown')
          && String(response.headers.get('vary') || '').toLowerCase().includes('accept')
          && body.trim() === sharedDocSample.markdown.trim(),
      }]
    : []),
  {
    name: 'health',
    url: `${baseUrl}/health`,
    accept: 'application/health+json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && response.headers.get('content-type')?.includes('application/health+json')
        && payload.status === 'pass'
        && payload.service === 'knowgrph-agent-ready-pages'
        && payload.health === `${canonicalBaseUrl}/health`
    },
  },
  {
    name: 'api-catalog',
    url: `${baseUrl}/.well-known/api-catalog`,
    accept: 'application/linkset+json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const linksetEntry = payload.linkset?.[0] || {}
      return response.ok
        && response.headers.get('content-type')?.includes('application/linkset+json')
        && Array.isArray(payload.linkset)
        && Boolean(linksetEntry.anchor)
        && Array.isArray(linksetEntry.status)
        && linksetEntry.status.some((entry) => entry?.href === `${canonicalBaseUrl}/health`)
    },
  },
  {
    name: 'openapi',
    url: `${baseUrl}/.well-known/openapi.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const actualPathKeys = Object.keys(payload.paths || {}).sort()
      return response.ok
        && payload.openapi === '3.1.0'
        && actualPathKeys.length === expectedOpenApiPathKeys.length
        && actualPathKeys.join('|') === expectedOpenApiPathKeys.join('|')
    },
  },
  {
    name: 'a2a-agent-card',
    url: `${baseUrl}/.well-known/agent-card.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && response.headers.get('content-type')?.includes('application/json')
        && payload.name
        && payload.version
        && payload.description
        && Array.isArray(payload.supportedInterfaces)
        && payload.supportedInterfaces.some((entry) => entry?.url === `${canonicalBaseUrl}/mcp`)
        && payload.capabilities
        && Array.isArray(payload.skills)
        && payload.skills.length === expectedA2aSkills.length
        && expectedA2aSkills.every((expectedSkill) =>
          payload.skills.some((skill) =>
            skill?.id === expectedSkill.id
            && skill?.name === expectedSkill.name
            && skill?.description === expectedSkill.description,
          ))
        && payload.skills.every((skill) => skill?.id && skill?.name && skill?.description)
    },
  },
  {
    name: 'oauth-protected-resource',
    url: `${baseUrl}/.well-known/oauth-protected-resource`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok && hasExpectedProtectedResource(payload)
    },
  },
  {
    name: 'oauth-authorization-server',
    url: `${baseUrl}/.well-known/oauth-authorization-server`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok && payload.issuer === originUrl && hasExpectedAuthResourceReference(payload) && payload.authorization_endpoint && payload.token_endpoint && payload.jwks_uri && hasExpectedAgentAuth(payload.agent_auth)
    },
  },
  {
    name: 'mcp-server-card',
    url: `${baseUrl}/.well-known/mcp/server-card.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const inspectTool = Array.isArray(payload.capabilities?.tools)
        ? payload.capabilities.tools.find((tool) => tool?.name === 'inspect_agent_surface')
        : null
      const tools = Array.isArray(payload.capabilities?.tools)
        ? payload.capabilities.tools.map((tool) => ({
            name: tool?.name,
            description: tool?.description,
            inputSchema: tool?.inputSchema || {},
          })).sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
        : null
      return response.ok
        && payload.serverInfo?.name
        && payload.serverInfo?.version
        && payload.transport
        && payload.links?.status === `${canonicalBaseUrl}/health`
        && Array.isArray(tools)
        && tools.length === expectedMcpToolEntries.length
        && JSON.stringify(tools) === JSON.stringify(expectedMcpToolEntries)
        && payload.capabilities?.resources
        && payload.capabilities?.extensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)
        && inspectTool?._meta?.ui?.resourceUri === KNOWGRPH_MCP_APP_RESOURCE_URI
        && inspectTool?.outputSchema?.type === 'object'
    },
  },
  {
    name: 'mcp-card-alias',
    url: `${baseUrl}/.well-known/mcp.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.transport?.url === `${canonicalBaseUrl}/mcp`
        && Array.isArray(payload.capabilities?.tools)
    },
  },
  {
    name: 'mcp-initialize',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'knowgrph-agent-ready-smoke', version: '1.0.0' },
      },
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.jsonrpc === '2.0'
        && payload.result?.serverInfo?.name
        && payload.result?.capabilities?.tools
        && payload.result?.capabilities?.resources
        && payload.result?.capabilities?.extensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE)
    },
  },
  {
    name: 'mcp-tools-list',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const inspectTool = Array.isArray(payload.result?.tools)
        ? payload.result.tools.find((tool) => tool?.name === 'inspect_agent_surface')
        : null
      const tools = Array.isArray(payload.result?.tools)
        ? payload.result.tools.map((tool) => ({
            name: tool?.name,
            description: tool?.description,
            inputSchema: tool?.inputSchema || {},
          })).sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
        : null
      return response.ok
        && Array.isArray(tools)
        && tools.length === expectedMcpToolEntries.length
        && JSON.stringify(tools) === JSON.stringify(expectedMcpToolEntries)
        && inspectTool?._meta?.ui?.resourceUri === KNOWGRPH_MCP_APP_RESOURCE_URI
        && inspectTool?.outputSchema?.type === 'object'
    },
  },
  {
    name: 'mcp-apps-resources-list',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 23,
      method: 'resources/list',
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const resource = Array.isArray(payload.result?.resources)
        ? payload.result.resources.find((entry) => entry?.uri === KNOWGRPH_MCP_APP_RESOURCE_URI)
        : null
      return response.ok
        && resource?.mimeType === KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE
        && resource?._meta?.ui?.prefersBorder === true
    },
  },
  {
    name: 'mcp-apps-resources-read',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 24,
      method: 'resources/read',
      params: { uri: KNOWGRPH_MCP_APP_RESOURCE_URI },
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const content = payload.result?.contents?.[0]
      return response.ok
        && content?.uri === KNOWGRPH_MCP_APP_RESOURCE_URI
        && content?.mimeType === KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE
        && content?._meta?.ui?.prefersBorder === true
        && String(content?.text || '').includes(KNOWGRPH_MCP_APPS_PROTOCOL_VERSION)
        && String(content?.text || '').includes("request('ui/initialize'")
        && String(content?.text || '').includes('appCapabilities')
        && String(content?.text || '').includes('ui/notifications/initialized')
        && String(content?.text || '').includes('ui/notifications/tool-result')
        && String(content?.text || '').includes('ui/notifications/tool-input-partial')
        && String(content?.text || '').includes('ui/notifications/tool-cancelled')
        && String(content?.text || '').includes('ui/notifications/host-context-changed')
        && String(content?.text || '').includes('ui/notifications/size-changed')
        && String(content?.text || '').includes('mcpAppsServerReadiness')
        && String(content?.text || '').includes('MCP Apps server-ready')
        && String(content?.text || '').includes('tools/call')
    },
  },
  {
    name: 'mcp-list-source-files',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: {
        name: 'list_source_files',
        arguments: {},
      },
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const result = payload.result?.structuredContent
      return response.ok
        && payload.result?.isError === false
        && result?.workspaceId === 'kgws:canonical-docs'
        && typeof result?.markdownIndex === 'string'
        && result.markdownIndex.includes('/api/storage/doc-default/')
        && result.markdownIndex.length > 0
    },
  },
  {
    name: 'mcp-read-source-file',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: {
        name: 'read_source_file',
        arguments: {
          canonicalPath: preferredSharedDocSample.canonicalPath,
        },
      },
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const result = payload.result?.structuredContent
      return response.ok
        && payload.result?.isError === false
        && result?.workspaceId === 'kgws:canonical-docs'
        && result?.canonicalPath === preferredSharedDocSample.canonicalPath
        && typeof result?.markdown === 'string'
        && result.markdown.trim().length > 0
    },
  },
  ...(sharedDocSample
    ? [{
        name: 'mcp-read-shared-document',
        url: `${baseUrl}/mcp`,
        method: 'POST',
        accept: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'read_shared_document',
            arguments: {
              shareUrl: sharedDocSample.shareUrl,
            },
          },
        }),
        assert: async (response, body) => {
          const payload = JSON.parse(body)
          const result = payload.result?.structuredContent
          return response.ok
            && payload.result?.isError === false
            && result?.canonicalPath === sharedDocSample.canonicalPath
            && result?.workspaceId === sharedDocSample.workspaceId
            && String(result?.markdown || '').trim() === sharedDocSample.markdown.trim()
        },
      },
      {
        name: 'mcp-inspect-shared-document-structure',
        url: `${baseUrl}/mcp`,
        method: 'POST',
        accept: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'inspect_shared_document_structure',
            arguments: {
              shareUrl: sharedDocSample.shareUrl,
            },
          },
        }),
        assert: async (response, body) => {
          const payload = JSON.parse(body)
          const result = payload.result?.structuredContent
          return response.ok
            && payload.result?.isError === false
            && result?.canonicalPath === sharedDocSample.canonicalPath
            && result?.workspaceId === sharedDocSample.workspaceId
            && typeof result?.hasFrontmatter === 'boolean'
            && Array.isArray(result?.topLevelKeys)
            && typeof result?.headingCount === 'number'
            && typeof result?.markdownLength === 'number'
            && result.markdownLength > 0
        },
      }]
    : []),
  {
    name: 'mcp-inspect-agent-surface',
    url: `${baseUrl}/mcp`,
    method: 'POST',
    accept: 'application/json',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'inspect_agent_surface',
        arguments: {},
      },
    }),
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const result = payload.result?.structuredContent
      return response.ok
        && payload.result?.isError === false
        && result?.healthUrl === `${canonicalBaseUrl}/health`
        && result?.mcpUrl === `${canonicalBaseUrl}/mcp`
        && result?.mcpServerCard?.transport?.url === `${canonicalBaseUrl}/mcp`
        && result?.mcpAppsServerReadiness?.ready === true
        && result.mcpAppsServerReadiness.tool?.name === 'inspect_agent_surface'
        && result.mcpAppsServerReadiness.resource?.mimeType === KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE
        && Array.isArray(result.mcpAppsServerReadiness.transports)
        && result.mcpAppsServerReadiness.transports.some((transport) => transport?.id === 'pages-http-jsonrpc')
        && result.mcpAppsServerReadiness.transports.some((transport) => transport?.id === 'local-stdio-jsonrpc')
        && Array.isArray(result.mcpAppsServerReadiness.checklist)
        && result.mcpAppsServerReadiness.checklist.every((check) => check?.ok === true)
        && Array.isArray(result?.agentSkills?.skills)
        && result.agentSkills.skills.length > 0
    },
  },
  {
    name: 'agent-skills',
    url: `${baseUrl}/.well-known/agent-skills/index.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && Array.isArray(payload.skills)
        && payload.skills.length === expectedAgentSkills.length
        && expectedAgentSkills.every((expectedSkill) =>
          payload.skills.some((skill) =>
            skill?.name === expectedSkill.name
            && skill?.type === expectedSkill.type
            && skill?.description === expectedSkill.description
            && skill?.url === `${canonicalBaseUrl}${expectedSkill.path}`,
          ))
        && payload.skills.every((skill) =>
          skill.name
          && skill.type
          && skill.url
          && skill.sha256
          && skill.vdeoxpln?.id === skill.name
          && String(skill.vdeoxpln?.semanticKey || '').startsWith('kgvx_'))
    },
  },
  ...expectedAgentSkills.map((expectedSkill) => ({
    name: `agent-skill-${expectedSkill.name}-markdown`,
    url: `${baseUrl}${expectedSkill.path}`,
    accept: 'text/markdown',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/markdown')
      && body.includes(`# ${expectedSkill.vdeoxpln.title} Skill`)
      && body.includes(`Vdeoxpln id: \`${expectedSkill.name}\``)
      && body.includes(`Semantic key: \`${expectedSkill.vdeoxpln.semanticKey}\``)
      && body.includes('Do not add compatibility aliases for stale vdeoxpln ids.'),
  })),
  {
    name: 'jwks',
    url: `${baseUrl}/.well-known/http-message-signatures-directory`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok && Array.isArray(payload.keys) && payload.keys.length > 0
    },
  },
  {
    name: 'root-robots-alias',
    url: `${originUrl}/robots.txt`,
    accept: '*/*',
    assert: async (response, body) => response.ok && /Sitemap:/.test(body) && /User-agent: GPTBot/.test(body),
  },
  {
    name: 'root-api-catalog-alias',
    url: `${originUrl}/.well-known/api-catalog`,
    accept: 'application/linkset+json',
    assert: async (response, body) => response.ok && JSON.parse(body).linkset?.[0]?.anchor,
  },
  {
    name: 'root-openapi-alias',
    url: `${originUrl}/.well-known/openapi.json`,
    accept: 'application/json',
    assert: async (response, body) => response.ok && JSON.parse(body).paths?.['/knowgrph/health']?.get,
  },
  {
    name: 'root-a2a-agent-card',
    url: rootA2aAgentCardUrl,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.url === `${canonicalBaseUrl}/mcp`
        && Array.isArray(payload.skills)
        && payload.skills.length > 0
    },
  },
  {
    name: 'root-mcp-card-alias',
    url: `${originUrl}/.well-known/mcp/server-card.json`,
    accept: 'application/json',
    assert: async (response, body) => response.ok && JSON.parse(body).transport?.url === `${canonicalBaseUrl}/mcp`,
  },
  {
    name: 'root-agent-skills-alias',
    url: `${originUrl}/.well-known/agent-skills/index.json`,
    accept: 'application/json',
    assert: async (response, body) => response.ok && Array.isArray(JSON.parse(body).skills),
  },
  ...buildAgentReadyCommerceChecks({ originUrl }),
  {
    name: 'webmcp-html-marker',
    url: `${baseUrl}/?agentReadySmoke=1`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && expectedWebToolNames.every((toolName) => body.includes(toolName))
      && expectedBrowserOnlyWebToolNames.every((toolName) => !body.includes(toolName))
      && body.includes('modelContext')
      && body.includes('kgWebmcpTools')
      && body.includes('toolDefinitions')
      && body.includes('toolExecutors'),
  },
  {
    name: 'webmcp-html-lifecycle-contract',
    url: `${baseUrl}/?agentReadySmoke=1`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && body.includes('kgWebmcpContext')
      && body.includes('createWebMcpLifecycleController')
      && body.includes('provideContext({ tools })')
      && body.includes('registerTool(tool, controller ? { signal: controller.signal } : {})')
      && body.includes('AbortController')
      && body.includes('awaiting-model-context')
      && body.includes('fallback-readable')
      && body.includes('retry-exhausted')
      && body.includes('root.window && root.window.navigator')
      && body.includes('currentOrigin || siteOrigin')
      && body.includes('"/api/storage/source-files"'),
  },
]

let failed = 0
for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      method: check.method || 'GET',
      headers: { accept: check.accept },
      body: check.body,
    })
    const body = check.method === 'HEAD' ? '' : await response.text()
    if (await check.assert(response, body)) {
      console.log(`ok ${check.name}`)
    } else {
      failed += 1
      console.error(`not ok ${check.name}: ${describeFailure(check.name, response, body)}`)
    }
  } catch (error) {
    failed += 1
    console.error(`not ok ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  console.error(`[knowgrph] agent-ready smoke failed: ${failed}/${checks.length}`)
  process.exitCode = 1
} else {
  console.log(`[knowgrph] agent-ready smoke passed: ${checks.length}/${checks.length}`)
}
