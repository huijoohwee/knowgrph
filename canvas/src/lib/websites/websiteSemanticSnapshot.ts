type SemanticLink = { text: string; href: string }
type SemanticTextBlock = { tag: string; text: string }

export type WebsiteSemanticSnapshotV1 = {
  version: 1
  source: 'website-semantic-snapshot'
  url: string
  title: string
  summary: {
    headings: number
    links: number
    controls: number
    media: number
    tables: number
    lists: number
    forms: number
    textBlocks: number
  }
  queryData: {
    headings: Array<{ level: number; text: string }>
    links: SemanticLink[]
    controls: Array<{ tag: string; text: string }>
    media: Array<{ kind: string; src: string; alt?: string }>
    tables: Array<{ rows: number; columns: number; text: string }>
    lists: Array<{ ordered: boolean; items: string[] }>
    forms: Array<{ action: string; method: string; fields: string[] }>
    textBlocks: SemanticTextBlock[]
  }
}

const clean = (value: unknown, max = 1200): string => {
  const text = String(value ?? '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).trimEnd() : text
}

const attr = (html: string, name: string): string => {
  const re = new RegExp(`\\b${name}\\s*=\\s*([\"'])([\\s\\S]*?)\\1`, 'i')
  return clean(String(html || '').match(re)?.[2] || '', 800)
}

const resolveUrl = (baseUrl: string, raw: string): string => {
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return clean(raw, 800)
  }
}

const blankSnapshot = (url: string, title: string): WebsiteSemanticSnapshotV1 => ({
  version: 1,
  source: 'website-semantic-snapshot',
  url,
  title,
  summary: { headings: 0, links: 0, controls: 0, media: 0, tables: 0, lists: 0, forms: 0, textBlocks: 0 },
  queryData: { headings: [], links: [], controls: [], media: [], tables: [], lists: [], forms: [], textBlocks: [] },
})

const pushLimited = <T,>(items: T[], item: T, maxItems: number) => {
  if (items.length < maxItems) items.push(item)
}

function buildFromDom(doc: Document, args: { url: string; title: string; maxItems: number }): WebsiteSemanticSnapshotV1 {
  const snapshot = blankSnapshot(args.url, args.title || clean(doc.title || doc.querySelector('h1')?.textContent || ''))
  doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    const text = clean(el.textContent)
    if (text) pushLimited(snapshot.queryData.headings, { level: Number(el.tagName.slice(1)) || 0, text }, args.maxItems)
  })
  doc.querySelectorAll('a[href]').forEach(el => {
    const href = resolveUrl(args.url, el.getAttribute('href') || '')
    const text = clean(el.getAttribute('aria-label') || el.textContent || href, 500)
    if (href) pushLimited(snapshot.queryData.links, { text, href }, args.maxItems)
  })
  doc.querySelectorAll('button,[role="button"],[role="tab"],[role="switch"]').forEach(el => {
    const text = clean(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '', 500)
    if (text) pushLimited(snapshot.queryData.controls, { tag: el.tagName.toLowerCase(), text }, args.maxItems)
  })
  doc.querySelectorAll('img,video,audio,iframe').forEach(el => {
    const kind = el.tagName.toLowerCase()
    const src = resolveUrl(args.url, el.getAttribute(kind === 'video' ? 'poster' : 'src') || el.getAttribute('src') || '')
    if (src) pushLimited(snapshot.queryData.media, { kind, src, alt: clean(el.getAttribute('alt') || el.getAttribute('aria-label') || '', 500) || undefined }, args.maxItems)
  })
  doc.querySelectorAll('table').forEach(el => {
    const rows = Array.from(el.querySelectorAll('tr'))
    const columns = rows.reduce((max, row) => Math.max(max, row.querySelectorAll('th,td').length), 0)
    pushLimited(snapshot.queryData.tables, { rows: rows.length, columns, text: clean(el.textContent) }, args.maxItems)
  })
  doc.querySelectorAll('ul,ol').forEach(el => {
    const items = Array.from(el.querySelectorAll(':scope > li')).map(li => clean(li.textContent, 500)).filter(Boolean)
    if (items.length) pushLimited(snapshot.queryData.lists, { ordered: el.tagName.toLowerCase() === 'ol', items }, args.maxItems)
  })
  doc.querySelectorAll('form').forEach(el => {
    const fields = Array.from(el.querySelectorAll('input,textarea,select')).map(field => clean(field.getAttribute('name') || field.getAttribute('aria-label') || field.getAttribute('placeholder') || '', 300)).filter(Boolean)
    pushLimited(snapshot.queryData.forms, { action: resolveUrl(args.url, el.getAttribute('action') || ''), method: clean(el.getAttribute('method') || 'get', 20).toLowerCase(), fields }, args.maxItems)
  })
  doc.querySelectorAll('p,li,blockquote,pre,code').forEach(el => {
    const text = clean(el.textContent)
    if (text) pushLimited(snapshot.queryData.textBlocks, { tag: el.tagName.toLowerCase(), text }, args.maxItems * 3)
  })
  return finalizeSnapshot(snapshot)
}

function buildFromText(html: string, args: { url: string; title: string; maxItems: number }): WebsiteSemanticSnapshotV1 {
  const snapshot = blankSnapshot(args.url, args.title || clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || ''))
  const body = String(html || '').replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
  let m: RegExpExecArray | null
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi
  while ((m = headingRe.exec(body))) pushLimited(snapshot.queryData.headings, { level: Number(m[1]) || 0, text: clean(m[2]) }, args.maxItems)
  const linkRe = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi
  while ((m = linkRe.exec(body))) {
    const href = resolveUrl(args.url, attr(m[1] || '', 'href'))
    if (href) pushLimited(snapshot.queryData.links, { text: clean(m[2]) || href, href }, args.maxItems)
  }
  const buttonRe = /<(button|[^>\s]+[^>]*\brole\s*=\s*["'](?:button|tab|switch)["'][^>]*)\b([^>]*)>([\s\S]*?)<\/[^>]+>/gi
  while ((m = buttonRe.exec(body))) {
    const tag = String(m[1] || 'button').split(/\s+/)[0].replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'button'
    const text = clean(attr(`${m[1] || ''} ${m[2] || ''}`, 'aria-label') || m[3])
    if (text) pushLimited(snapshot.queryData.controls, { tag, text }, args.maxItems)
  }
  const mediaRe = /<(img|video|audio|iframe)\b([^>]*)>/gi
  while ((m = mediaRe.exec(body))) {
    const kind = String(m[1] || '').toLowerCase()
    const src = resolveUrl(args.url, attr(m[2] || '', kind === 'video' ? 'poster' : 'src') || attr(m[2] || '', 'src'))
    if (src) pushLimited(snapshot.queryData.media, { kind, src, alt: attr(m[2] || '', 'alt') || undefined }, args.maxItems)
  }
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi
  while ((m = tableRe.exec(body))) {
    const table = String(m[1] || '')
    const rows = (table.match(/<tr\b/gi) || []).length
    const columns = Math.max(0, ...Array.from(table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)).map(row => (String(row[1] || '').match(/<t[dh]\b/gi) || []).length))
    pushLimited(snapshot.queryData.tables, { rows, columns, text: clean(table) }, args.maxItems)
  }
  const listRe = /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi
  while ((m = listRe.exec(body))) {
    const items = Array.from(String(m[2] || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)).map(li => clean(li[1], 500)).filter(Boolean)
    if (items.length) pushLimited(snapshot.queryData.lists, { ordered: String(m[1]).toLowerCase() === 'ol', items }, args.maxItems)
  }
  Array.from(body.matchAll(/<(p|li|blockquote|pre|code)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)).forEach(block => {
    const text = clean(block[2])
    if (text) pushLimited(snapshot.queryData.textBlocks, { tag: String(block[1]).toLowerCase(), text }, args.maxItems * 3)
  })
  return finalizeSnapshot(snapshot)
}

function finalizeSnapshot(snapshot: WebsiteSemanticSnapshotV1): WebsiteSemanticSnapshotV1 {
  snapshot.summary = {
    headings: snapshot.queryData.headings.length,
    links: snapshot.queryData.links.length,
    controls: snapshot.queryData.controls.length,
    media: snapshot.queryData.media.length,
    tables: snapshot.queryData.tables.length,
    lists: snapshot.queryData.lists.length,
    forms: snapshot.queryData.forms.length,
    textBlocks: snapshot.queryData.textBlocks.length,
  }
  return snapshot
}

export function buildWebsiteSemanticSnapshotFromHtml(args: { html: string; url: string; title?: string; maxItems?: number }): WebsiteSemanticSnapshotV1 {
  const html = String(args.html || '')
  const url = clean(args.url, 1000)
  const maxItems = Math.max(20, Math.min(2000, Math.floor(Number(args.maxItems) || 800)))
  if (typeof DOMParser !== 'undefined') {
    try {
      return buildFromDom(new DOMParser().parseFromString(html, 'text/html'), { url, title: clean(args.title || ''), maxItems })
    } catch {
      void 0
    }
  }
  return buildFromText(html, { url, title: clean(args.title || ''), maxItems })
}
