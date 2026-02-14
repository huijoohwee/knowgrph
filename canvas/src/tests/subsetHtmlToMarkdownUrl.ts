import fs from 'node:fs/promises'
import { fetchRemoteTextDetailed } from '@/lib/net/fetchRemoteText'
import { parseHtmlToMarkdownAllText } from '@/features/parsers/html-parser'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const readFlag = (name: string): string => {
  const argv = process.argv
  const idx = argv.indexOf(name)
  if (idx < 0) return ''
  const v = argv[idx + 1] || ''
  return String(v).trim()
}

const readRepeatableFlag = (name: string): string[] => {
  const argv = process.argv
  const out: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== name) continue
    const v = argv[i + 1]
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
  }
  return out
}

async function main() {
  const { restore } = initJsdomHarness()
  const url = readFlag('--url')
  const outPath = readFlag('--out')
  const expects = readRepeatableFlag('--expect')
  if (!url) {
    restore()
    throw new Error('Missing --url')
  }

  try {
    const fetched = await fetchRemoteTextDetailed(url, { preflightHead: true, preferProxy: true, maxBytes: 4_000_000 })
    if (fetched.ok === false) {
      const status = typeof fetched.status === 'number' ? ` status=${fetched.status}` : ''
      const suffix = fetched.errorText ? `\n\n${String(fetched.errorText).slice(0, 2000)}` : ''
      throw new Error(`Fetch failed: kind=${fetched.kind}${status}${suffix}`)
    }

    const md = parseHtmlToMarkdownAllText(fetched.text, url)
    for (const needle of expects) {
      if (!md.includes(needle)) {
        throw new Error(`Missing expected substring: ${needle}`)
      }
    }
    const summary = {
      url,
      htmlChars: fetched.text.length,
      markdownChars: md.length,
      markdownLines: md.split('\n').length,
      expects: expects.length,
    }
    console.log(JSON.stringify(summary, null, 2))

    if (outPath) {
      await fs.writeFile(outPath, md, 'utf8')
      console.log(`WROTE ${outPath}`)
    }
  } finally {
    restore()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
