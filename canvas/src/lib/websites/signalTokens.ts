export type LinkSignalKind = 'cta' | 'nav' | 'lnk'

const normalizeInline = (raw: string) => String(raw || '').replace(/\s+/g, ' ').trim()

const truncate = (raw: string, max: number) => {
  const s = normalizeInline(raw)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function classifyLinkLabel(labelRaw: string): LinkSignalKind {
  const s = normalizeInline(labelRaw).toLowerCase()
  if (!s) return 'lnk'
  const ctaWords = [
    'sign up',
    'signup',
    'sign in',
    'signin',
    'log in',
    'login',
    'get started',
    'start',
    'try',
    'download',
    'install',
    'create',
    'open',
    'join',
    'contact',
    'request',
    'book a demo',
    'demo',
    'buy',
    'subscribe',
    'watch',
    'play',
  ]
  for (const w of ctaWords) {
    if (s === w) return 'cta'
  }
  if (s.startsWith('get started')) return 'cta'
  if (s.startsWith('download')) return 'cta'
  const navWords = [
    'docs',
    'documentation',
    'user guide',
    'guide',
    'learn',
    'learning',
    'tutorials',
    'blog',
    'community',
    'resources',
    'pricing',
    'features',
    'changelog',
    'about',
    'github',
    'api',
    'support',
    'help',
  ]
  for (const w of navWords) {
    if (s === w) return 'nav'
  }
  return 'lnk'
}

export function extractLinkSignalLabelsFromLine(line: string, opts?: { maxLabelLen?: number }): string[] {
  const maxLabelLen = opts?.maxLabelLen ?? 52
  const s = String(line || '')
  const out: string[] = []
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(s))) {
    const idx = m.index
    if (idx > 0 && s.charCodeAt(idx - 1) === 33) continue
    const text = truncate(m[1] || 'link', maxLabelLen)
    const kind = classifyLinkLabel(text)
    const prefix = kind === 'cta' ? '[CTA]' : kind === 'nav' ? '[NAV]' : '[LINK]'
    out.push(`${prefix} ${text}`)
  }
  return out
}

export function extractPriceSignalLabelsFromLine(line: string, opts?: { maxLabelLen?: number }): string[] {
  const maxLabelLen = opts?.maxLabelLen ?? 52
  const s = String(line || '')
  const out: string[] = []
  const priceRe = /(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?)/gi
  let m: RegExpExecArray | null
  while ((m = priceRe.exec(s))) {
    const token = truncate(m[1] || '', maxLabelLen)
    if (!token) continue
    out.push(`[PRICE] ${token}`)
  }
  const perRe = /\b\d+(?:\.\d+)?\s*\/\s*(?:mo|month|yr|year)\b/gi
  while ((m = perRe.exec(s))) {
    if (typeof m.index === 'number' && m.index > 0 && s.charCodeAt(m.index - 1) === 36) continue
    const token = truncate(m[0] || '', maxLabelLen)
    if (!token) continue
    out.push(`[PRICE] ${token}`)
  }
  return out
}

export function extractTimeSignalLabelsFromLine(line: string, opts?: { maxLabelLen?: number }): string[] {
  const maxLabelLen = opts?.maxLabelLen ?? 52
  const s = String(line || '')
  const out: string[] = []
  const timeRe = /\b\d{1,2}:\d{2}\b/g
  let m: RegExpExecArray | null
  while ((m = timeRe.exec(s))) {
    const token = truncate(m[0] || '', maxLabelLen)
    if (!token) continue
    out.push(`[TIME] ${token}`)
  }
  return out
}

export function summarizeCategorizedSignalsFromMarkdown(markdown: string, opts?: { maxLines?: number; maxPerKind?: number }): {
  nav: Array<{ label: string; count: number }>
  cta: Array<{ label: string; count: number }>
  price: Array<{ label: string; count: number }>
  time: Array<{ label: string; count: number }>
} {
  const maxLines = opts?.maxLines ?? 2000
  const maxPerKind = opts?.maxPerKind ?? 6
  const lines = String(markdown || '').split(/\r\n|\n|\r/).slice(0, maxLines)

  const countMap = (labels: string[]) => {
    const map = new Map<string, number>()
    for (const l of labels) map.set(l, (map.get(l) || 0) + 1)
    return map
  }

  const links: string[] = []
  const prices: string[] = []
  const times: string[] = []
  for (const line of lines) {
    links.push(...extractLinkSignalLabelsFromLine(line))
    prices.push(...extractPriceSignalLabelsFromLine(line))
    times.push(...extractTimeSignalLabelsFromLine(line))
  }

  const linkCounts = countMap(links)
  const priceCounts = countMap(prices)
  const timeCounts = countMap(times)

  const pick = (m: Map<string, number>, prefix: string) => {
    const items: Array<{ label: string; count: number }> = []
    for (const [label, count] of m.entries()) {
      if (!label.startsWith(prefix)) continue
      items.push({ label, count })
    }
    items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    return items.slice(0, maxPerKind)
  }

  return {
    nav: pick(linkCounts, '[NAV]'),
    cta: pick(linkCounts, '[CTA]'),
    price: pick(priceCounts, '[PRICE]'),
    time: pick(timeCounts, '[TIME]'),
  }
}

