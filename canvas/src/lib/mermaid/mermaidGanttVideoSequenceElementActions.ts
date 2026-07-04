import {
  buildMermaidGanttTimelineModel,
  readMermaidGanttTaskSourceRangeSeconds,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttVideoSequenceTimingSyncMode,
} from './mermaidGanttBarInteraction'
import {
  resolveMermaidGanttSourceRangeAtTimelineOffsetSeconds,
  resolveMermaidGanttSourceRangeSplitSeconds,
  type MermaidGanttSourceRangeSeconds,
  upsertMermaidGanttSourceRangeToken,
} from './mermaidGanttSourceRangeToken'

type SourceRange = MermaidGanttSourceRangeSeconds

const clean = (value: unknown): string => String(value || '').trim()

const parseClockMinutes = (value: string): number | null => {
  const positionMatch = /^kgpos_(\d+(?:_\d+)?)$/i.exec(clean(value))
  if (positionMatch?.[1]) {
    const minutes = Number(positionMatch[1].replace(/_/g, '.'))
    return Number.isFinite(minutes) && minutes >= 0 ? minutes : null
  }
  const clockMatch = /^(\d{1,2}):(\d{2})$/.exec(clean(value))
  if (!clockMatch) return null
  const hours = Number(clockMatch[1])
  const minutes = Number(clockMatch[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

const formatMinuteToken = (value: number): string => String(Number(Math.max(0, value).toFixed(3)))
const formatPositionToken = (value: number, existingToken: string): string => {
  if (/^kgpos_/i.test(clean(existingToken))) return `kgpos_${formatMinuteToken(value).replace(/\./g, '_')}`
  const totalMinutes = Math.max(0, Math.round(value))
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}
const formatDurationToken = (value: number): string => `${formatMinuteToken(Math.max(0.001, value))}m`

const readLabel = (line: string): string => line.slice(0, line.indexOf(':')).trim()
const readIndent = (line: string): string => line.match(/^(\s*)/)?.[1] || ''
const readTokens = (line: string): string[] => line.slice(line.indexOf(':') + 1).split(',').map(token => token.trim()).filter(Boolean)
const isTimingToken = (token: string): boolean => parseClockMinutes(token) != null || /^\d+(?:\.\d+)?m$/i.test(clean(token))
const isSourceRangeToken = (token: string): boolean => /^kgsrc_\d+(?:_\d+)?_\d+(?:_\d+)?$/i.test(clean(token))
const isStatusToken = (token: string): boolean => /^(?:active|done|crit|milestone|vert)$/i.test(clean(token))
const readMetaTokens = (line: string): string[] => readTokens(line).filter(token => !isTimingToken(token))
const readTimeToken = (line: string): string => readTokens(line).find(token => parseClockMinutes(token) != null) || ''
const readStableId = (line: string): string => readMetaTokens(line).find(token => !isStatusToken(token) && !isSourceRangeToken(token) && !/^after\b|^until\b/i.test(token)) || ''
const readGroupKey = (line: string): string => clean(readStableId(line))
  .replace(/_(?:image|scene|mask|grade|effect|adjustment|transition|keyframe|filter|audio|speed|splice)(?=(?:_splice)*$|$)/gi, '')
  || readLabel(line).replace(/\s+(?:image|scene|mask|grade|effect|adjustment|transition|keyframe|filter|audio|speed|splice|copy)\b.*$/i, '').toLowerCase()

const withStableIdSuffix = (tokens: readonly string[], suffix: string): string[] => {
  const next = tokens.map(token => clean(token)).filter(Boolean)
  const safeSuffix = clean(suffix).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()
  if (!safeSuffix) return next
  const idIndex = next.findIndex(token => !isStatusToken(token) && !isSourceRangeToken(token) && !/^after\b|^until\b/i.test(token))
  if (idIndex >= 0) next[idIndex] = `${next[idIndex]}_${safeSuffix}`
  return next
}

const upsertSourceRange = (tokens: readonly string[], range: SourceRange): string[] => {
  return upsertMermaidGanttSourceRangeToken(tokens.map(token => clean(token)).filter(Boolean), range)
}

const buildLine = (args: {
  durationMinutes: number
  label: string
  line: string
  metaTokens?: readonly string[]
  startMinutes: number
  sourceRange?: SourceRange
  suffix?: string
}): string => {
  const baseMetaTokens = args.metaTokens || readMetaTokens(args.line)
  const metaTokens = args.sourceRange
    ? upsertSourceRange(withStableIdSuffix(baseMetaTokens, args.suffix || ''), args.sourceRange)
    : withStableIdSuffix(baseMetaTokens, args.suffix || '')
  const timeToken = readTimeToken(args.line)
  return `${readIndent(args.line)}${args.label} : ${[
    ...metaTokens,
    formatPositionToken(args.startMinutes, timeToken),
    formatDurationToken(args.durationMinutes),
  ].join(', ')}`
}

const readSourceRange = (line: string, span: MermaidGanttTimelineTaskSpan): SourceRange => (
  readMermaidGanttTaskSourceRangeSeconds(line) || {
    endSeconds: span.startMinutes + span.durationMinutes,
    startSeconds: span.startMinutes,
  }
)

const resolveSplitSourceRange = (args: {
  sourceRange: SourceRange
  span: MermaidGanttTimelineTaskSpan
  splitOffsetMinutes: number
  side: 'left' | 'right'
}): SourceRange => {
  return resolveMermaidGanttSourceRangeSplitSeconds({
    side: args.side,
    sourceRange: args.sourceRange,
    timelineDurationMinutes: args.span.durationMinutes,
    timelineOffsetMinutes: args.splitOffsetMinutes,
  })
}

const readTargetLineIndexes = (args: {
  code: string
  rowLineIndex: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): number[] => {
  const lines = String(args.code || '').split('\n')
  if (args.syncMode === 'selected') return [args.rowLineIndex]
  const selectedLine = lines[args.rowLineIndex]
  if (typeof selectedLine !== 'string') return []
  const groupKey = readGroupKey(selectedLine)
  if (!groupKey) return [args.rowLineIndex]
  return buildMermaidGanttTimelineModel(args.code).taskSpans
    .filter(span => readGroupKey(lines[span.lineIndex] || '') === groupKey)
    .map(span => span.lineIndex)
    .sort((a, b) => a - b)
}

const mapTargetLines = (
  code: string,
  lineIndexes: readonly number[],
  mapper: (line: string, span: MermaidGanttTimelineTaskSpan) => string | null,
): string | null => {
  const lines = String(code || '').split('\n')
  const spans = buildMermaidGanttTimelineModel(code).taskSpans
  let changed = false
  for (const lineIndex of lineIndexes) {
    const line = lines[lineIndex]
    const span = spans.find(item => item.lineIndex === lineIndex)
    if (typeof line !== 'string' || !span) continue
    const nextLine = mapper(line, span)
    if (!nextLine || nextLine === line) continue
    lines[lineIndex] = nextLine
    changed = true
  }
  return changed ? lines.join('\n') : null
}

const mapTargetLineReplacements = (
  code: string,
  lineIndexes: readonly number[],
  mapper: (line: string, span: MermaidGanttTimelineTaskSpan) => readonly string[] | null,
): string | null => {
  const lines = String(code || '').split('\n')
  const spans = buildMermaidGanttTimelineModel(code).taskSpans
  let changed = false
  for (const lineIndex of lineIndexes.slice().sort((left, right) => right - left)) {
    const line = lines[lineIndex]
    const span = spans.find(item => item.lineIndex === lineIndex)
    if (typeof line !== 'string' || !span) continue
    const nextLines = mapper(line, span)
    if (!nextLines?.length || (nextLines.length === 1 && nextLines[0] === line)) continue
    lines.splice(lineIndex, 1, ...nextLines)
    changed = true
  }
  return changed ? lines.join('\n') : null
}

export function splitMermaidGanttVideoSequenceClipPairAtOffset(args: {
  code: string
  rowLineIndex: number
  splitOffsetMinutes: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const splitOffsetMinutes = Number(Number(args.splitOffsetMinutes).toFixed(3))
  if (!Number.isFinite(splitOffsetMinutes) || splitOffsetMinutes <= 0) return null
  const lineIndexes = readTargetLineIndexes(args)
  return mapTargetLineReplacements(args.code, lineIndexes, (line, span) => {
    if (splitOffsetMinutes >= span.durationMinutes) return null
    const sourceRange = readSourceRange(line, span)
    return [
      buildLine({
        durationMinutes: splitOffsetMinutes,
        label: `${readLabel(line)} split left`,
        line,
        startMinutes: span.startMinutes,
        sourceRange: resolveSplitSourceRange({ side: 'left', sourceRange, span, splitOffsetMinutes }),
        suffix: 'split_left',
      }),
      buildLine({
        durationMinutes: span.durationMinutes - splitOffsetMinutes,
        label: `${readLabel(line)} split right`,
        line,
        startMinutes: span.startMinutes + splitOffsetMinutes,
        sourceRange: resolveSplitSourceRange({ side: 'right', sourceRange, span, splitOffsetMinutes }),
        suffix: 'split_right',
      }),
    ]
  })
}

export function splitMermaidGanttVideoSequenceClipLeftAtOffset(args: {
  code: string
  rowLineIndex: number
  splitOffsetMinutes: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const splitOffsetMinutes = Number(Number(args.splitOffsetMinutes).toFixed(3))
  if (!Number.isFinite(splitOffsetMinutes) || splitOffsetMinutes <= 0) return null
  const lineIndexes = readTargetLineIndexes(args)
  return mapTargetLines(args.code, lineIndexes, (line, span) => {
    if (splitOffsetMinutes >= span.durationMinutes) return null
    const sourceRange = readSourceRange(line, span)
    return buildLine({
      durationMinutes: splitOffsetMinutes,
      label: `${readLabel(line)} split left`,
      line,
      startMinutes: span.startMinutes,
      sourceRange: resolveSplitSourceRange({ side: 'left', sourceRange, span, splitOffsetMinutes }),
      suffix: 'split_left',
    })
  })
}

export function splitMermaidGanttVideoSequenceClipRightAtOffset(args: {
  code: string
  rowLineIndex: number
  splitOffsetMinutes: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const splitOffsetMinutes = Number(Number(args.splitOffsetMinutes).toFixed(3))
  if (!Number.isFinite(splitOffsetMinutes) || splitOffsetMinutes <= 0) return null
  const lineIndexes = readTargetLineIndexes(args)
  return mapTargetLines(args.code, lineIndexes, (line, span) => {
    if (splitOffsetMinutes >= span.durationMinutes) return null
    const sourceRange = readSourceRange(line, span)
    return buildLine({
      durationMinutes: span.durationMinutes - splitOffsetMinutes,
      label: `${readLabel(line)} split right`,
      line,
      startMinutes: span.startMinutes + splitOffsetMinutes,
      sourceRange: resolveSplitSourceRange({ side: 'right', sourceRange, span, splitOffsetMinutes }),
      suffix: 'split_right',
    })
  })
}

export function extractMermaidGanttVideoSequenceAudioRow(args: {
  code: string
  rowLineIndex: number
}): string | null {
  const lines = String(args.code || '').split('\n')
  const line = lines[args.rowLineIndex]
  const span = buildMermaidGanttTimelineModel(args.code).taskSpans.find(item => item.lineIndex === args.rowLineIndex)
  if (typeof line !== 'string' || !span || /\baudio\b|_audio\b/i.test(`${readLabel(line)} ${readStableId(line)}`)) return null
  const groupKey = readGroupKey(line)
  if (groupKey && lines.some(candidate => readGroupKey(candidate) === groupKey && /\baudio\b|_audio\b/i.test(`${readLabel(candidate)} ${readStableId(candidate)}`))) {
    return args.code
  }
  lines.splice(args.rowLineIndex + 1, 0, buildLine({
    durationMinutes: span.durationMinutes,
    label: `${readLabel(line)} audio`,
    line,
    startMinutes: span.startMinutes,
    sourceRange: readSourceRange(line, span),
    suffix: 'audio',
  }))
  return lines.join('\n')
}

export function duplicateMermaidGanttVideoSequenceClip(args: {
  code: string
  rowLineIndex: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const lines = String(args.code || '').split('\n')
  const spans = buildMermaidGanttTimelineModel(args.code).taskSpans
  const lineIndexes = readTargetLineIndexes(args)
  const copies = lineIndexes.map(lineIndex => {
    const line = lines[lineIndex]
    const span = spans.find(item => item.lineIndex === lineIndex)
    if (typeof line !== 'string' || !span) return ''
    return buildLine({
      durationMinutes: span.durationMinutes,
      label: `${readLabel(line)} copy`,
      line,
      startMinutes: span.startMinutes,
      sourceRange: readSourceRange(line, span),
      suffix: 'copy',
    })
  }).filter(Boolean)
  if (!copies.length) return null
  lines.splice(Math.max(...lineIndexes) + 1, 0, ...copies)
  return lines.join('\n')
}

export function deleteMermaidGanttVideoSequenceClip(args: {
  code: string
  rowLineIndex: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const lines = String(args.code || '').split('\n')
  const removeIndexes = new Set(readTargetLineIndexes(args))
  if (!removeIndexes.size) return null
  const next = lines.filter((_, index) => !removeIndexes.has(index)).join('\n')
  return next === args.code ? null : next
}

export function deleteMermaidGanttVideoSequenceClipWithRipple(args: {
  code: string
  rowLineIndex: number
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const lines = String(args.code || '').split('\n')
  const model = buildMermaidGanttTimelineModel(args.code)
  const selectedSpan = model.taskSpans.find(item => item.lineIndex === args.rowLineIndex)
  if (!selectedSpan) return null
  const removeIndexes = new Set(readTargetLineIndexes(args))
  if (!removeIndexes.size) return null
  const spanByLineIndex = new Map(model.taskSpans.map(span => [span.lineIndex, span]))
  const rippleStartMinutes = selectedSpan.endMinutes
  const rippleDeltaMinutes = -selectedSpan.durationMinutes
  const nextLines: string[] = []
  let changed = false
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    if (removeIndexes.has(lineIndex)) {
      changed = true
      continue
    }
    const span = spanByLineIndex.get(lineIndex)
    if (span && span.startMinutes >= rippleStartMinutes - 0.001) {
      nextLines.push(buildLine({
        durationMinutes: span.durationMinutes,
        label: readLabel(line),
        line,
        startMinutes: span.startMinutes + rippleDeltaMinutes,
        sourceRange: readSourceRange(line, span),
      }))
      changed = true
      continue
    }
    nextLines.push(line)
  }
  const next = nextLines.join('\n')
  return changed && next !== args.code ? next : null
}

export function insertMermaidGanttVideoSequenceBookmark(args: {
  code: string
  positionMinutes: number
  rowLineIndex: number
}): { code: string; lineIndex: number } | null {
  const lines = String(args.code || '').split('\n')
  const line = lines[args.rowLineIndex]
  const span = buildMermaidGanttTimelineModel(args.code).taskSpans.find(item => item.lineIndex === args.rowLineIndex)
  const positionMinutes = Number(Number(args.positionMinutes).toFixed(3))
  if (typeof line !== 'string' || !span || !Number.isFinite(positionMinutes) || positionMinutes < 0) return null
  const stableId = readStableId(line) || readLabel(line).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'clip'
  const positionSuffix = `bookmark_${formatMinuteToken(positionMinutes).replace(/\./g, '_')}`
  let suffix = positionSuffix
  let nextStableId = `${stableId}_${suffix}`
  let duplicateIndex = 2
  while (lines.some(candidate => readStableId(candidate) === nextStableId)) {
    suffix = `${positionSuffix}_${duplicateIndex}`
    nextStableId = `${stableId}_${suffix}`
    duplicateIndex += 1
  }
  const bookmarkLine = buildLine({
    durationMinutes: 0.001,
    label: `${readLabel(line)} bookmark`,
    line,
    metaTokens: [stableId, 'vert'],
    startMinutes: positionMinutes,
    sourceRange: (() => {
      const sourcePositionSeconds = resolveMermaidGanttSourceRangeAtTimelineOffsetSeconds({
        sourceRange: readSourceRange(line, span),
        timelineDurationMinutes: span.durationMinutes,
        timelineOffsetMinutes: positionMinutes - span.startMinutes,
      })
      return {
        endSeconds: sourcePositionSeconds,
        startSeconds: sourcePositionSeconds,
      }
    })(),
    suffix,
  })
  const lineIndex = args.rowLineIndex + 1
  lines.splice(lineIndex, 0, bookmarkLine)
  return {
    code: lines.join('\n'),
    lineIndex,
  }
}
