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
  const startMinutes = timeTokenIndex >= 0 ? readClockMinutes(tokens[timeTokenIndex] || '') : null
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
  tokens[timeTokenIndex] = formatClockMinutes(nextStartMinutes)
  tokens[durationTokenIndex] = formatDurationMinutes(nextDurationMinutes)
  lines[args.rowLineIndex] = `${prefix} ${tokens.join(', ')}`
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
