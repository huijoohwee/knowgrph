import type { MarkdownWorkspaceStatus } from './markdownWorkspaceTypes'

const formatKb = (bytes: number): string => {
  const kb = Math.max(0, Math.round(bytes / 1024))
  return `${kb}kb`
}

export function formatMarkdownWorkspaceStatusLabel(status: MarkdownWorkspaceStatus): string {
  if (!status) return ''
  const label = String(status.label || '').trim()
  if (!label) return ''
  if (status.kind !== 'progress') return label

  const parts: string[] = [label]
  if (typeof status.current === 'number' && typeof status.total === 'number' && status.total > 0) {
    parts.push(`${status.current}/${status.total}`)
  }
  if (typeof status.bytesCurrent === 'number' && typeof status.bytesTotal === 'number' && status.bytesTotal > 0) {
    parts.push(`${formatKb(status.bytesCurrent)}/${formatKb(status.bytesTotal)}`)
  } else if (typeof status.bytesTotal === 'number' && status.bytesTotal > 0) {
    parts.push(formatKb(status.bytesTotal))
  }
  return parts.join(' • ')
}

