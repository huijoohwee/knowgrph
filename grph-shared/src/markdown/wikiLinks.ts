import { slugify } from './slugify.js'

export const MARKDOWN_WIKI_HREF_PREFIX = '#md-wiki:'

export type ParsedWikiLink = {
  raw: string
  docKey: string | null
  anchorId: string | null
  label: string
}

export const normalizeLooseKey = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

export const buildMarkdownWikiHref = (docKey: string, anchorId?: string | null): string => {
  const doc = String(docKey || '').trim()
  const anchor = typeof anchorId === 'string' ? anchorId.trim() : ''
  const encodedDoc = encodeURIComponent(doc)
  const encodedAnchor = anchor ? encodeURIComponent(anchor) : ''
  return `${MARKDOWN_WIKI_HREF_PREFIX}${encodedDoc}${encodedAnchor ? `~${encodedAnchor}` : ''}`
}

export const parseMarkdownWikiHref = (
  href: string,
): { docKey: string; anchorId: string | null } | null => {
  const raw = String(href || '')
  if (!raw.startsWith(MARKDOWN_WIKI_HREF_PREFIX)) return null
  const body = raw.slice(MARKDOWN_WIKI_HREF_PREFIX.length)
  const [docPartRaw, anchorPartRaw] = body.split('~', 2)
  const docPart = String(docPartRaw || '')
  if (!docPart) return null
  try {
    const docKey = decodeURIComponent(docPart)
    const anchorId = anchorPartRaw ? decodeURIComponent(anchorPartRaw) : null
    return { docKey, anchorId: anchorId && anchorId.trim() ? anchorId.trim() : null }
  } catch {
    return null
  }
}

export const parseWikiLinkInner = (inner: string): ParsedWikiLink => {
  const rawInner = String(inner || '')
  const [targetRaw, labelRaw] = rawInner.split('|', 2)
  const target = String(targetRaw || '').trim()
  const labelOverride = typeof labelRaw === 'string' ? labelRaw.trim() : ''

  if (!target) {
    return { raw: rawInner, docKey: null, anchorId: null, label: labelOverride || rawInner }
  }

  if (target.startsWith('#^')) {
    const id = target.slice(2).trim()
    const anchorId = id ? `^${id}` : null
    return {
      raw: rawInner,
      docKey: null,
      anchorId,
      label: labelOverride || (anchorId || rawInner),
    }
  }

  if (target.startsWith('#')) {
    const heading = target.slice(1).trim()
    const anchorId = heading ? slugify(heading) : null
    return {
      raw: rawInner,
      docKey: null,
      anchorId,
      label: labelOverride || (heading || rawInner),
    }
  }

  const hashIndex = target.indexOf('#')
  const docKey = (hashIndex >= 0 ? target.slice(0, hashIndex) : target).trim()
  const frag = hashIndex >= 0 ? target.slice(hashIndex + 1).trim() : ''

  let anchorId: string | null = null
  if (frag) {
    if (frag.startsWith('^')) {
      const id = frag.slice(1).trim()
      anchorId = id ? `^${id}` : null
    } else {
      anchorId = slugify(frag)
    }
  }

  const label =
    labelOverride ||
    (frag
      ? frag.startsWith('^')
        ? frag
        : frag
      : docKey)

  return {
    raw: rawInner,
    docKey: docKey || null,
    anchorId,
    label: label || rawInner,
  }
}

export const extractWikiLinksFromMarkdown = (markdownText: string): ParsedWikiLink[] => {
  const lines = String(markdownText || '').split(/\r?\n/g)
  const out: ParsedWikiLink[] = []

  let inFence = false
  let fenceMarker = ''

  const fenceRe = /^\s*(```+|~~~+)\s*/
  const wikiRe = /\[\[([^\]\r\n]+)\]\]/g

  for (const line of lines) {
    const fenceMatch = line.match(fenceRe)
    if (fenceMatch) {
      const marker = String(fenceMatch[1] || '')
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (marker.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ''
      }
      continue
    }
    if (inFence) continue

    wikiRe.lastIndex = 0
    for (;;) {
      const m = wikiRe.exec(line)
      if (!m) break
      const matchText = String(m[0] || '')
      const inner = String(m[1] || '')

      const prefix = line.slice(0, m.index)
      const backtickCount = (prefix.match(/`/g) || []).length
      if (backtickCount % 2 === 1) {
        continue
      }
      const parsed = parseWikiLinkInner(inner)
      out.push({ ...parsed, raw: matchText })
    }
  }

  return out
}
