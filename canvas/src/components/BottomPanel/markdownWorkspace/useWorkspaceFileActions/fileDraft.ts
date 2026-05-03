const DEFAULT_NEW_WORKSPACE_FILE_NAME = 'note.md'

function sanitizeWorkspaceLeafName(raw: unknown): string {
  const base = String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop() || ''
  return base.replace(/\s+/g, ' ').trim()
}

function buildWorkspaceFileDraftText(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json') || lower.endsWith('.jsonld') || lower.endsWith('.geojson')) {
    return '{\n}\n'
  }
  return ''
}

export function resolveNewWorkspaceFileDraft(rawName: unknown): { name: string; text: string } | null {
  const sanitized = sanitizeWorkspaceLeafName(rawName)
  if (!sanitized || sanitized === '.' || sanitized === '..') return null
  const name = sanitized.includes('.') ? sanitized : `${sanitized}.md`
  return {
    name,
    text: buildWorkspaceFileDraftText(name),
  }
}

export function getDefaultNewWorkspaceFileName(): string {
  return DEFAULT_NEW_WORKSPACE_FILE_NAME
}
