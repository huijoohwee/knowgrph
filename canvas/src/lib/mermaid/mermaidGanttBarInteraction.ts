export type MermaidGanttBarDragMode = 'move' | 'resize-start' | 'resize-end'

export type MermaidGanttBarDragPreview = {
  deltaPx: number
  offsetPx: number
  widthDeltaPx: number
}

export type MermaidGanttTimelineTaskSpan = {
  durationMinutes: number
  endMinutes: number
  label: string
  lineIndex: number
  raw: string
  rowKey: string
  startMinutes: number
}

export type MermaidGanttTimelineDragPreview = {
  durationMinutes: number
  rowKey: string
  startMinutes: number
}

export type MermaidGanttVideoSequenceOperation = 'mask' | 'grade'

export type MermaidGanttTimelineModel = {
  durationMinutes: number
  endMinutes: number
  startMinutes: number
  taskSpans: MermaidGanttTimelineTaskSpan[]
}

export type MermaidGanttTimelineTick = {
  label: string
  minutes: number
  percent: number
}

type GanttTimeParts = {
  hours: number
  minutes: number
}

export const MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX = 4
export const MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_THRESHOLD_PX = 72
export const MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_STEP_PX = 28
export const MERMAID_GANTT_BAR_MIN_INTERACTION_WIDTH_PX = 24
export const MERMAID_GANTT_BAR_MIN_INTERACTION_HEIGHT_PX = 18

export function isMermaidGanttBarDragMode(value: unknown): value is MermaidGanttBarDragMode {
  return value === 'move' || value === 'resize-start' || value === 'resize-end'
}

export function shouldExposeMermaidGanttBarInteraction(row: { kind?: string | null } | null | undefined): boolean {
  return row?.kind === 'task'
}

export function resolveMermaidGanttBarDragPreview(args: {
  mode: MermaidGanttBarDragMode
  originClientX: number
  clientX: number
}): MermaidGanttBarDragPreview {
  const deltaPx = args.clientX - args.originClientX
  if (args.mode === 'resize-start') {
    return {
      deltaPx,
      offsetPx: deltaPx,
      widthDeltaPx: -deltaPx,
    }
  }
  if (args.mode === 'resize-end') {
    return {
      deltaPx,
      offsetPx: 0,
      widthDeltaPx: deltaPx,
    }
  }
  return {
    deltaPx,
    offsetPx: deltaPx,
    widthDeltaPx: 0,
  }
}

export function resolveMermaidGanttBarDragCommitted(deltaPx: number): boolean {
  return Math.abs(deltaPx) >= MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX
}

export function resolveMermaidGanttTimelineDragPreviewSpan(args: {
  deltaMinutes: number
  maxMinutes: number
  mode: MermaidGanttBarDragMode
  span: MermaidGanttTimelineTaskSpan
}): MermaidGanttTimelineDragPreview {
  const durationMinutes = Math.max(1, args.span.durationMinutes)
  const endMinutes = args.span.startMinutes + durationMinutes
  const deltaMinutes = Math.round(args.deltaMinutes)
  const maxMinutes = Math.max(0, Math.round(args.maxMinutes))
  if (args.mode === 'resize-start') {
    const nextStartMinutes = clampGanttTimelineMinutes(args.span.startMinutes + deltaMinutes, 0, Math.max(0, endMinutes - 1))
    return {
      durationMinutes: Math.max(1, endMinutes - nextStartMinutes),
      rowKey: args.span.rowKey,
      startMinutes: nextStartMinutes,
    }
  }
  if (args.mode === 'resize-end') {
    return {
      durationMinutes: clampGanttTimelineMinutes(durationMinutes + deltaMinutes, 1, Math.max(1, maxMinutes - args.span.startMinutes)),
      rowKey: args.span.rowKey,
      startMinutes: args.span.startMinutes,
    }
  }
  return {
    durationMinutes,
    rowKey: args.span.rowKey,
    startMinutes: clampGanttTimelineMinutes(args.span.startMinutes + deltaMinutes, 0, Math.max(0, maxMinutes - durationMinutes)),
  }
}

export function resolveMermaidGanttTimelineDragEffectiveDelta(args: {
  deltaMinutes: number
  maxMinutes: number
  mode: MermaidGanttBarDragMode
  span: MermaidGanttTimelineTaskSpan
}): number {
  const preview = resolveMermaidGanttTimelineDragPreviewSpan(args)
  if (args.mode === 'resize-end') {
    return preview.durationMinutes - Math.max(1, args.span.durationMinutes)
  }
  return preview.startMinutes - args.span.startMinutes
}

function clampGanttTimelineMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function parseGanttClockTime(value: string): GanttTimeParts | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

function readClockMinutes(value: string): number | null {
  const time = parseGanttClockTime(value)
  if (!time) return null
  return time.hours * 60 + time.minutes
}

function formatClockMinutes(value: number): string {
  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function readDurationMinutes(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)m$/i.exec(String(value || '').trim())
  if (!match) return null
  const minutes = Number(match[1])
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return Math.round(minutes)
}

function formatDurationMinutes(value: number): string {
  return `${Math.max(1, Math.round(value))}m`
}

function readGanttTaskLabel(line: string): string {
  const colonIndex = line.indexOf(':')
  if (colonIndex < 0) return line.trim()
  return line.slice(0, colonIndex).trim() || line.trim()
}

function readGanttTaskTokens(line: string): string[] {
  const colonIndex = line.indexOf(':')
  if (colonIndex < 0) return []
  return line.slice(colonIndex + 1).split(',').map(token => token.trim()).filter(Boolean)
}

function isMermaidGanttStatusToken(token: string): boolean {
  return /^(?:active|done|crit|milestone|vert)$/i.test(String(token || '').trim())
}

function isLegacyVideoSequenceLaneToken(token: string): boolean {
  return /^(?:video|mask|grade|audio|splice)$/i.test(String(token || '').trim())
}

function readGanttLineIndent(line: string): string {
  return line.match(/^(\s*)/)?.[1] || ''
}

function readSpanAbsoluteStartMinutes(args: {
  code: string
  line: string
  span: MermaidGanttTimelineTaskSpan
}): number | null {
  const explicitClock = readGanttTaskTokens(args.line).find(token => readClockMinutes(token) != null)
  const explicitMinutes = explicitClock ? readClockMinutes(explicitClock) : null
  if (explicitMinutes != null) return explicitMinutes
  const baseClockMinutes = readBaseClockMinutes(String(args.code || '').split('\n'))
  if (baseClockMinutes == null) return null
  return baseClockMinutes + args.span.startMinutes
}

function readGanttTimingMetaTokens(tokens: readonly string[]): string[] {
  return tokens.filter(token =>
    readClockMinutes(token) == null
    && readDurationMinutes(token) == null
    && !isLegacyVideoSequenceLaneToken(token),
  )
}

function appendGanttTaskIdSuffix(metaTokens: readonly string[], suffix: string): string[] {
  const next = metaTokens.map(token => String(token || '').trim()).filter(Boolean)
  const suffixPart = String(suffix || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()
  if (!suffixPart) return next
  const taskIdIndex = next.findIndex(token => !isMermaidGanttStatusToken(token) && !/^after\b/i.test(token) && !/^until\b/i.test(token))
  if (taskIdIndex < 0) return next
  next[taskIdIndex] = `${next[taskIdIndex]}_${suffixPart}`
  return next
}

function readGanttTaskStableId(line: string): string {
  const tokens = readGanttTimingMetaTokens(readGanttTaskTokens(line))
  return String(tokens.find(token => !isMermaidGanttStatusToken(token) && !/^after\b/i.test(token) && !/^until\b/i.test(token)) || '').trim()
}

function normalizeVideoSequenceClipGroupId(value: string): string {
  return String(value || '')
    .trim()
    .replace(/_(?:mask|grade|audio)(?=_splice$|$)/gi, '')
}

function resolveVideoSequenceClipGroupKey(line: string): string {
  const stableId = readGanttTaskStableId(line)
  if (stableId) return normalizeVideoSequenceClipGroupId(stableId)
  return readGanttTaskLabel(line).replace(/\s+(?:mask|grade|audio|splice)\b.*$/i, '').trim().toLowerCase()
}

function readVideoSequenceOperationFromLine(line: string): MermaidGanttVideoSequenceOperation | '' {
  const signature = `${readGanttTaskLabel(line)} ${readGanttTaskStableId(line)}`.toLowerCase()
  if (/\bgrade|color|lut|exposure|contrast\b/.test(signature) || /_grade\b/.test(signature)) return 'grade'
  if (/\bmask|matte|roto|alpha\b/.test(signature) || /_mask\b/.test(signature)) return 'mask'
  return ''
}

function readVideoSequenceClipGroupLineIndexes(args: {
  code: string
  rowLineIndex: number
}): number[] {
  const lines = String(args.code || '').split('\n')
  const selectedLine = lines[args.rowLineIndex]
  if (typeof selectedLine !== 'string' || !selectedLine.includes(':')) return []
  const selectedGroupKey = resolveVideoSequenceClipGroupKey(selectedLine)
  if (!selectedGroupKey) return [args.rowLineIndex]
  const model = buildMermaidGanttTimelineModel(args.code)
  return model.taskSpans
    .filter(span => {
      const line = lines[span.lineIndex]
      return typeof line === 'string' && resolveVideoSequenceClipGroupKey(line) === selectedGroupKey
    })
    .map(span => span.lineIndex)
    .sort((a, b) => a - b)
}

function buildGanttTaskLine(args: {
  absoluteStartMinutes: number
  durationMinutes: number
  indent: string
  label: string
  metaTokens: readonly string[]
}): string {
  const timingTokens = [
    ...args.metaTokens,
    formatClockMinutes(args.absoluteStartMinutes),
    formatDurationMinutes(args.durationMinutes),
  ]
  return `${args.indent}${args.label} : ${timingTokens.join(', ')}`
}

function readBaseClockMinutes(lines: string[]): number | null {
  for (const line of lines) {
    const tokens = readGanttTaskTokens(String(line || '').trim())
    const clockToken = tokens.find(token => readClockMinutes(token) != null)
    const minutes = clockToken ? readClockMinutes(clockToken) : null
    if (minutes != null) return minutes
  }
  return null
}

function resolveGanttTimelineTickStep(totalMinutes: number): number {
  const targetTickCount = 6
  const rawStep = Math.max(1, totalMinutes / targetTickCount)
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480]
  return candidates.find(candidate => candidate >= rawStep) || 480
}

export function formatMermaidGanttTimelineOffset(value: number): string {
  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

export function buildMermaidGanttTimelineModel(code: string): MermaidGanttTimelineModel {
  const lines = String(code || '').replace(/\r/g, '').split('\n')
  const taskSpans: MermaidGanttTimelineTaskSpan[] = []
  let baseClockMinutes: number | null = null
  let cursorMinutes = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = String(lines[lineIndex] || '').trim()
    if (!raw || !raw.includes(':')) continue
    if (/^(?:title|dateFormat|axisFormat|tickInterval|weekday|excludes|includes|todayMarker)\b/i.test(raw)) continue
    const tokens = readGanttTaskTokens(raw)
    const durationMinutes = readDurationMinutes(tokens[tokens.length - 1] || '')
    if (durationMinutes == null) continue
    const clockToken = tokens.find(token => readClockMinutes(token) != null)
    const clockMinutes = clockToken ? readClockMinutes(clockToken) : null
    if (baseClockMinutes == null && clockMinutes != null) baseClockMinutes = clockMinutes
    const startMinutes = Math.max(0, clockMinutes == null || baseClockMinutes == null ? cursorMinutes : clockMinutes - baseClockMinutes)
    const endMinutes = startMinutes + durationMinutes
    taskSpans.push({
      durationMinutes,
      endMinutes,
      label: readGanttTaskLabel(raw),
      lineIndex,
      raw,
      rowKey: `${lineIndex}:task:${raw}`,
      startMinutes,
    })
    cursorMinutes = Math.max(cursorMinutes, endMinutes)
  }

  const startMinutes = taskSpans.length ? Math.min(...taskSpans.map(span => span.startMinutes)) : 0
  const endMinutes = taskSpans.length ? Math.max(...taskSpans.map(span => span.endMinutes)) : 0
  return {
    durationMinutes: Math.max(0, endMinutes - startMinutes),
    endMinutes,
    startMinutes,
    taskSpans,
  }
}

export function buildMermaidGanttTimelineTicks(model: MermaidGanttTimelineModel): MermaidGanttTimelineTick[] {
  const totalMinutes = Math.max(0, model.durationMinutes)
  if (totalMinutes <= 0) return [{ label: '0:00', minutes: 0, percent: 0 }]
  const step = resolveGanttTimelineTickStep(totalMinutes)
  const ticks: MermaidGanttTimelineTick[] = []
  for (let minutes = 0; minutes < totalMinutes; minutes += step) {
    ticks.push({
      label: formatMermaidGanttTimelineOffset(minutes),
      minutes,
      percent: (minutes / totalMinutes) * 100,
    })
  }
  ticks.push({
    label: formatMermaidGanttTimelineOffset(totalMinutes),
    minutes: totalMinutes,
    percent: 100,
  })
  return ticks
}

export function resolveMermaidGanttTimelineRowKeyAtPosition(
  model: MermaidGanttTimelineModel,
  positionMinutes: number,
): string | null {
  const position = Math.max(0, Number.isFinite(positionMinutes) ? positionMinutes : 0)
  const containing = model.taskSpans.find(span => position >= span.startMinutes && position <= span.endMinutes)
  if (containing) return containing.rowKey
  const nearest = model.taskSpans
    .map(span => ({ span, distance: Math.min(Math.abs(position - span.startMinutes), Math.abs(position - span.endMinutes)) }))
    .sort((a, b) => a.distance - b.distance)[0]?.span
  return nearest?.rowKey || null
}

export function updateMermaidGanttCodeRowTiming(args: {
  code: string
  rowLineIndex: number
  mode: MermaidGanttBarDragMode
  deltaMinutes: number
}): string | null {
  const lines = String(args.code || '').split('\n')
  const line = lines[args.rowLineIndex]
  if (typeof line !== 'string' || !line.includes(':')) return null
  const deltaMinutes = Math.round(args.deltaMinutes)
  if (deltaMinutes === 0) return null
  const colonIndex = line.indexOf(':')
  const prefix = line.slice(0, colonIndex + 1)
  const tokenText = line.slice(colonIndex + 1)
  const tokens = tokenText.split(',').map(token => token.trim())
  const timeTokenIndex = tokens.findIndex(token => readClockMinutes(token) != null)
  const durationTokenIndex = tokens.length - 1
  const explicitStartMinutes = timeTokenIndex >= 0 ? readClockMinutes(tokens[timeTokenIndex] || '') : null
  const timelineSpan = buildMermaidGanttTimelineModel(args.code).taskSpans.find(span => span.lineIndex === args.rowLineIndex)
  const baseClockMinutes = readBaseClockMinutes(lines)
  const startMinutes = explicitStartMinutes == null && timelineSpan && baseClockMinutes != null
    ? baseClockMinutes + timelineSpan.startMinutes
    : explicitStartMinutes
  const durationMinutes = readDurationMinutes(tokens[durationTokenIndex] || '')
  if (startMinutes == null || durationMinutes == null) return null
  let nextStartMinutes = startMinutes
  let nextDurationMinutes = durationMinutes
  if (args.mode === 'move') {
    nextStartMinutes = startMinutes + deltaMinutes
  } else if (args.mode === 'resize-start') {
    nextStartMinutes = startMinutes + deltaMinutes
    nextDurationMinutes = durationMinutes - deltaMinutes
  } else {
    nextDurationMinutes = durationMinutes + deltaMinutes
  }
  if (nextDurationMinutes < 1) {
    const durationFloorDelta = nextDurationMinutes - 1
    nextDurationMinutes = 1
    if (args.mode === 'resize-start') nextStartMinutes += durationFloorDelta
  }
  if (timeTokenIndex >= 0) {
    tokens[timeTokenIndex] = formatClockMinutes(nextStartMinutes)
  } else if (args.mode === 'resize-end') {
    tokens[durationTokenIndex] = formatDurationMinutes(nextDurationMinutes)
    lines[args.rowLineIndex] = `${prefix} ${tokens.join(', ')}`
    return lines.join('\n')
  } else {
    tokens.splice(durationTokenIndex, 0, formatClockMinutes(nextStartMinutes))
  }
  const nextDurationTokenIndex = timeTokenIndex >= 0 ? durationTokenIndex : durationTokenIndex + 1
  tokens[nextDurationTokenIndex] = formatDurationMinutes(nextDurationMinutes)
  lines[args.rowLineIndex] = `${prefix} ${tokens.join(', ')}`
  return lines.join('\n')
}

export function splitMermaidGanttCodeRowAtOffset(args: {
  code: string
  rowLineIndex: number
  splitOffsetMinutes: number
}): string | null {
  const lines = String(args.code || '').split('\n')
  const line = lines[args.rowLineIndex]
  if (typeof line !== 'string' || !line.includes(':')) return null
  const span = buildMermaidGanttTimelineModel(args.code).taskSpans.find(item => item.lineIndex === args.rowLineIndex)
  if (!span) return null
  const splitOffsetMinutes = Math.round(args.splitOffsetMinutes)
  if (splitOffsetMinutes <= 0 || splitOffsetMinutes >= span.durationMinutes) return null
  const absoluteStartMinutes = readSpanAbsoluteStartMinutes({ code: args.code, line, span })
  if (absoluteStartMinutes == null) return null
  const label = readGanttTaskLabel(line)
  const tokens = readGanttTaskTokens(line)
  const metaTokens = readGanttTimingMetaTokens(tokens)
  const indent = readGanttLineIndent(line)
  const firstLine = buildGanttTaskLine({
    absoluteStartMinutes,
    durationMinutes: splitOffsetMinutes,
    indent,
    label,
    metaTokens,
  })
  const secondLine = buildGanttTaskLine({
    absoluteStartMinutes: absoluteStartMinutes + splitOffsetMinutes,
    durationMinutes: span.durationMinutes - splitOffsetMinutes,
    indent,
    label: `${label} splice`,
    metaTokens: appendGanttTaskIdSuffix(metaTokens, 'splice'),
  })
  lines.splice(args.rowLineIndex, 1, firstLine, secondLine)
  return lines.join('\n')
}

export function splitMermaidGanttVideoSequenceClipGroupAtOffset(args: {
  code: string
  rowLineIndex: number
  splitOffsetMinutes: number
}): string | null {
  const groupLineIndexes = readVideoSequenceClipGroupLineIndexes(args)
  if (groupLineIndexes.length <= 1) return splitMermaidGanttCodeRowAtOffset(args)
  let nextCode = String(args.code || '')
  for (const lineIndex of groupLineIndexes.slice().sort((a, b) => b - a)) {
    const updated = splitMermaidGanttCodeRowAtOffset({
      code: nextCode,
      rowLineIndex: lineIndex,
      splitOffsetMinutes: args.splitOffsetMinutes,
    })
    if (updated) nextCode = updated
  }
  return nextCode === args.code ? null : nextCode
}

export function updateMermaidGanttVideoSequenceClipGroupTiming(args: {
  code: string
  rowLineIndex: number
  mode: MermaidGanttBarDragMode
  deltaMinutes: number
}): string | null {
  const groupLineIndexes = readVideoSequenceClipGroupLineIndexes(args)
  if (groupLineIndexes.length <= 1) return updateMermaidGanttCodeRowTiming(args)
  let nextCode = String(args.code || '')
  for (const lineIndex of groupLineIndexes.slice().sort((a, b) => b - a)) {
    const updated = updateMermaidGanttCodeRowTiming({
      code: nextCode,
      rowLineIndex: lineIndex,
      mode: args.mode,
      deltaMinutes: args.deltaMinutes,
    })
    if (updated) nextCode = updated
  }
  return nextCode === args.code ? null : nextCode
}

export function insertMermaidGanttVideoSequenceOperationRow(args: {
  code: string
  rowLineIndex: number
  operation: MermaidGanttVideoSequenceOperation
}): string | null {
  const lines = String(args.code || '').split('\n')
  const line = lines[args.rowLineIndex]
  if (typeof line !== 'string' || !line.includes(':')) return null
  const groupKey = resolveVideoSequenceClipGroupKey(line)
  if (groupKey) {
    const existingLineIndex = buildMermaidGanttTimelineModel(args.code).taskSpans.find(span => {
      const candidateLine = lines[span.lineIndex]
      return (
        typeof candidateLine === 'string' &&
        resolveVideoSequenceClipGroupKey(candidateLine) === groupKey &&
        readVideoSequenceOperationFromLine(candidateLine) === args.operation
      )
    })?.lineIndex
    if (typeof existingLineIndex === 'number') return args.code
  }
  const span = buildMermaidGanttTimelineModel(args.code).taskSpans.find(item => item.lineIndex === args.rowLineIndex)
  if (!span) return null
  const absoluteStartMinutes = readSpanAbsoluteStartMinutes({ code: args.code, line, span })
  if (absoluteStartMinutes == null) return null
  const label = `${readGanttTaskLabel(line)} ${args.operation === 'grade' ? 'grade' : 'mask'}`
  const operationLine = buildGanttTaskLine({
    absoluteStartMinutes,
    durationMinutes: Math.max(1, span.durationMinutes),
    indent: readGanttLineIndent(line),
    label,
    metaTokens: appendGanttTaskIdSuffix(readGanttTimingMetaTokens(readGanttTaskTokens(line)), args.operation),
  })
  lines.splice(args.rowLineIndex + 1, 0, operationLine)
  return lines.join('\n')
}

export function replaceFirstMermaidGanttFrontmatterCode(markdownText: string, nextCode: string): string | null {
  const lines = String(markdownText || '').split('\n')
  if (lines[0]?.trim() !== '---') return null
  const frontmatterEndIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (frontmatterEndIndex <= 0) return null
  const typeIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEndIndex && /^\s*type\s*:\s*mermaid_gantt\s*$/.test(line))
  if (typeIndex <= 0) return null
  const valueIndex = lines.findIndex((line, index) => {
    if (index <= typeIndex || index >= frontmatterEndIndex) return false
    return /^(\s*)value\s*:\s*\|[-+]?/.test(line)
  })
  if (valueIndex <= typeIndex) return null
  const valueIndent = (lines[valueIndex]?.match(/^(\s*)/)?.[1] || '').length
  let codeStartIndex = valueIndex + 1
  while (codeStartIndex < frontmatterEndIndex && lines[codeStartIndex]?.trim() === '') codeStartIndex += 1
  if (codeStartIndex >= frontmatterEndIndex) return null
  const codeIndentText = lines[codeStartIndex]?.match(/^(\s*)/)?.[1] || '  '.repeat(Math.ceil((valueIndent + 2) / 2))
  let codeEndIndex = codeStartIndex
  while (codeEndIndex < frontmatterEndIndex) {
    const line = lines[codeEndIndex] || ''
    const indent = (line.match(/^(\s*)/)?.[1] || '').length
    if (line.trim() !== '' && indent <= valueIndent) break
    codeEndIndex += 1
  }
  const nextCodeLines = String(nextCode || '').split('\n').map(line => `${codeIndentText}${line}`)
  return [
    ...lines.slice(0, codeStartIndex),
    ...nextCodeLines,
    ...lines.slice(codeEndIndex),
  ].join('\n')
}
