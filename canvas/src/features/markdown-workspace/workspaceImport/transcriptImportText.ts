const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

export const WORKSPACE_IMPORT_TRANSCRIPT_STATUS_LABEL = 'Transcript status'

export function formatWorkspaceImportTranscriptStatusLine(message: unknown): string {
  return `${WORKSPACE_IMPORT_TRANSCRIPT_STATUS_LABEL}: ${cleanInline(message) || 'Transcript unavailable'}`
}

export function readWorkspaceImportTranscriptStatus(value: unknown): string {
  const text = String(value || '').replace(/\r/g, '')
  for (const rawLine of text.split('\n')) {
    const line = cleanInline(rawLine)
    const match = /^Transcript status\s*:\s*(.+)$/i.exec(line)
    if (match?.[1]) return cleanInline(match[1])
  }
  return ''
}

export function isWorkspaceImportTranscriptControlLine(value: unknown): boolean {
  const text = cleanInline(value)
  const unheaded = text.replace(/^#+\s*/, '')
  if (!unheaded || unheaded === '---') return true
  if (/^kg[A-Z]/.test(unheaded)) return true
  if (/^https?:\/\//i.test(unheaded)) return true
  if (/^YouTube Video Source$/i.test(unheaded)) return true
  if (/^(Video ID|Source)\s*:/i.test(unheaded)) return true
  return !!readWorkspaceImportTranscriptStatus(unheaded)
}
