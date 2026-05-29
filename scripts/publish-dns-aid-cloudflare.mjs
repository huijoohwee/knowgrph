import {
  buildDnsAidConfig,
  describeDnsAidRecord,
  toCloudflareDnsAidRecordPayload,
} from './dns-aid-records.mjs'

const apiBase = 'https://api.cloudflare.com/client/v4'

const env = process.env
const dnsAidConfig = buildDnsAidConfig(env)
const zoneName = dnsAidConfig.zoneName
const token = env.CLOUDFLARE_DNS_API_TOKEN || env.CLOUDFLARE_API_TOKEN || ''
const configuredZoneId = env.CLOUDFLARE_ZONE_ID || ''
const ttl = dnsAidConfig.ttl
const dryRun = process.argv.includes('--dry-run')

if (!token && !dryRun) {
  console.error('[dns-aid] CLOUDFLARE_DNS_API_TOKEN or CLOUDFLARE_API_TOKEN with Zone | DNS | Edit permission is required unless --dry-run is used')
  console.error('[dns-aid] Wrangler OAuth is not a substitute for a scoped Cloudflare API token that can edit DNS records.')
  process.exit(1)
}

const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

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
    console.log(`[dns-aid] would upsert ${describeDnsAidRecord(record)}`)
    return
  }
  const existing = await findExistingRecord(zoneId, record)
  const body = JSON.stringify(toCloudflareDnsAidRecordPayload(record))
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
  console.log(`[dns-aid] zone=${zoneName} base=${dnsAidConfig.baseUrl.href} ttl=${ttl}`)
  for (const record of dnsAidConfig.records) {
    await upsertRecord(zoneId, record)
  }
  await validateDnssec(zoneId)
} catch (error) {
  console.error(`[dns-aid] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
