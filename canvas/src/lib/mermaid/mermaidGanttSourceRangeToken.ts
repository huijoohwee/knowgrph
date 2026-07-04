export type MermaidGanttSourceRangeSeconds = {
  endSeconds: number
  startSeconds: number
}

function isMermaidGanttStatusToken(token: string): boolean {
  return /^(?:active|done|crit|milestone|vert)$/i.test(String(token || '').trim())
}

export function isMermaidGanttSourceRangeToken(token: string): boolean {
  return /^kgsrc_[\d_]+$/i.test(String(token || '').trim())
}

export function readMermaidGanttSourceRangeToken(token: string): MermaidGanttSourceRangeSeconds | null {
  const match = /^kgsrc_([\d_]+)$/i.exec(String(token || '').trim())
  if (!match) return null
  const parts = String(match[1] || '').split('_').filter(Boolean)
  const candidates: MermaidGanttSourceRangeSeconds[] = []
  for (let splitIndex = 1; splitIndex < parts.length; splitIndex += 1) {
    const startSeconds = Number(parts.slice(0, splitIndex).join('.'))
    const endSeconds = Number(parts.slice(splitIndex).join('.'))
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) continue
    if (endSeconds <= startSeconds) continue
    candidates.push({ startSeconds, endSeconds })
  }
  return candidates.sort((left, right) =>
    (left.endSeconds - left.startSeconds) - (right.endSeconds - right.startSeconds),
  )[0] || null
}

export function formatMermaidGanttSourceRangeToken(range: MermaidGanttSourceRangeSeconds): string {
  const normalize = (value: number): string => String(Math.max(0, Number(value.toFixed(3)))).replace(/\./g, '_')
  return `kgsrc_${normalize(range.startSeconds)}_${normalize(Math.max(range.startSeconds, range.endSeconds))}`
}

export function readMermaidGanttLineSourceRange(line: string): MermaidGanttSourceRangeSeconds | null {
  const colonIndex = String(line || '').indexOf(':')
  if (colonIndex < 0) return null
  const tokens = line.slice(colonIndex + 1).split(',').map(token => token.trim()).filter(Boolean)
  for (const token of tokens) {
    const range = readMermaidGanttSourceRangeToken(token)
    if (range) return range
  }
  return null
}

export function upsertMermaidGanttSourceRangeToken(
  metaTokens: readonly string[],
  range: MermaidGanttSourceRangeSeconds,
): string[] {
  const next = metaTokens.map(token => String(token || '').trim()).filter(Boolean)
  const token = formatMermaidGanttSourceRangeToken(range)
  const existingIndex = next.findIndex(isMermaidGanttSourceRangeToken)
  if (existingIndex >= 0) {
    next[existingIndex] = token
    return next
  }
  const stableIdIndex = next.findIndex(candidate =>
    !isMermaidGanttStatusToken(candidate)
    && !isMermaidGanttSourceRangeToken(candidate)
    && !/^after\b/i.test(candidate)
    && !/^until\b/i.test(candidate),
  )
  if (stableIdIndex >= 0) {
    next.splice(stableIdIndex + 1, 0, token)
    return next
  }
  return [token, ...next]
}

export function resolveMermaidGanttSourceRangeAtTimelineOffsetSeconds(args: {
  sourceRange: MermaidGanttSourceRangeSeconds
  timelineDurationMinutes: number
  timelineOffsetMinutes: number
}): number {
  const timelineDurationMinutes = Math.max(0.0001, Number(args.timelineDurationMinutes) || 0)
  const sourceDurationSeconds = Math.max(0.0001, args.sourceRange.endSeconds - args.sourceRange.startSeconds)
  const timelineRatio = Math.min(1, Math.max(0, args.timelineOffsetMinutes / timelineDurationMinutes))
  return args.sourceRange.startSeconds + sourceDurationSeconds * timelineRatio
}

export function resolveMermaidGanttSourceRangeSplitSeconds(args: {
  side: 'left' | 'right'
  sourceRange: MermaidGanttSourceRangeSeconds
  timelineDurationMinutes: number
  timelineOffsetMinutes: number
}): MermaidGanttSourceRangeSeconds {
  const sourceSplitSeconds = resolveMermaidGanttSourceRangeAtTimelineOffsetSeconds(args)
  return args.side === 'left'
    ? { endSeconds: sourceSplitSeconds, startSeconds: args.sourceRange.startSeconds }
    : { endSeconds: args.sourceRange.endSeconds, startSeconds: sourceSplitSeconds }
}
