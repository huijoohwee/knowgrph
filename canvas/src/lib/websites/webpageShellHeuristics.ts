const WEBPAGE_SHELL_PATTERN_SOURCES = [
  'failed\\s+to\\s+load\\s+posts',
  'enable[-\\s]*javascript\\.com',
  'requires\\s+java\\s*script',
  '\\bloading\\s+(shared|report|document|page|workspace|content|article|post|chat|thread|conversation)\\b',
  '\\b(open|get|download|install)\\s+app\\b',
  '\\bplease\\s+wait\\b',
] as const

export const WEBPAGE_SHELL_PATTERN_REGEX_SOURCES = [...WEBPAGE_SHELL_PATTERN_SOURCES]

const WEBPAGE_SHELL_PATTERNS = WEBPAGE_SHELL_PATTERN_SOURCES.map(source => new RegExp(source, 'i'))

const normalizeWebpageShellProbeText = (text: string): string =>
  String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

export function looksLikeWebpageShellText(text: string): boolean {
  const raw = String(text || '')
  const normalized = normalizeWebpageShellProbeText(raw)
  if (!normalized) return false
  if (WEBPAGE_SHELL_PATTERNS.some(pattern => pattern.test(normalized)) === false) return false

  const lines = raw
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const substantiveLineCount = lines.filter(line => line.length >= 80 || line.split(/\s+/).length >= 12).length
  const sentenceCount = (normalized.match(/[.!?](?:\s|$)/g) || []).length

  if (/failed\s+to\s+load\s+posts|enable[-\s]*javascript\.com|requires\s+java\s*script/i.test(normalized)) {
    return true
  }
  if (normalized.length <= 8_000 && sentenceCount < 6 && substantiveLineCount < 4) return true
  if (/\bloading\b/i.test(normalized) && substantiveLineCount < 2) return true
  return false
}
