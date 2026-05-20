export type MarkdownCommentMarker =
  | {
      kind: 'author-note'
      raw: string
      body: string
      text: string
      previewText: string
    }
  | {
      kind: 'review-comment'
      raw: string
      body: string
      id: string
      author: string
      text: string
      ref: string | null
      resolved: boolean
      previewText: string
    }
  | {
      kind: 'metadata-entry'
      raw: string
      body: string
      metadataType: string
      value: string
      note: string
      previewText: string
    }
  | {
      kind: 'appendix-open' | 'appendix-close' | 'comment-close'
      raw: string
      body: string
    }
  | {
      kind: 'machine-marker'
      raw: string
      body: string
      marker: string
    }
  | {
      kind: 'plain-comment'
      raw: string
      body: string
      text: string
      previewText: string
    }

const stripCommentWrapper = (raw: string): { raw: string; body: string } => {
  const source = String(raw || '')
  const trimmed = source.trim()
  if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
    return {
      raw: trimmed,
      body: trimmed.slice(4, -3),
    }
  }
  return {
    raw: `<!--${source}-->`,
    body: source,
  }
}

const readTrimmedCommentBody = (body: string): string => {
  return String(body || '').replace(/\r/g, '').trim()
}

const readCommentMeta = (body: string): Record<string, string> => {
  const parts = String(body || '')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
  const out: Record<string, string> = {}
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i] || ''
    const colonIndex = part.indexOf(':')
    if (colonIndex <= 0) continue
    const key = part.slice(0, colonIndex).trim().toLowerCase()
    const value = part.slice(colonIndex + 1).trim()
    if (!key || !value) continue
    out[key] = value
  }
  return out
}

export const parseMarkdownCommentMarker = (rawComment: string): MarkdownCommentMarker => {
  const { raw, body } = stripCommentWrapper(rawComment)
  const trimmedBody = readTrimmedCommentBody(body)

  if (!trimmedBody) {
    return {
      kind: 'plain-comment',
      raw,
      body,
      text: '',
      previewText: '',
    }
  }

  if (trimmedBody.startsWith('//')) {
    const text = trimmedBody.replace(/^\/\/\s*/, '').trim()
    return {
      kind: 'author-note',
      raw,
      body,
      text,
      previewText: text,
    }
  }

  if (trimmedBody === 'appendix') {
    return { kind: 'appendix-open', raw, body }
  }
  if (trimmedBody === '/appendix') {
    return { kind: 'appendix-close', raw, body }
  }
  if (trimmedBody === '/comment') {
    return { kind: 'comment-close', raw, body }
  }

  const parts = trimmedBody
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
  const head = String(parts[0] || '').toLowerCase()
  if (head === 'comment') {
    const meta = readCommentMeta(trimmedBody)
    const id = String(meta.id || '').trim()
    const author = String(meta.author || '').trim()
    const text = String(meta.text || '').trim()
    const ref = String(meta.ref || '').trim() || null
    const resolved = String(meta.resolved || '').trim().toLowerCase() === 'true'
    const previewPrefix = [author, id].filter(Boolean).join(' ')
    return {
      kind: 'review-comment',
      raw,
      body,
      id,
      author,
      text,
      ref,
      resolved,
      previewText: [previewPrefix, text].filter(Boolean).join(': '),
    }
  }

  if (head === 'metadata') {
    const meta = readCommentMeta(trimmedBody)
    const metadataType = String(meta.type || '').trim()
    const value = String(meta.value || '').trim()
    const note = String(meta.note || '').trim()
    return {
      kind: 'metadata-entry',
      raw,
      body,
      metadataType,
      value,
      note,
      previewText: [metadataType, value, note].filter(Boolean).join(': '),
    }
  }

  if (head && parts.length > 1) {
    return {
      kind: 'machine-marker',
      raw,
      body,
      marker: head,
    }
  }

  return {
    kind: 'plain-comment',
    raw,
    body,
    text: trimmedBody,
    previewText: trimmedBody,
  }
}

export type MarkdownAppendixMetadataEntry = {
  raw: string
  metadataType: string
  value: string
  note: string
  lineStart: number
  lineEnd: number
}

export const extractMarkdownAppendixMetadataEntries = (lines: string[]): MarkdownAppendixMetadataEntry[] => {
  const rawLines = Array.isArray(lines) ? lines : []
  const entries: MarkdownAppendixMetadataEntry[] = []
  let inAppendix = false
  for (let i = 0; i < rawLines.length; i += 1) {
    const rawLine = String(rawLines[i] || '')
    const trimmed = rawLine.trim()
    if (!trimmed.startsWith('<!--') || !trimmed.endsWith('-->')) continue
    const parsed = parseMarkdownCommentMarker(trimmed)
    if (parsed.kind === 'appendix-open') {
      inAppendix = true
      continue
    }
    if (parsed.kind === 'appendix-close') {
      inAppendix = false
      continue
    }
    if (!inAppendix || parsed.kind !== 'metadata-entry') continue
    if (!parsed.metadataType || !parsed.value || !parsed.note) continue
    entries.push({
      raw: parsed.raw,
      metadataType: parsed.metadataType,
      value: parsed.value,
      note: parsed.note,
      lineStart: i + 1,
      lineEnd: i + 1,
    })
  }
  return entries
}
