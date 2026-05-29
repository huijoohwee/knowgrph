import { buildDnsAidConfig, validateDnsAidAnswerData } from './dns-aid-records.mjs'

const dnsAidConfig = buildDnsAidConfig(process.env)
const records = dnsAidConfig.records

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
    const svcbAnswer = answers.find((answer) => Number(answer.type) === 64) || null
    const missing = svcbAnswer ? validateDnsAidAnswerData(record, svcbAnswer.data) : ['type=64 SVCB answer']
    const ok = payload.Status === 0 && payload.AD === true && missing.length === 0
    if (ok) {
      console.log(`ok dns-aid ${record.name}`)
    } else {
      failed += 1
      const reason = payload.AD === true
        ? `missing or mismatched ${missing.join(', ')}`
        : 'response is not DNSSEC-authenticated'
      console.error(`not ok dns-aid ${record.name}: ${reason}`)
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
