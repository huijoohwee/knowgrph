const canonicalBaseUrl = 'https://airvio.co/knowgrph'
const baseUrl = (process.env.KNOWGRPH_AGENT_READY_BASE_URL || canonicalBaseUrl).replace(/\/+$/, '')
const originUrl = new URL(baseUrl).origin

const checks = [
  {
    name: 'auth-md',
    url: `${originUrl}/auth.md`,
    accept: 'text/markdown',
    assert: async (response, body) =>
      response.ok
      && response.headers.get('content-type')?.includes('text/markdown')
      && body.includes('# Knowgrph auth.md')
      && body.includes('/.well-known/oauth-protected-resource')
      && body.includes('/.well-known/oauth-authorization-server')
      && body.includes('agent_auth'),
  },
  {
    name: 'oauth-protected-resource',
    url: `${originUrl}/.well-known/oauth-protected-resource`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.resource
        && Array.isArray(payload.authorization_servers)
        && Array.isArray(payload.scopes_supported)
    },
  },
  {
    name: 'oauth-authorization-server-agent-auth',
    url: `${originUrl}/.well-known/oauth-authorization-server`,
    accept: 'application/json',
    assert: async (response, body) => {
      const agentAuth = JSON.parse(body).agent_auth
      return response.ok
        && agentAuth?.skill === `${originUrl}/auth.md`
        && typeof agentAuth?.register_uri === 'string'
        && Array.isArray(agentAuth?.identity_types_supported)
        && Array.isArray(agentAuth?.anonymous?.credential_types_supported)
        && Array.isArray(agentAuth?.identity_assertion?.credential_types_supported)
    },
  },
]

let failed = 0
for (const check of checks) {
  try {
    const response = await fetch(check.url, { headers: { accept: check.accept } })
    const body = await response.text()
    if (await check.assert(response, body)) console.log(`ok ${check.name}`)
    else {
      failed += 1
      console.error(`not ok ${check.name}: ${response.status} ${response.headers.get('content-type') || ''}`)
    }
  } catch (error) {
    failed += 1
    console.error(`not ok ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  console.error(`[auth-md] failed: ${failed}/${checks.length}`)
  process.exit(1)
}
console.log(`[auth-md] passed: ${checks.length}/${checks.length}`)
