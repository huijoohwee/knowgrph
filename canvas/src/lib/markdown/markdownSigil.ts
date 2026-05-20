import { LRUCache } from '@/lib/cache/LRUCache'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'

export type MarkdownSigil = {
  text: string
  color: string | null
  background: string | null
}

export type MarkdownInlineCodeSemanticReferenceKind =
  | 'node'
  | 'edge'
  | 'media'
  | 'media-row'
  | 'comment'
  | 'callout'

export type MarkdownInlineCodeSemanticValueKind =
  | 'key'
  | 'ui-path'
  | 'id'
  | 'url'
  | 'enum'
  | 'date'
  | 'hash'

export type MarkdownInlineCodeSemantic =
  | {
      kind: 'annotation'
      raw: string
      code: string
      displayText: string
      badgeLabel: 'annotate'
      color: string | null
      background: string | null
    }
  | {
      kind: 'reference'
      raw: string
      code: string
      displayText: string
      badgeLabel: MarkdownInlineCodeSemanticReferenceKind
      referenceKind: MarkdownInlineCodeSemanticReferenceKind
      value: string
    }
  | {
      kind: 'value'
      raw: string
      code: string
      displayText: string
      badgeLabel: MarkdownInlineCodeSemanticValueKind
      valueKind: MarkdownInlineCodeSemanticValueKind
      value: string
    }

export type MarkdownAnnotation = MarkdownSigil & {
  raw: string
  start: number
  end: number
  highlighted: boolean
}

export type MarkdownSigilInlineStyle = {
  color?: string
  backgroundColor?: string
}

const SIGIL_RE = /^(#[0-9a-fA-F]{6})?(\|?bg#[0-9a-fA-F]{6})?:(.+)$/
const HEX6_RE = /^#[0-9a-fA-F]{6}$/
const INLINE_CODE_RE = /`([^`\n]{1,320})`/g
const DEFAULT_HIGHLIGHT_RE = /==([\s\S]*?)==/g
const MAX_ANNOTATIONS = 512
const MAX_ANNOTATION_TEXT_LENGTH = 320
const ANNOTATION_CACHE = new LRUCache<string, MarkdownAnnotation[]>(80, 2 * 60_000)
const INLINE_CODE_SEMANTIC_MAX_LENGTH = 320

const unwrapInlineCodeSource = (rawCell: string): { raw: string; code: string } => {
  const raw = String(rawCell || '').trim()
  if (!raw) return { raw: '', code: '' }
  if (raw.startsWith('`') && raw.endsWith('`') && raw.length >= 2) {
    return {
      raw,
      code: raw.slice(1, -1),
    }
  }
  return {
    raw,
    code: raw,
  }
}

const readCleanSemanticValue = (raw: string): string => {
  return String(raw || '').replace(/\s+/g, ' ').trim()
}

const hasVariableInterpolation = (value: string): boolean => {
  return /{{[\s\S]*?}}/.test(String(value || ''))
}

const isValidUiPathValue = (value: string): boolean => {
  const raw = String(value || '')
  if (!raw.trim()) return false
  if (hasVariableInterpolation(raw)) return false
  if (/[/>]/.test(raw)) return false
  return true
}

const isValidShortcutValue = (value: string): boolean => {
  const raw = String(value || '')
  if (!raw.trim()) return false
  if (hasVariableInterpolation(raw)) return false
  return true
}

const isValidTypedUrlValue = (value: string): boolean => {
  const raw = String(value || '').trim()
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:\/\/\S+$/.test(raw)) return false
  try {
    const url = new URL(raw)
    return !!url.protocol && url.protocol !== ':'
  } catch {
    return false
  }
}

const normalizeHex6 = (value: string): string | null => {
  const raw = String(value || '').trim()
  if (!HEX6_RE.test(raw)) return null
  return raw.toUpperCase()
}

const blankFencedCodeBlocks = (raw: string): string => {
  return String(raw || '').replace(/```[\s\S]*?```/g, match => ' '.repeat(match.length))
}

export const hasMarkdownAnnotationSyntax = (raw: string): boolean => {
  const source = String(raw || '')
  return source.includes('==') || source.includes('`#') || source.includes('`bg#')
}

const readCleanAnnotationText = (raw: string): string => {
  return String(raw || '').replace(/\s+/g, ' ').trim()
}

export const parseMarkdownSigil = (rawCell: string): MarkdownSigil | null => {
  const trimmed = String(rawCell || '').trim()
  const unwrapped = trimmed.replace(/^`|`$/g, '')
  const normalized = unwrapped.replace(/\\\|/g, '|')
  const match = normalized.match(SIGIL_RE)
  if (!match) return null
  const color = normalizeHex6(String(match[1] || ''))
  const background = normalizeHex6(String(match[2] || '').replace('|bg#', '#').replace('bg#', '#'))
  return {
    text: String(match[3] || ''),
    color,
    background,
  }
}

export const parseMarkdownInlineCodeSemantic = (rawCell: string): MarkdownInlineCodeSemantic | null => {
  const source = unwrapInlineCodeSource(rawCell)
  if (!source.code || source.code.length > INLINE_CODE_SEMANTIC_MAX_LENGTH) return null
  const annotation = parseMarkdownSigil(source.code)
  if (annotation) {
    return {
      kind: 'annotation',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: readCleanSemanticValue(annotation.text) || source.code,
      badgeLabel: 'annotate',
      color: annotation.color,
      background: annotation.background,
    }
  }
  const nodeMatch = source.code.match(/^@node:(.+)$/)
  if (nodeMatch) {
    const value = readCleanSemanticValue(String(nodeMatch[1] || ''))
    if (!value) return null
    const referenceKind: MarkdownInlineCodeSemanticReferenceKind =
      value.startsWith('callout-')
        ? 'callout'
        : value.startsWith('mr-')
        ? 'media-row'
        : value.startsWith('m-')
        ? 'media'
        : 'node'
    return {
      kind: 'reference',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: value,
      badgeLabel: referenceKind,
      referenceKind,
      value,
    }
  }
  const edgeMatch = source.code.match(/^@edge:(.+)$/)
  if (edgeMatch) {
    const value = readCleanSemanticValue(String(edgeMatch[1] || ''))
    if (!value) return null
    return {
      kind: 'reference',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: value,
      badgeLabel: 'edge',
      referenceKind: 'edge',
      value,
    }
  }
  const commentMatch = source.code.match(/^@comment:(.+)$/)
  if (commentMatch) {
    const value = readCleanSemanticValue(String(commentMatch[1] || ''))
    if (!value) return null
    return {
      kind: 'reference',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: value,
      badgeLabel: 'comment',
      referenceKind: 'comment',
      value,
    }
  }
  const keyMatch = source.code.match(/^@key:(.+)$/)
  if (keyMatch) {
    const value = readCleanSemanticValue(String(keyMatch[1] || ''))
    if (!isValidShortcutValue(value)) return null
    return {
      kind: 'value',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: value,
      badgeLabel: 'key',
      valueKind: 'key',
      value,
    }
  }
  const uiMatch = source.code.match(/^@ui:(.+)$/)
  if (uiMatch) {
    const value = readCleanSemanticValue(String(uiMatch[1] || ''))
    if (!isValidUiPathValue(value)) return null
    return {
      kind: 'value',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: value,
      badgeLabel: 'ui-path',
      valueKind: 'ui-path',
      value,
    }
  }
  const typedMatch = source.code.match(/^\$(id|url|enum|date|hash):(.+)$/)
  if (typedMatch) {
    const valueKind = String(typedMatch[1] || '').trim().toLowerCase() as MarkdownInlineCodeSemanticValueKind
    const value = readCleanSemanticValue(String(typedMatch[2] || ''))
    if (!value) return null
    if (valueKind === 'url' && !isValidTypedUrlValue(value)) return null
    if (valueKind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    if (valueKind === 'hash' && !HEX6_RE.test(value)) return null
    const normalizedValue = valueKind === 'hash' ? value.toUpperCase() : value
    return {
      kind: 'value',
      raw: source.raw || `\`${source.code}\``,
      code: source.code,
      displayText: normalizedValue,
      badgeLabel: valueKind,
      valueKind,
      value: normalizedValue,
    }
  }
  return null
}

export const buildMarkdownSigil = (args: {
  text: string
  color?: string | null
  background?: string | null
}): string => {
  const text = String(args.text || '')
  const color = normalizeHex6(String(args.color || ''))
  const background = normalizeHex6(String(args.background || ''))
  if (!color && !background) return text
  if (color && background) return `\`${color}|bg${background}:${text}\``
  if (color) return `\`${color}:${text}\``
  return `\`bg${background}:${text}\``
}

export const readMarkdownSigilInlineStyle = (sigil: MarkdownSigil | null | undefined): MarkdownSigilInlineStyle => {
  if (!sigil) return {}
  return {
    ...(sigil.color ? { color: sigil.color } : {}),
    ...(sigil.background ? { backgroundColor: sigil.background } : {}),
  }
}

export const unwrapDefaultHighlight = (raw: string): { text: string; wrapped: boolean } => {
  const source = String(raw || '')
  const match = source.match(/^==([\s\S]+)==$/)
  if (!match) return { text: source, wrapped: false }
  return { text: String(match[1] || ''), wrapped: true }
}

export const readMarkdownSigilDisplayText = (raw: string): string => {
  const source = String(raw || '').trim()
  if (!source) return ''
  const semantic = parseMarkdownInlineCodeSemantic(source)
  if (semantic) return semantic.displayText || source
  const unwrapped = unwrapDefaultHighlight(source)
  if (unwrapped.wrapped) {
    const nested = parseMarkdownInlineCodeSemantic(unwrapped.text)
    return readCleanAnnotationText(nested ? nested.displayText : unwrapped.text) || source
  }
  if (!hasMarkdownAnnotationSyntax(source)) return source
  return stripMarkdownAnnotationSigilsToText(source).replace(/\s+/g, ' ').trim() || source
}

const toAnnotation = (args: {
  raw: string
  start: number
  end: number
  highlighted: boolean
  parsed?: MarkdownSigil | null
  fallbackText?: string
}): MarkdownAnnotation | null => {
  const parsed = args.parsed || null
  const text = readCleanAnnotationText(parsed ? parsed.text : String(args.fallbackText || ''))
  if (!text || text.length > MAX_ANNOTATION_TEXT_LENGTH) return null
  return {
    raw: args.raw,
    start: args.start,
    end: args.end,
    highlighted: args.highlighted || !!parsed?.background,
    text,
    color: parsed?.color || null,
    background: parsed?.background || null,
  }
}

const isInsideRange = (start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean => {
  for (let i = 0; i < ranges.length; i += 1) {
    const r = ranges[i]!
    if (start >= r.start && end <= r.end) return true
  }
  return false
}

export const extractMarkdownAnnotationsFromText = (
  markdown: string,
  maxAnnotations = MAX_ANNOTATIONS,
  maxScanChars = 160_000,
): MarkdownAnnotation[] => {
  const raw = String(markdown || '')
  if (!hasMarkdownAnnotationSyntax(raw)) return []
  const scanLimit = Math.max(1000, Math.min(2_000_000, Math.floor(maxScanChars)))
  const scannedRaw = raw.length > scanLimit ? raw.slice(0, scanLimit) : raw
  if (!scannedRaw.trim()) return []
  const max = Math.max(0, Math.min(MAX_ANNOTATIONS, Math.floor(maxAnnotations)))
  if (max <= 0) return []
  const roughHashKey = hashSignatureParts([
    'markdown-sigil-annotation-hash',
    scannedRaw.length,
    scannedRaw.slice(0, 128),
    scannedRaw.slice(Math.max(0, scannedRaw.length - 128)),
  ])
  const contentHash = hashStringToHexCached(`markdown-sigil-annotations:${roughHashKey}`, scannedRaw)
  const cacheKey = hashSignatureParts([
    'markdown-sigil-annotations',
    max,
    scanLimit,
    scannedRaw.length,
    contentHash,
  ])
  const cached = ANNOTATION_CACHE.get(cacheKey)
  if (cached) return cached
  const source = blankFencedCodeBlocks(scannedRaw)
  const out: MarkdownAnnotation[] = []
  const highlightedRanges: Array<{ start: number; end: number }> = []

  DEFAULT_HIGHLIGHT_RE.lastIndex = 0
  let highlightMatch: RegExpExecArray | null
  while ((highlightMatch = DEFAULT_HIGHLIGHT_RE.exec(source))) {
    const raw = String(highlightMatch[0] || '')
    const body = String(highlightMatch[1] || '')
    const start = highlightMatch.index
    const end = start + raw.length
    highlightedRanges.push({ start, end })
    if (body.length <= MAX_ANNOTATION_TEXT_LENGTH) {
      const parsed = parseMarkdownSigil(body)
      const annotation = toAnnotation({ raw, start, end, highlighted: true, parsed, fallbackText: body })
      if (annotation) out.push(annotation)
    }
    if (out.length >= max) {
      ANNOTATION_CACHE.set(cacheKey, out)
      return out
    }
  }

  INLINE_CODE_RE.lastIndex = 0
  let codeMatch: RegExpExecArray | null
  while ((codeMatch = INLINE_CODE_RE.exec(source))) {
    const raw = String(codeMatch[0] || '')
    const start = codeMatch.index
    const end = start + raw.length
    if (isInsideRange(start, end, highlightedRanges)) continue
    const parsed = parseMarkdownSigil(raw)
    if (!parsed) continue
    const annotation = toAnnotation({ raw, start, end, highlighted: !!parsed.background, parsed })
    if (annotation) out.push(annotation)
    if (out.length >= max) break
  }

  out.sort((a, b) => a.start - b.start || a.end - b.end)
  ANNOTATION_CACHE.set(cacheKey, out)
  return out
}

export const stripMarkdownAnnotationSigilsToText = (markdown: string): string => {
  const source = blankFencedCodeBlocks(String(markdown || ''))
  if (!source.trim()) return ''
  let text = source
  if (source.includes('==')) {
    text = text.replace(DEFAULT_HIGHLIGHT_RE, (_match, body) => {
      const parsed = parseMarkdownSigil(String(body || ''))
      return ` ${parsed ? parsed.text : String(body || '')} `
    })
  }
  text = text.replace(INLINE_CODE_RE, (match) => {
    const parsed = parseMarkdownInlineCodeSemantic(String(match || ''))
    return parsed ? ` ${parsed.displayText} ` : ' '
  })
  return text
}
