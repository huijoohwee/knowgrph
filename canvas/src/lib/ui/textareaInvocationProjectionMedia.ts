import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'

export type TextareaInvocationMediaAttachment = {
  mediaKind: InlineMediaKind
  label: string
  sourceUrl: string
  thumbnailUrl?: string
}

export type TextareaInvocationProjectedMediaChip = {
  mediaKind: InlineMediaKind
  label: string
  displayLabel: string
  sourceUrl?: string
  thumbnailUrl?: string
  virtual: boolean
}

const CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX = '@'
const TEXTAREA_INVOCATION_MEDIA_REFERENCE_RE = /@[A-Za-z0-9][A-Za-z0-9._-]*/g

export function normalizeMediaProjectionUrlKey(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw, 'https://kg.local')
    parsed.searchParams.delete('kg_media_token')
    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase()
    return parsed.origin === 'https://kg.local'
      ? pathAndQuery
      : `${parsed.origin}${pathAndQuery}`.toLowerCase()
  } catch {
    return (raw.split('?kg_media_token=')[0] || raw).toLowerCase()
  }
}

export function readMediaAttachmentLabel(attachment: TextareaInvocationMediaAttachment): string {
  const label = String(attachment.label || '').trim()
  if (label) return label
  const source = String(attachment.sourceUrl || '').split(/[?#]/)[0]?.split('/').filter(Boolean).pop() || ''
  try {
    return decodeURIComponent(source).trim() || attachment.mediaKind
  } catch {
    return source || attachment.mediaKind
  }
}

export const readTextareaInvocationMediaReferenceKey = (value: string): string =>
  String(value || '').trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

export function readTextareaInvocationMediaDisplayLabelFromLabel(label: string): string {
  const normalized = String(label || '').trim() || 'media'
  return normalized.startsWith(CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX)
    ? normalized
    : `${CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX}${normalized}`
}

function isTextareaInvocationMediaReferenceStartBoundary(source: string, index: number): boolean {
  if (index <= 0) return true
  return !/[A-Za-z0-9_/-]/.test(source[index - 1] || '')
}

function isTextareaInvocationMediaReferenceEndBoundary(source: string, index: number): boolean {
  if (index >= source.length) return true
  return !/[A-Za-z0-9_-]/.test(source[index] || '')
}

function sourceContainsExactTextareaInvocationMediaReference(source: string, label: string): boolean {
  if (!source || !label) return false
  let cursor = 0
  for (;;) {
    const start = source.indexOf(label, cursor)
    if (start < 0) return false
    const end = start + label.length
    if (
      isTextareaInvocationMediaReferenceStartBoundary(source, start)
      && isTextareaInvocationMediaReferenceEndBoundary(source, end)
    ) return true
    cursor = start + Math.max(1, label.length)
  }
}

function sourceContainsKeyedTextareaInvocationMediaReference(source: string, keys: ReadonlySet<string>): boolean {
  if (!source || keys.size === 0) return false
  TEXTAREA_INVOCATION_MEDIA_REFERENCE_RE.lastIndex = 0
  for (;;) {
    const match = TEXTAREA_INVOCATION_MEDIA_REFERENCE_RE.exec(source)
    if (!match) return false
    const label = String(match[0] || '')
    const start = match.index
    const end = start + label.length
    if (
      isTextareaInvocationMediaReferenceStartBoundary(source, start)
      && isTextareaInvocationMediaReferenceEndBoundary(source, end)
      && keys.has(readTextareaInvocationMediaReferenceKey(label))
    ) return true
  }
}

export function sourceContainsTextareaInvocationMediaReference(source: string, attachment: TextareaInvocationMediaAttachment): boolean {
  const label = readMediaAttachmentLabel(attachment)
  const displayLabel = readTextareaInvocationMediaDisplayLabelFromLabel(label)
  const candidates = Array.from(new Set([label, displayLabel].filter(Boolean)))
  if (candidates.some(candidate => sourceContainsExactTextareaInvocationMediaReference(source, candidate))) return true
  const candidateKeys = new Set(candidates.map(readTextareaInvocationMediaReferenceKey).filter(Boolean))
  return sourceContainsKeyedTextareaInvocationMediaReference(source, candidateKeys)
}

export function collectTextareaInvocationMediaAttachmentCandidateChips(
  attachments: readonly TextareaInvocationMediaAttachment[] | null | undefined,
): TextareaInvocationProjectedMediaChip[] {
  if (!attachments?.length) return []
  return attachments.flatMap(attachment => {
    const sourceUrl = String(attachment.sourceUrl || '').trim()
    if (!sourceUrl) return []
    const label = readMediaAttachmentLabel(attachment)
    return [{
      mediaKind: attachment.mediaKind,
      label,
      displayLabel: readTextareaInvocationMediaDisplayLabelFromLabel(label),
      sourceUrl,
      thumbnailUrl: String(attachment.thumbnailUrl || '').trim() || undefined,
      virtual: true,
    }]
  })
}
