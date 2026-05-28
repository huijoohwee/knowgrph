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

const WEBPAGE_SHELL_CHROME_CUE_REGEX =
  /\b(get|open|download|install|launch|continue)\s+app\b|\b(sign\s*in|sign\s*up|log\s*in|log\s*on|visit\s+website|visit\s+site|app\s+store|google\s+play)\b/gi

const WEBPAGE_SHELL_SHARED_SURFACE_REGEX = /\bshared\s+(chat|conversation|report|document|page|thread)\b/i

const WEBPAGE_SHELL_HTML_CHROME_TAG_REGEX = /<\/?(div|span|header|nav|footer|main|section|aside|button|svg|dialog|menu)\b/gi

const WEBPAGE_SHELL_ACTION_ELEMENT_REGEX = /\[[^\]]{1,80}\]\([^)]+\)|<a\b|<button\b/gi

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
  const chromeCueCount = (normalized.match(WEBPAGE_SHELL_CHROME_CUE_REGEX) || []).length
  const actionElementCount = (raw.match(WEBPAGE_SHELL_ACTION_ELEMENT_REGEX) || []).length
  const htmlChromeTagCount = (raw.match(WEBPAGE_SHELL_HTML_CHROME_TAG_REGEX) || []).length
  const hasLoadingCue = /\bloading\b/i.test(normalized)
  const hasSharedSurfaceCue = WEBPAGE_SHELL_SHARED_SURFACE_REGEX.test(normalized)
  const hasWaitCue = /\bplease\s+wait\b/i.test(normalized)
  const hasNarrativeDensity = sentenceCount >= 10 || substantiveLineCount >= 6

  if (/failed\s+to\s+load\s+posts|enable[-\s]*javascript\.com|requires\s+java\s*script/i.test(normalized)) {
    return true
  }
  if ((hasLoadingCue || hasWaitCue || hasSharedSurfaceCue) && chromeCueCount >= 2) return true
  if ((hasLoadingCue || chromeCueCount >= 3) && actionElementCount >= 8 && !hasNarrativeDensity) return true
  if ((hasLoadingCue || chromeCueCount >= 3) && htmlChromeTagCount >= 16 && sentenceCount < 12) return true
  if (normalized.length <= 8_000 && sentenceCount < 6 && substantiveLineCount < 4) return true
  if (/\bloading\b/i.test(normalized) && substantiveLineCount < 2) return true
  return false
}
