const baseUrl = (process.env.KNOWGRPH_AGENT_READY_BASE_URL || 'https://airvio.co/knowgrph').replace(/\/+$/, '')
const originUrl = new URL(baseUrl).origin

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
        && link.includes('rel="mcp-server-card"')
    },
  },
  {
    name: 'markdown-negotiation',
    url: `${baseUrl}/`,
    accept: 'text/markdown',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/markdown')
      && Number(response.headers.get('x-markdown-tokens') || 0) > 0
      && body.trim().startsWith('# Knowgrph'),
  },
  {
    name: 'api-catalog',
    url: `${baseUrl}/.well-known/api-catalog`,
    accept: 'application/linkset+json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && response.headers.get('content-type')?.includes('application/linkset+json')
        && Array.isArray(payload.linkset)
        && Boolean(payload.linkset[0]?.anchor)
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
      return response.ok && payload.serverInfo?.name && payload.serverInfo?.version && payload.transport
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
    name: 'webmcp-html-marker',
    url: `${baseUrl}/?agentReadySmoke=1`,
    accept: 'text/html',
    assert: async (response, body) =>
      response.ok
      && body.includes('knowgrph.list_source_files')
      && body.includes('modelContext')
      && body.includes('kgWebmcpTools'),
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
      console.error(`not ok ${check.name}: ${response.status} ${response.headers.get('content-type') || ''}`)
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
