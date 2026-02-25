import { stripTrailingPunctuation, truncate } from './webpageMarkdownArtifactAsciiPrivate'

export type AssetKind = 'image' | 'stylesheet' | 'script' | 'video' | 'audio' | 'icon'

export type AssetItem = {
  kind: AssetKind
  url: string
  label?: string
}

export type NavMenuItem = {
  label: string
  href: string
  items?: Array<{ label: string; href: string }>
}

export type MainSection = { heading: string; level: number; blocks: string[]; synthetic?: boolean }

export const safeText = (raw: unknown): string => String(raw ?? '').replace(/\s+/g, ' ').trim()

const cleanBlockText = (raw: string): string => {
  const t = String(raw || '')
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return t
}

export const readTextExcludingNoisyTags = (root: HTMLElement): string => {
  const parts: string[] = []
  const push = (s: string) => {
    const t = String(s || '')
    if (!t) return
    parts.push(t)
  }
  const pushBreak = () => {
    if (!parts.length) {
      parts.push('\n')
      return
    }
    const last = parts[parts.length - 1] || ''
    if (last.endsWith('\n\n')) return
    if (last.endsWith('\n')) {
      parts[parts.length - 1] = `${last}\n`
      return
    }
    parts.push('\n')
  }
  const pushBlockBreak = () => {
    if (!parts.length) {
      parts.push('\n\n')
      return
    }
    const last = parts[parts.length - 1] || ''
    if (last.endsWith('\n\n')) return
    if (last.endsWith('\n')) {
      parts[parts.length - 1] = `${last}\n`
      return
    }
    parts.push('\n\n')
  }

  const blockTags = new Set([
    'p',
    'div',
    'section',
    'article',
    'header',
    'footer',
    'main',
    'nav',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ])
  const noisyTags = new Set(['script', 'style', 'noscript', 'svg'])

  const walk = (node: Node) => {
    if ((node as unknown as { nodeType?: unknown }).nodeType === 3) {
      push(String((node as Text).nodeValue || ''))
      return
    }
    if ((node as unknown as { nodeType?: unknown }).nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName ? el.tagName.toLowerCase() : ''
    if (!tag) return
    if (noisyTags.has(tag)) return
    if (tag === 'br') {
      pushBreak()
      return
    }
    const isBlock = blockTags.has(tag)
    if (isBlock) pushBlockBreak()
    const children = Array.from(el.childNodes)
    for (const c of children) walk(c)
    if (isBlock) pushBlockBreak()
  }
  walk(root)
  return cleanBlockText(parts.join(''))
}

export const slugify = (raw: string): string => {
  const s = safeText(raw)
    .toLowerCase()
    .replace(/[\u2000-\u206f\u2e00-\u2e7f'"“”‘’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'section'
}

export const resolveUrl = (baseUrl: string, value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return raw
  }
}

export const extractPlatform = (doc: Document): string => {
  const g = doc.querySelector('meta[name="generator" i]')
  const content = safeText(g?.getAttribute('content') || '')
  if (content) {
    if (/wordpress/i.test(content)) return 'WordPress'
    return truncate(content, 48)
  }
  return ''
}

export const scrapeDate = (): string => {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const scrapeDateTime = (): string => {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().replace('T', ' ').slice(0, 19)
}

export const pickPrimaryContentRoot = (doc: Document): HTMLElement => {
  const uniq = <T>(items: Array<T | null | undefined>): T[] => {
    const out: T[] = []
    const seen = new Set<T>()
    for (const it of items) {
      if (!it) continue
      if (seen.has(it)) continue
      seen.add(it)
      out.push(it)
    }
    return out
  }

  const body = (doc.body || doc.documentElement) as HTMLElement

  const candidates = uniq<HTMLElement>([
    doc.querySelector('main') as HTMLElement | null,
    doc.querySelector('[role="main"]') as HTMLElement | null,
    doc.querySelector('article') as HTMLElement | null,
    doc.querySelector('#content') as HTMLElement | null,
    doc.querySelector('#main') as HTMLElement | null,
    doc.querySelector('#__next') as HTMLElement | null,
    doc.querySelector('#root') as HTMLElement | null,
    doc.querySelector('.content') as HTMLElement | null,
    doc.querySelector('.main') as HTMLElement | null,
    body,
  ])

  const score = (el: HTMLElement): number => {
    const textLen = readTextExcludingNoisyTags(el).length
    const links = el.querySelectorAll('a').length
    const buttons = el.querySelectorAll('button,[role="button"]').length
    const penalty = Math.min(textLen, links * 18 + buttons * 22)
    return textLen - penalty
  }

  const scored = candidates
    .map((el) => ({ el, s: score(el), t: readTextExcludingNoisyTags(el).length }))
    .sort((a, b) => b.s - a.s)

  const best = scored[0]?.el || body
  const bestTextLen = scored[0]?.t ?? readTextExcludingNoisyTags(best).length
  if (best !== body && bestTextLen < 200) {
    const bodyTextLen = readTextExcludingNoisyTags(body).length
    if (bodyTextLen > bestTextLen) return body
  }
  return best
}

export const pickHeaderRoot = (doc: Document): HTMLElement | null => {
  const header = doc.querySelector('header')
  if (header) return header as HTMLElement
  const nav = doc.querySelector('nav')
  if (nav) return (nav.closest('header') as HTMLElement | null) || (nav as HTMLElement)
  const score = (el: HTMLElement): number => {
    const id = safeText(el.getAttribute('id') || '')
    const cls = safeText(el.getAttribute('class') || '')
    const role = safeText(el.getAttribute('role') || '')
    const aria = safeText(el.getAttribute('aria-label') || '')
    const links = el.querySelectorAll('a').length
    const buttons = el.querySelectorAll('button').length
    let s = 0
    if (role.toLowerCase() === 'navigation') s += 40
    if (el.hasAttribute('data-menu')) s += 30
    if (/\b(nav|menu|header)\b/i.test(`${id} ${cls} ${aria}`)) s += 24
    if (el.querySelector('button[aria-label]') && /navigation|menu/i.test(safeText((el.querySelector('button[aria-label]') as HTMLElement | null)?.getAttribute('aria-label') || ''))) {
      s += 18
    }
    s += Math.min(30, links * 3)
    s += Math.min(10, buttons)
    return s
  }

  const candidates = Array.from(doc.querySelectorAll('[role="navigation"], [aria-label*="Navigation" i], [aria-label*="menu" i]')) as HTMLElement[]
  const extra = Array.from(doc.querySelectorAll('[id*="nav" i], [class*="nav" i], [id*="menu" i], [class*="menu" i], [id*="header" i], [class*="header" i]')) as HTMLElement[]
  const all = [...candidates, ...extra]
    .filter((el) => el && el.tagName && (el.tagName.toLowerCase() === 'div' || el.tagName.toLowerCase() === 'section' || el.tagName.toLowerCase() === 'header' || el.tagName.toLowerCase() === 'nav'))
    .filter((el) => el.querySelectorAll('a').length >= 2 || el.querySelectorAll('button').length >= 1)

  const best = all.sort((a, b) => score(b) - score(a))[0]
  return best || null
}

export const pickFooterRoot = (doc: Document): HTMLElement | null => {
  const footer = doc.querySelector('footer')
  if (footer) return footer as HTMLElement
  const contentInfo = doc.querySelector('[role="contentinfo"]') as HTMLElement | null
  if (contentInfo) return contentInfo
  const candidates = Array.from(doc.querySelectorAll('[id*="footer" i], [class*="footer" i]')) as HTMLElement[]
  const best = candidates.filter((el) => el.querySelectorAll('a').length >= 2).slice(-1)[0]
  return best || null
}

export const renderSimpleBox = (lines: string[], opts?: { width?: number }) => {
  const width = Math.max(50, Math.min(96, Math.floor(opts?.width ?? 72)))
  const inner = width - 2
  const top = `┌${'─'.repeat(inner)}┐`
  const bot = `└${'─'.repeat(inner)}┘`
  const body = (lines.length ? lines : ['']).map((l) => {
    const t = truncate(String(l || ''), inner)
    return `│${t.padEnd(inner, ' ')}│`
  })
  return [top, ...body, bot].join('\n')
}

export const extractSkipLink = (doc: Document): { text: string; href: string } | null => {
  const anchors = Array.from(doc.querySelectorAll('a[href^="#"]'))
  for (const a of anchors) {
    const text = safeText((a as HTMLElement).innerText || a.textContent || '')
    const href = safeText(a.getAttribute('href') || '')
    if (!href.startsWith('#')) continue
    if (!/\bskip\b/i.test(text)) continue
    return { text: text || 'Skip to content', href }
  }
  return null
}

export const extractLogoCandidates = (header: HTMLElement | null, baseUrl: string): Array<{ imgUrl: string; href: string; alt: string }> => {
  if (!header) return []
  const out: Array<{ imgUrl: string; href: string; alt: string }> = []
  const links = Array.from(header.querySelectorAll('a'))
  for (const a of links) {
    const img = a.querySelector('img')
    if (!img) continue
    const src = safeText(img.getAttribute('src') || img.getAttribute('data-src') || '')
    if (!src) continue
    const imgUrl = resolveUrl(baseUrl, src)
    const href = resolveUrl(baseUrl, safeText(a.getAttribute('href') || ''))
    const alt = safeText(img.getAttribute('alt') || '')
    if (!imgUrl) continue
    out.push({ imgUrl, href, alt })
    if (out.length >= 6) break
  }
  if (!out.length) {
    const imgs = Array.from(header.querySelectorAll('img')) as HTMLElement[]
    for (const img of imgs) {
      const src = safeText(img.getAttribute('src') || img.getAttribute('data-src') || '')
      if (!src) continue
      const imgUrl = resolveUrl(baseUrl, src)
      if (!imgUrl) continue
      const alt = safeText(img.getAttribute('alt') || '')
      out.push({ imgUrl, href: '', alt })
      if (out.length >= 3) break
    }
  }
  return out
}

export const extractNavMenus = (header: HTMLElement | null, baseUrl: string): NavMenuItem[] => {
  if (!header) return []
  const nav =
    (header.querySelector('nav') as HTMLElement | null) ||
    (header.querySelector('[role="navigation"]') as HTMLElement | null) ||
    (header.tagName.toLowerCase() === 'nav' ? header : null) ||
    header

  const cleanLabel = (raw: string) => {
    const s = safeText(raw)
      .replace(/\s*(?:expand|collapse|open|close)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    return s
  }

  const ul = nav.querySelector('ul')
  const out: NavMenuItem[] = []
  if (ul) {
    const lis = Array.from(ul.children).filter((c) => (c as HTMLElement).tagName.toLowerCase() === 'li') as HTMLElement[]
    for (const li of lis) {
      const a = li.querySelector(':scope > a, :scope > button, :scope > span') as HTMLElement | null
      const label = cleanLabel(a?.innerText || a?.textContent || '')
      const hrefEl = (a && a.tagName.toLowerCase() === 'a' ? (a as HTMLAnchorElement) : null) as HTMLAnchorElement | null
      const href = hrefEl ? resolveUrl(baseUrl, safeText(hrefEl.getAttribute('href') || '')) : ''
      const submenu = li.querySelector(':scope ul') as HTMLElement | null
      const items: Array<{ label: string; href: string }> = []
      if (submenu) {
        const subLinks = Array.from(submenu.querySelectorAll('a')) as HTMLAnchorElement[]
        for (const sa of subLinks) {
          const sl = cleanLabel((sa as HTMLElement).innerText || sa.textContent || '')
          const sh = resolveUrl(baseUrl, safeText(sa.getAttribute('href') || ''))
          if (!sl && !sh) continue
          items.push({ label: sl || sh, href: sh })
          if (items.length >= 18) break
        }
      }
      if (!label && !href && items.length === 0) continue
      out.push({ label: label || href || 'Menu', href, items: items.length ? items : undefined })
      if (out.length >= 10) break
    }
    return out
  }

  const links = Array.from(nav.querySelectorAll('a')) as HTMLAnchorElement[]
  for (const a of links) {
    const label = cleanLabel((a as HTMLElement).innerText || a.textContent || a.getAttribute('aria-label') || a.getAttribute('title') || '')
    const href = resolveUrl(baseUrl, safeText(a.getAttribute('href') || ''))
    if (!label && !href) continue
    if (label && label.length > 80) continue
    out.push({ label: label || href, href })
    if (out.length >= 10) break
  }
  return out
}

export const extractAssets = (doc: Document, baseUrl: string): AssetItem[] => {
  const out: AssetItem[] = []
  const push = (it: AssetItem) => {
    if (!it.url) return
    const url = it.url.trim()
    if (!url) return
    if (out.some((x) => x.kind === it.kind && x.url === url && safeText(x.label || '') === safeText(it.label || ''))) return
    out.push({ ...it, url })
  }

  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = safeText(img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '')
    const alt = safeText(img.getAttribute('alt') || '')
    if (src) push({ kind: 'image', url: resolveUrl(baseUrl, src), label: alt })
    const srcset = safeText(img.getAttribute('srcset') || '')
    if (srcset) {
      for (const part of srcset.split(',')) {
        const url = safeText(part.split(/\s+/)[0] || '')
        if (!url) continue
        push({ kind: 'image', url: resolveUrl(baseUrl, url), label: alt })
      }
    }
  }

  for (const link of Array.from(doc.querySelectorAll('link[rel]'))) {
    const rel = safeText(link.getAttribute('rel') || '').toLowerCase()
    const href = safeText(link.getAttribute('href') || '')
    if (!href) continue
    if (rel.includes('stylesheet')) push({ kind: 'stylesheet', url: resolveUrl(baseUrl, href) })
    else if (rel.includes('icon')) push({ kind: 'icon', url: resolveUrl(baseUrl, href) })
  }

  for (const s of Array.from(doc.querySelectorAll('script[src]'))) {
    const src = safeText(s.getAttribute('src') || '')
    if (!src) continue
    push({ kind: 'script', url: resolveUrl(baseUrl, src) })
  }

  const mediaTags: Array<{ kind: AssetKind; selector: string }> = [
    { kind: 'video', selector: 'video' },
    { kind: 'audio', selector: 'audio' },
  ]
  for (const mt of mediaTags) {
    const els = Array.from(doc.querySelectorAll(mt.selector)) as HTMLElement[]
    for (const el of els) {
      const directSrc = safeText(el.getAttribute('src') || '')
      if (directSrc) push({ kind: mt.kind, url: resolveUrl(baseUrl, directSrc) })
      const sources = Array.from(el.querySelectorAll('source')) as HTMLElement[]
      for (const s of sources) {
        const src = safeText(s.getAttribute('src') || '')
        if (!src) continue
        push({ kind: mt.kind, url: resolveUrl(baseUrl, src) })
      }
    }
  }

  return out
}

export const escapeMarkdownText = (raw: string): string => {
  const s = String(raw || '')
  if (!s) return ''
  return s.replace(/[[\\`*_]|\]/g, (m) => `\\${m}`)
}

const inlineToMarkdown = (node: Node, baseUrl: string): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent || '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return '\n'
  if (tag === 'strong' || tag === 'b') {
    const inner = Array.from(el.childNodes).map((c) => inlineToMarkdown(c, baseUrl)).join('')
    return inner.trim() ? `**${inner.trim()}**` : ''
  }
  if (tag === 'em' || tag === 'i') {
    const inner = Array.from(el.childNodes).map((c) => inlineToMarkdown(c, baseUrl)).join('')
    return inner.trim() ? `*${inner.trim()}*` : ''
  }
  if (tag === 'code') {
    const inner = safeText(el.textContent || '')
    return inner ? `\`${inner.replace(/`/g, '\\`')}\`` : ''
  }
  if (tag === 'a') {
    const href = resolveUrl(baseUrl, safeText(el.getAttribute('href') || ''))
    const text = safeText((el as HTMLElement).innerText || el.textContent || '')
    if (!href) return escapeMarkdownText(text)
    return `[${escapeMarkdownText(text) || href}](${href})`
  }
  if (tag === 'img') {
    const src = resolveUrl(baseUrl, safeText(el.getAttribute('src') || el.getAttribute('data-src') || ''))
    const alt = safeText(el.getAttribute('alt') || '')
    return src ? `![${escapeMarkdownText(alt)}](${src})` : ''
  }
  return Array.from(el.childNodes).map((c) => inlineToMarkdown(c, baseUrl)).join('')
}

const normalizeInlineMarkdownText = (raw: string): string => {
  const parts = String(raw || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => safeText(l))
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const shouldRenderAsLinksList = (el: HTMLElement): boolean => {
  const links = Array.from(el.querySelectorAll('a[href]')) as HTMLAnchorElement[]
  if (links.length < 3 || links.length > 42) return false
  const hasStructural = !!el.querySelector('p,ul,ol,table,pre,blockquote')
  if (hasStructural) return false
  const labels = links
    .map(a => safeText((a as HTMLElement).innerText || a.textContent || a.getAttribute('aria-label') || a.getAttribute('title') || ''))
    .map(t => (t.length > 64 ? '' : t))
    .filter(Boolean)
  const unique = labels.filter((l, i) => labels.findIndex(x => x.toLowerCase() === l.toLowerCase()) === i)
  if (unique.length < 3) return false
  const fullText = safeText(el.innerText || el.textContent || '')
  const sum = unique.reduce((s, t) => s + t.length, 0)
  if (!fullText) return false
  if (fullText.length > Math.max(140, Math.floor(sum * 2.2))) return false
  return true
}

const renderLinksList = (el: HTMLElement, baseUrl: string): string => {
  const links = Array.from(el.querySelectorAll('a[href]')) as HTMLAnchorElement[]
  const items: string[] = []
  for (const a of links) {
    const text = safeText((a as HTMLElement).innerText || a.textContent || a.getAttribute('aria-label') || a.getAttribute('title') || '')
    const href = resolveUrl(baseUrl, safeText(a.getAttribute('href') || ''))
    if (!text || !href) continue
    if (items.some(x => x.toLowerCase() === text.toLowerCase())) continue
    items.push(`- [${escapeMarkdownText(text)}](${href})`)
    if (items.length >= 36) break
  }
  return items.join('\n')
}

export const renderAsciiGridTable = (rows: string[][]) => {
  if (!rows.length) return ''
  const maxCols = Math.max(...rows.map((r) => r.length))
  const normalized = rows.map((r) => {
    const out = [...r]
    while (out.length < maxCols) out.push('')
    return out
  })
  const widths = Array.from({ length: maxCols }).map((_, c) => {
    let w = 1
    for (const r of normalized) w = Math.max(w, safeText(r[c] || '').length)
    return Math.min(52, w)
  })
  const pad = (s: string, w: number) => {
    const t = safeText(s)
    const clipped = t.length > w ? `${t.slice(0, Math.max(0, w - 1)).trimEnd()}…` : t
    return ` ${clipped.padEnd(w, ' ')} `
  }
  const top = `┌${widths.map((w) => '─'.repeat(w + 2)).join('┬')}┐`
  const mid = `├${widths.map((w) => '─'.repeat(w + 2)).join('┼')}┤`
  const bot = `└${widths.map((w) => '─'.repeat(w + 2)).join('┴')}┘`
  const out: string[] = []
  out.push(top)
  for (let i = 0; i < normalized.length; i += 1) {
    const r = normalized[i]
    out.push(`│${r.map((cell, idx) => pad(cell, widths[idx] || 1)).join('│')}│`)
    if (i === 0 && normalized.length > 1) out.push(mid)
  }
  out.push(bot)
  return out.join('\n')
}

export const htmlTableToMarkdown = (table: HTMLElement): { ascii: string; markdown: string } => {
  const rows: string[][] = []
  const mdRows: string[][] = []
  const trs = Array.from(table.querySelectorAll('tr'))
  for (const tr of trs) {
    const cells = Array.from(tr.querySelectorAll('th,td')) as HTMLElement[]
    const row: string[] = []
    for (const cell of cells) row.push(safeText((cell as HTMLElement).innerText || cell.textContent || ''))
    if (row.some(Boolean)) {
      rows.push(row)
      mdRows.push(row)
    }
    if (rows.length >= 60) break
  }
  const ascii = renderAsciiGridTable(rows)
  if (!mdRows.length) return { ascii, markdown: '' }
  const colCount = Math.max(...mdRows.map((r) => r.length))
  const norm = mdRows.map((r) => {
    const out = [...r]
    while (out.length < colCount) out.push('')
    return out
  })
  const header = norm[0] || []
  const md: string[] = []
  md.push(`| ${header.map((c) => escapeMarkdownText(c)).join(' | ')} |`)
  md.push(`| ${header.map(() => '---').join(' | ')} |`)
  for (let i = 1; i < norm.length; i += 1) md.push(`| ${norm[i].map((c) => escapeMarkdownText(c)).join(' | ')} |`)
  return { ascii, markdown: md.join('\n') }
}

const blockToMarkdown = (el: HTMLElement, baseUrl: string): string => {
  const tag = el.tagName.toLowerCase()
  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg') return ''
  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1))
    const t = safeText(el.innerText || el.textContent || '')
    return t ? `${'#'.repeat(level)} ${t}` : ''
  }
  if (tag === 'p') {
    const t = safeText(el.innerText || el.textContent || '')
    if (!t) return ''
    return safeText(Array.from(el.childNodes).map((c) => inlineToMarkdown(c, baseUrl)).join('')) || t
  }
  if (tag === 'ul' || tag === 'ol') {
    const isOl = tag === 'ol'
    const items = Array.from(el.querySelectorAll(':scope > li')) as HTMLElement[]
    const out: string[] = []
    for (let i = 0; i < items.length; i += 1) {
      const li = items[i]
      const parts: string[] = []
      for (const n of Array.from(li.childNodes)) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const childEl = n as HTMLElement
          const childTag = childEl.tagName.toLowerCase()
          if (childTag === 'ul' || childTag === 'ol') continue
        }
        parts.push(inlineToMarkdown(n, baseUrl))
      }
      const t = normalizeInlineMarkdownText(parts.join(''))
      if (!t) continue
      const prefix = isOl ? `${i + 1}. ` : '* '
      out.push(prefix + t)
    }
    return out.join('\n')
  }
  if (tag === 'table') {
    const rendered = htmlTableToMarkdown(el)
    const parts: string[] = []
    if (rendered.ascii) parts.push(['```', rendered.ascii, '```'].join('\n'))
    if (rendered.markdown) parts.push(rendered.markdown)
    return parts.join('\n\n')
  }
  if (tag === 'blockquote') {
    const t = safeText(el.innerText || el.textContent || '')
    if (!t) return ''
    return t
      .split(/\r?\n/)
      .map((l) => `> ${l}`)
      .join('\n')
  }
  if (tag === 'pre') {
    const t = String(el.textContent || '').replace(/\r?\n$/, '')
    if (!t.trim()) return ''
    return ['```', t, '```'].join('\n')
  }
  if (tag === 'img') return inlineToMarkdown(el, baseUrl)
  if (tag === 'hr') return '---'
  if (shouldRenderAsLinksList(el)) return renderLinksList(el, baseUrl)
  return readTextExcludingNoisyTags(el)
}

const extractMainSectionsInternal = (
  root: HTMLElement,
  baseUrl: string,
  opts?: { allowNoscriptFallback?: boolean },
): MainSection[] => {
  const blockTags = new Set(['p', 'ul', 'ol', 'table', 'pre', 'blockquote', 'hr', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
  const blockSelector = Array.from(blockTags).join(',')
  const blocks: HTMLElement[] = []

  const isNavLike = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'nav') return true
    const role = safeText(el.getAttribute('role') || '').toLowerCase()
    if (role === 'navigation') return true
    const aria = safeText(el.getAttribute('aria-label') || '')
    if (/\bnav\b|\bmenu\b/i.test(aria)) return true
    const id = safeText(el.getAttribute('id') || '')
    const cls = safeText(el.getAttribute('class') || '')
    if (/\bnav\b|\bmenu\b/i.test(`${id} ${cls}`) && el.querySelectorAll('a').length >= 2) return true
    return false
  }

  const walk = (node: HTMLElement) => {
    const children = Array.from(node.children) as HTMLElement[]
    for (const child of children) {
      const tag = child.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg') continue
      if (isNavLike(child)) continue
      if (blockTags.has(tag)) {
        blocks.push(child)
        continue
      }
      const text = readTextExcludingNoisyTags(child)
      if (text && text.length <= 5000) {
        const hasBlockDescendant = !!child.querySelector(blockSelector)
        if (!hasBlockDescendant) {
          blocks.push(child)
          continue
        }
      }
      walk(child)
    }
  }
  walk(root)

  const sections: MainSection[] = []
  let current: MainSection | null = null
  const startSection = (heading: string, level: number, options?: { synthetic?: boolean }) => {
    const h = stripTrailingPunctuation(safeText(heading))
    current = { heading: h || 'Section', level, blocks: [], synthetic: options?.synthetic === true }
    sections.push(current)
  }

  for (const el of blocks) {
    const tag = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1))
      const text = safeText(el.innerText || el.textContent || '')
      if (text) startSection(text, level)
      continue
    }
    if (!current) startSection('Content', 2, { synthetic: true })
    const md = blockToMarkdown(el, baseUrl)
    const raw = md.trim()
    if (!raw) continue
    if (raw.length > 500 && raw.includes('\n\n') && !raw.startsWith('```')) {
      const parts = raw.split(/\n{2,}/g).map((x) => x.trim()).filter(Boolean)
      if (parts.length > 1) {
        for (const p of parts) {
          current.blocks.push(p)
          if (current.blocks.length >= 600) break
        }
        continue
      }
    }
    current.blocks.push(raw)
  }

  const filtered = sections.filter((s) => s.heading && s.blocks.some((b) => b.trim()))
  if (filtered.length === 1 && filtered[0]?.heading === 'Content') {
    const src = filtered[0]
    const isHeadingCandidate = (tRaw: string, nextRaw: string | null): boolean => {
      const t = String(tRaw || '').trim()
      if (!t) return false
      if (t.includes('\n')) return false
      if (t.length < 4 || t.length > 90) return false
      if (/^(?:\*|-|\d+\.)\s+/.test(t)) return false
      if (t.endsWith('?')) return true
      const words = t.split(/\s+/).filter(Boolean)
      if (words.length < 2 || words.length > 10) return false
      const letters = t.replace(/[^A-Za-z]/g, '')
      if (letters.length >= 6 && t === t.toUpperCase()) return true
      const next = String(nextRaw || '').trim()
      if (!next || next.length < 50) return false
      if (/^[A-Z][A-Za-z0-9'-]*(?:\s+[A-Z][A-Za-z0-9'-]*){1,9}\??$/.test(t)) return true
      return false
    }

    const derived: MainSection[] = []
    let cur: MainSection = { heading: 'Content', level: 2, blocks: [], synthetic: true }
    for (let i = 0; i < src.blocks.length; i += 1) {
      const b = src.blocks[i] || ''
      const next = i + 1 < src.blocks.length ? src.blocks[i + 1] || '' : null
      if (isHeadingCandidate(b, next)) {
        if (cur.blocks.some((x) => x.trim())) derived.push(cur)
        cur = { heading: stripTrailingPunctuation(b), level: 3, blocks: [], synthetic: false }
        continue
      }
      cur.blocks.push(b)
      if (derived.length >= 40) break
    }
    if (cur.blocks.some((x) => x.trim()) && derived.length < 40) derived.push(cur)
    return derived.filter((s) => s.heading && s.blocks.some((b) => b.trim()))
  }
  return filtered
}

export const extractMainSections = (root: HTMLElement, baseUrl: string): MainSection[] => {
  const primary = extractMainSectionsInternal(root, baseUrl, { allowNoscriptFallback: true })
  if (primary.length > 0) return primary

  const allowNoscriptFallback = true
  if (!allowNoscriptFallback) return primary

  const noscripts = Array.from(root.querySelectorAll('noscript')) as HTMLElement[]
  if (!noscripts.length) return primary

  for (const ns of noscripts.slice(0, 12)) {
    const payload = String(ns.textContent || '').trim()
    if (!payload) continue
    const looksLikeHtml = payload.includes('<') && payload.includes('>') && /<(?:div|p|main|article|section|h\d|ul|ol|li|table|pre)\b/i.test(payload)
    if (looksLikeHtml) {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(payload, 'text/html')
        const nextRoot = pickPrimaryContentRoot(doc)
        const extracted = extractMainSectionsInternal(nextRoot, baseUrl, { allowNoscriptFallback: false })
        if (extracted.length > 0) return extracted
      } catch {
        void 0
      }
    }
    const text = payload.replace(/\s+/g, ' ').trim()
    if (text.length >= 200) {
      return [{ heading: 'Content', level: 2, blocks: [text], synthetic: true }]
    }
  }

  return primary
}

export const formatRelativeHref = (href: string, pageUrl: string): string => {
  const h = safeText(href)
  if (!h) return ''
  try {
    const u = new URL(h)
    const base = new URL(pageUrl)
    if (u.host !== base.host) return u.toString()
    return u.pathname + (u.search || '') + (u.hash || '')
  } catch {
    return h
  }
}

export const hasMenuToggleButton = (header: HTMLElement): boolean => {
  return !!Array.from(header.querySelectorAll('button,[role="button"]')).find((b) => {
    const t = safeText((b as HTMLElement).innerText || b.getAttribute('aria-label') || '')
    return /toggle|menu/i.test(t)
  })
}

export const pickHeroImage = (main: HTMLElement, header: HTMLElement | null, baseUrl: string): { url: string; alt: string } | null => {
  const candidates = (root: HTMLElement | null): Array<{ src: string; alt: string }> => {
    if (!root) return []
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLElement[]
    const out: Array<{ src: string; alt: string }> = []
    for (const img of imgs) {
      const src = safeText(img.getAttribute('src') || img.getAttribute('data-src') || '')
      if (!src) continue
      const alt = safeText(img.getAttribute('alt') || '')
      out.push({ src, alt })
      if (out.length >= 24) break
    }
    return out
  }

  const mainCandidates = candidates(main)
  const headerCandidates = candidates(header)
  const all = [...mainCandidates, ...headerCandidates]
  if (!all.length) return null

  const score = (c: { src: string; alt: string }): number => {
    const alt = c.alt
    if (!alt) return 200
    if (alt.length > 160) return 180
    if (/^[a-z0-9_-]{40,}$/i.test(alt.replace(/\s+/g, ''))) return 160
    return alt.length
  }
  const best = [...all].sort((a, b) => score(a) - score(b))[0]
  if (!best) return null
  return { url: resolveUrl(baseUrl, best.src), alt: best.alt }
}
