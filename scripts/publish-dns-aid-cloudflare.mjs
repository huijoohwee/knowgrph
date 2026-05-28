const apiBase = 'https://api.cloudflare.com/client/v4'

const env = process.env
const baseUrl = new URL(env.KNOWGRPH_AGENT_READY_BASE_URL || 'https://airvio.co/knowgrph/')
const zoneName = (env.CLOUDFLARE_ZONE_NAME || baseUrl.hostname.split('.').slice(-2).join('.')).replace(/\.$/, '')
const token = env.CLOUDFLARE_API_TOKEN || ''
const configuredZoneId = env.CLOUDFLARE_ZONE_ID || ''
const ttl = Number(env.KNOWGRPH_DNS_AID_TTL || 3600)
const dryRun = process.argv.includes('--dry-run')

if (!token && !dryRun) {
  console.error('[dns-aid] CLOUDFLARE_API_TOKEN is required unless --dry-run is used')
  process.exit(1)
}

const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

const serviceTarget = `${baseUrl.hostname}.`
const appBasePath = baseUrl.pathname.replace(/\/+$/, '') || '/knowgrph'
const agentCardPath = `${appBasePath}/.well-known/agent-card.json`
const mcpPath = `${appBasePath}/mcp`
const skillIndexPath = `${appBasePath}/.well-known/agent-skills/index.json`

const buildSvcParams = ({ alpn, descriptorPath, endpointPath }) => [
  `alpn="${alpn}"`,
  'port=443',
  'mandatory=alpn,port',
  `key65400="${descriptorPath}"`,
  `key65401="${endpointPath}"`,
  `key65402="${skillIndexPath}"`,
].join(' ')

const dnsAidRecords = [
  {
    type: 'SVCB',
    name: `_index._agents.${zoneName}`,
    data: {
      priority: 1,
      target: serviceTarget,
      value: buildSvcParams({
        alpn: 'h2',
        descriptorPath: agentCardPath,
        endpointPath: appBasePath,
      }),
    },
    comment: 'Knowgrph DNS-AID organization index; key65400=agent card, key65401=service homepage, key65402=skill index',
  },
  {
    type: 'SVCB',
    name: `_mcp._agents.${zoneName}`,
    data: {
      priority: 1,
      target: serviceTarget,
      value: buildSvcParams({
        alpn: 'mcp,h2',
        descriptorPath: agentCardPath,
        endpointPath: mcpPath,
      }),
    },
    comment: 'Knowgrph DNS-AID MCP endpoint; key65400=agent card, key65401=MCP transport, key65402=skill index',
  },
  {
    type: 'SVCB',
    name: `_a2a._agents.${zoneName}`,
    data: {
      priority: 1,
      target: serviceTarget,
      value: buildSvcParams({
        alpn: 'a2a,h2',
        descriptorPath: agentCardPath,
        endpointPath: agentCardPath,
      }),
    },
    comment: 'Knowgrph DNS-AID A2A discovery; key65400=agent card, key65401=A2A descriptor, key65402=skill index',
  },
].map((record) => ({
  ...record,
  ttl,
  proxied: false,
}))

const cloudflareFetch = async (path, init = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.map((error) => error.message).join('; ') || `${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return payload
}

const resolveZoneId = async () => {
  if (configuredZoneId) return configuredZoneId
  const payload = await cloudflareFetch(`/zones?name=${encodeURIComponent(zoneName)}&status=active`)
  const zone = Array.isArray(payload.result) ? payload.result[0] : null
  if (!zone?.id) throw new Error(`No active Cloudflare zone found for ${zoneName}`)
  return zone.id
}

const findExistingRecord = async (zoneId, record) => {
  const params = new URLSearchParams({
    type: record.type,
    name: record.name,
    per_page: '1',
  })
  const payload = await cloudflareFetch(`/zones/${zoneId}/dns_records?${params}`)
  return Array.isArray(payload.result) ? payload.result[0] : null
}

const upsertRecord = async (zoneId, record) => {
  if (dryRun) {
    console.log(`[dns-aid] would upsert ${record.type} ${record.name} ${record.data.priority} ${record.data.target} ${record.data.value}`)
    return
  }
  const existing = await findExistingRecord(zoneId, record)
  const body = JSON.stringify(record)
  if (existing?.id) {
    await cloudflareFetch(`/zones/${zoneId}/dns_records/${existing.id}`, {
      method: 'PUT',
      body,
    })
    console.log(`[dns-aid] updated ${record.type} ${record.name}`)
    return
  }
  await cloudflareFetch(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body,
  })
  console.log(`[dns-aid] created ${record.type} ${record.name}`)
}

const validateDnssec = async (zoneId) => {
  if (dryRun) return
  const payload = await cloudflareFetch(`/zones/${zoneId}/dnssec`)
  const status = payload.result?.status || 'unknown'
  if (status !== 'active') {
    throw new Error(`DNSSEC must be active for DNS-AID authenticated data; current status=${status}`)
  }
  console.log(`[dns-aid] dnssec ${status}`)
}

try {
  const zoneId = dryRun ? configuredZoneId || '<zone-id>' : await resolveZoneId()
  console.log(`[dns-aid] zone=${zoneName} base=${baseUrl.href} ttl=${ttl}`)
  for (const record of dnsAidRecords) {
    await upsertRecord(zoneId, record)
  }
  await validateDnssec(zoneId)
} catch (error) {
  console.error(`[dns-aid] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
