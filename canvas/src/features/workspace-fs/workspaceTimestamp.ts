const pad2 = (n: number): string => String(n).padStart(2, '0')

const resolveWorkspaceTimestampDate = (timestampMs: number): Date => {
  return new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
}

export const formatWorkspaceUtcCompactTimestamp = (timestampMs: number): string => {
  const d = resolveWorkspaceTimestampDate(timestampMs)
  const yyyy = String(d.getUTCFullYear())
  const mm = pad2(d.getUTCMonth() + 1)
  const dd = pad2(d.getUTCDate())
  const hh = pad2(d.getUTCHours())
  const min = pad2(d.getUTCMinutes())
  const sec = pad2(d.getUTCSeconds())
  return `${yyyy}${mm}${dd}${hh}${min}${sec}`
}

export const formatWorkspaceUtcSessionTimestamp = (timestampMs: number): string => {
  const compact = formatWorkspaceUtcCompactTimestamp(timestampMs)
  return `${compact.slice(0, 8)}T${compact.slice(8, 14)}Z`
}

export const readWorkspaceUtcSessionTimestamp = (value: unknown): string | null => {
  const match = /(?:^|[^0-9])(\d{8}T\d{6}Z)(?:[^0-9]|$)/.exec(String(value || ''))
  return match?.[1] || null
}
