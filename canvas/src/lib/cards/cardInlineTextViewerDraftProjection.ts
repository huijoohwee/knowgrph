import React from 'react'

const INLINE_MEDIA_TOKEN_PATTERN = String.raw`(?:!\[[^\]]*\]\([^\s)]+(?:\s+"[^"]*")?\)|<(?:audio|video)\b[^>]*>\s*(?:<\/(?:audio|video)>)?)`
const INLINE_MEDIA_REFERENCE_TOKEN_PATTERN = String.raw`@[\p{L}\p{N}_][\p{L}\p{N}_.-]*\.(?:avif|bmp|gif|jpe?g|png|svg|webp|aac|m4a|mp3|ogg|wav|m4v|mov|mp4|webm)`
const INLINE_MEDIA_SOFT_BREAK_TOKEN_PATTERN = String.raw`(?:${INLINE_MEDIA_TOKEN_PATTERN}|${INLINE_MEDIA_REFERENCE_TOKEN_PATTERN})`
const INLINE_MEDIA_SOFT_BREAK_BEFORE_RE = new RegExp(`(^|[^\\s\\n])((?:[\\t ]*\\n)+[\\t ]*)(?=${INLINE_MEDIA_SOFT_BREAK_TOKEN_PATTERN})`, 'giu')
const INLINE_MEDIA_SOFT_BREAK_AFTER_RE = new RegExp(`(${INLINE_MEDIA_SOFT_BREAK_TOKEN_PATTERN})((?:[\\t ]*\\n)+[\\t ]*)`, 'giu')

type SoftBreakRange = {
  start: number
  end: number
  replacement: string
}

type SoftBreakProjection = {
  display: string
  rawBoundaryByDisplayBoundary: number[]
}

const normalizeSource = (raw: unknown): string => String(raw || '').replace(/\r/g, '')

export function normalizeCardInlineMediaSoftLineBreaks(raw: string): string {
  return normalizeSource(raw)
    .replace(INLINE_MEDIA_SOFT_BREAK_BEFORE_RE, (_match, prefix: string) => prefix ? `${prefix} ` : '')
    .replace(INLINE_MEDIA_SOFT_BREAK_AFTER_RE, '$1 ')
}

const collectSoftBreakRanges = (source: string): SoftBreakRange[] => {
  const ranges: SoftBreakRange[] = []
  INLINE_MEDIA_SOFT_BREAK_BEFORE_RE.lastIndex = 0
  for (;;) {
    const match = INLINE_MEDIA_SOFT_BREAK_BEFORE_RE.exec(source)
    if (!match) break
    const prefix = match[1] || ''
    const whitespace = match[2] || ''
    const start = match.index + prefix.length
    ranges.push({ start, end: start + whitespace.length, replacement: prefix ? ' ' : '' })
  }
  INLINE_MEDIA_SOFT_BREAK_AFTER_RE.lastIndex = 0
  for (;;) {
    const match = INLINE_MEDIA_SOFT_BREAK_AFTER_RE.exec(source)
    if (!match) break
    const media = match[1] || ''
    const whitespace = match[2] || ''
    const start = match.index + media.length
    ranges.push({ start, end: start + whitespace.length, replacement: ' ' })
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  return ranges.filter((range, index) => index === 0 || range.start >= ranges[index - 1]!.end)
}

const projectCardInlineMediaSoftBreaks = (raw: string): SoftBreakProjection => {
  const source = normalizeSource(raw)
  const ranges = collectSoftBreakRanges(source)
  const boundaries = [0]
  let display = ''
  let cursor = 0
  const appendSourceUntil = (end: number) => {
    while (cursor < end) {
      display += source[cursor]
      cursor += 1
      boundaries.push(cursor)
    }
  }
  ranges.forEach(range => {
    if (range.start < cursor) return
    appendSourceUntil(range.start)
    if (range.replacement) {
      display += range.replacement
      boundaries.push(range.end)
    } else {
      boundaries[boundaries.length - 1] = range.end
    }
    cursor = range.end
  })
  appendSourceUntil(source.length)
  const leadingTrim = display.length - display.trimStart().length
  const trailingTrim = display.length - display.trimEnd().length
  const visibleEnd = display.length - trailingTrim
  return {
    display: display.slice(leadingTrim, visibleEnd),
    rawBoundaryByDisplayBoundary: boundaries.slice(leadingTrim, visibleEnd + 1),
  }
}

export function resolveCardInlineMediaSoftBreakEdit(raw: string, nextDisplay: string): string {
  const source = normalizeSource(raw)
  const projection = projectCardInlineMediaSoftBreaks(source)
  const next = normalizeSource(nextDisplay)
  if (next === projection.display) return source
  let prefixLength = 0
  while (prefixLength < projection.display.length && prefixLength < next.length && projection.display[prefixLength] === next[prefixLength]) {
    prefixLength += 1
  }
  let suffixLength = 0
  while (
    suffixLength < projection.display.length - prefixLength
    && suffixLength < next.length - prefixLength
    && projection.display[projection.display.length - suffixLength - 1] === next[next.length - suffixLength - 1]
  ) {
    suffixLength += 1
  }
  const displayEnd = projection.display.length - suffixLength
  const nextEnd = next.length - suffixLength
  const rawStart = projection.rawBoundaryByDisplayBoundary[prefixLength] ?? source.length
  const rawEnd = projection.rawBoundaryByDisplayBoundary[displayEnd] ?? source.length
  return `${source.slice(0, rawStart)}${next.slice(prefixLength, nextEnd)}${source.slice(rawEnd)}`
}

export function useCardInlineTextViewerDraftProjection(enabled: boolean) {
  const rawSourceRef = React.useRef('')
  const beginViewerDraft = React.useCallback((value: string): string => {
    const source = normalizeSource(value)
    rawSourceRef.current = source
    return enabled ? projectCardInlineMediaSoftBreaks(source).display : source
  }, [enabled])
  const resolveViewerDraft = React.useCallback((value: string): string => {
    const next = enabled ? resolveCardInlineMediaSoftBreakEdit(rawSourceRef.current, value) : normalizeSource(value)
    rawSourceRef.current = next
    return next
  }, [enabled])
  return { beginViewerDraft, resolveViewerDraft }
}
