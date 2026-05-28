const baseUrl = new URL(process.env.KNOWGRPH_AGENT_READY_BASE_URL || 'https://airvio.co/knowgrph/')
const hostname = baseUrl.hostname

const records = [
  { name: `_index._agents.${hostname}`, alpn: 'h2' },
  { name: `_mcp._agents.${hostname}`, alpn: 'mcp' },
  { name: `_a2a._agents.${hostname}`, alpn: 'a2a' },
]

const queryDnsJson = async (name) => {
  const params = new URLSearchParams({ name, type: '64' })
  const response = await fetch(`https://cloudflare-dns.com/dns-query?${params}`, {
    headers: { accept: 'application/dns-json' },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

let failed = 0
for (const record of records) {
  try {
    const payload = await queryDnsJson(record.name)
    const answers = Array.isArray(payload.Answer) ? payload.Answer : []
    const data = answers.map((answer) => String(answer.data || '')).join('\n')
    const ok = payload.Status === 0
      && payload.AD === true
      && answers.some((answer) => Number(answer.type) === 64)
      && data.includes('alpn=')
      && data.includes(record.alpn)
      && data.includes('port=443')
      && data.includes('mandatory=')
    if (ok) {
      console.log(`ok dns-aid ${record.name}`)
    } else {
      failed += 1
      console.error(`not ok dns-aid ${record.name}: missing DNSSEC-authenticated SVCB record`)
    }
  } catch (error) {
    failed += 1
    console.error(`not ok dns-aid ${record.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  console.error(`[dns-aid] failed: ${failed}/${records.length}`)
  process.exit(1)
}

console.log(`[dns-aid] passed: ${records.length}/${records.length}`)
