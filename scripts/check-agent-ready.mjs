import { buildKnowgrphAgentReadyToolContracts } from '../canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import { encodePublishedDocShareToken, PUBLISHED_DOC_SHARE_TOKEN_PARAM } from '../canvas/src/features/canvas/canvasDocShareToken.mjs'

const canonicalOriginUrl = 'https://airvio.co'
const canonicalBaseUrl = `${canonicalOriginUrl}/knowgrph`
const baseUrl = (process.env.KNOWGRPH_AGENT_READY_BASE_URL || canonicalBaseUrl).replace(/\/+$/, '')
const originUrl = new URL(baseUrl).origin
const rootA2aAgentCardUrl = `${originUrl}/.well-known/agent-card.json`
const expectedTools = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: 'kgws:canonical-docs',
})
const expectedToolNames = expectedTools.map((tool) => tool.name)
const expectedWebToolNames = expectedTools.map((tool) => tool.webName)
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

const sharedDocSample =
  await buildSharedDocSample(preferredSharedDocSample)
  || await resolveSharedDocSampleFromIndex()

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
      return response.ok
        && payload.openapi === '3.1.0'
        && payload.paths?.['/knowgrph/health']?.get
        && payload.paths?.['/knowgrph/mcp']?.get
        && payload.paths?.['/api/storage/source-files']?.get
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
        && payload.skills.every((skill) => skill?.id && skill?.name && skill?.description)
    },
  },
  {
    name: 'oauth-protected-resource',
    url: `${baseUrl}/.well-known/oauth-protected-resource`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.resource
        && Array.isArray(payload.authorization_servers)
        && payload.authorization_servers.length > 0
        && Array.isArray(payload.scopes_supported)
    },
  },
  {
    name: 'oauth-authorization-server',
    url: `${baseUrl}/.well-known/oauth-authorization-server`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok && payload.issuer && payload.authorization_endpoint && payload.token_endpoint && payload.jwks_uri
    },
  },
  {
    name: 'mcp-server-card',
    url: `${baseUrl}/.well-known/mcp/server-card.json`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      const tools = payload.capabilities?.tools
      return response.ok
        && payload.serverInfo?.name
        && payload.serverInfo?.version
        && payload.transport
        && payload.links?.status === `${canonicalBaseUrl}/health`
        && Array.isArray(tools)
        && expectedTools.every((tool) =>
          tools.some((entry) =>
            entry?.name === tool.name
            && JSON.stringify(entry?.inputSchema || {}) === JSON.stringify(tool.inputSchema),
          ))
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
      return response.ok && payload.jsonrpc === '2.0' && payload.result?.serverInfo?.name && payload.result?.capabilities?.tools
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
      const tools = payload.result?.tools
      return response.ok
        && Array.isArray(tools)
        && expectedTools.every((tool) =>
          tools.some((entry) =>
            entry?.name === tool.name
            && JSON.stringify(entry?.inputSchema || {}) === JSON.stringify(tool.inputSchema),
          ))
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
      return response.ok && Array.isArray(payload.skills) && payload.skills.every((skill) => skill.name && skill.type && skill.url && skill.sha256)
    },
  },
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
  {
    name: 'webmcp-html-marker',
    url: `${baseUrl}/?agentReadySmoke=1`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && expectedWebToolNames.every((toolName) => body.includes(toolName))
      && body.includes('modelContext')
      && body.includes('kgWebmcpTools'),
  },
  {
    name: 'webmcp-html-lifecycle-contract',
    url: `${baseUrl}/?agentReadySmoke=1`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && body.includes('kgWebmcpContext')
      && body.includes('registerTool(tool, controller ? { signal: controller.signal } : {})')
      && body.includes('AbortController')
      && body.includes('awaiting-model-context')
      && body.includes('fallback-readable')
      && body.includes('retry-exhausted')
      && body.includes('window.location && window.location.hostname')
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
