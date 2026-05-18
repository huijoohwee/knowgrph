export const WORKSPACE_WEBPAGE_MARKDOWN_REFRESH_MAX_CHARS = 220_000
export const WORKSPACE_WEBPAGE_MARKDOWN_IMPORT_MAX_CHARS = 1_500_000

type WebpageMarkdownCoverageMode = 'import' | 'refresh'

function stripMarkdownFrontmatterForCoverage(markdown: string): string {
  const t = String(markdown || '')
  if (!t.startsWith('---')) return t
  const end = t.indexOf('\n---')
  if (end < 0) return t
  return t.slice(end + 4)
}

function measureMarkdownContentCoverage(markdown: string): number {
  const text = stripMarkdownFrontmatterForCoverage(markdown)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/[#>*_[\]~|\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length
}

export function chooseWebpageMarkdownByContentCoverage(args: {
  mode: WebpageMarkdownCoverageMode
  convertedMarkdown: string
  fallbackMarkdown: string
}): { markdown: string; source: 'converted' | 'fallback'; convertedScore: number; fallbackScore: number } {
  const convertedMarkdown = String(args.convertedMarkdown || '').trim()
  const fallbackMarkdown = String(args.fallbackMarkdown || '').trim()
  const convertedScore = measureMarkdownContentCoverage(convertedMarkdown)
  const fallbackScore = measureMarkdownContentCoverage(fallbackMarkdown)
  if (!convertedMarkdown && fallbackMarkdown) {
    return { markdown: fallbackMarkdown, source: 'fallback', convertedScore, fallbackScore }
  }
  if (args.mode === 'import' && fallbackMarkdown && fallbackScore >= 400) {
    const minimumGain = convertedScore < 400 ? 0 : 5_000
    const ratio = fallbackScore / Math.max(1, convertedScore)
    if (fallbackScore >= convertedScore + minimumGain && ratio >= 1.25) {
      return { markdown: fallbackMarkdown, source: 'fallback', convertedScore, fallbackScore }
    }
  }
  return { markdown: convertedMarkdown, source: 'converted', convertedScore, fallbackScore }
}

export function clipLargeWebpageMarkdown(text: string, maxChars: number): { text: string; clipped: boolean } {
  const t = String(text || '')
  if (!t) return { text: t, clipped: false }
  if (t.length <= maxChars) return { text: t, clipped: false }
  const keep = t.slice(0, maxChars)
  const omitted = t.length - keep.length
  return {
    text: `${keep}\n\n…(clipped ${omitted} chars)…\n`,
    clipped: true,
  }
}
