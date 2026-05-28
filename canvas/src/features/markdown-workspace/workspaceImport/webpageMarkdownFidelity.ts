import { looksLikeWebpageShellText, pruneWebpageChromeText } from '@/lib/websites/webpageShellHeuristics'

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

function normalizeMarkdownForRenderedTextCoverage(markdown: string): string {
  return stripMarkdownFrontmatterForCoverage(markdown)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*>\s?/gm, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    .replace(/^[ \t]*#{1,6}\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\\([()[\]{}_*!~\\])/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}\s%$./:+#@&-]+/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function normalizeRenderedTextLineForCoverage(value: string): string {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}\s%$./:+#@&-]+/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function measureRenderedTextCoverageInMarkdown(renderedText: string, markdown: string): number {
  const haystack = normalizeMarkdownForRenderedTextCoverage(markdown).toLowerCase()
  if (!haystack) return 0
  const lines = Array.from(new Set(
    String(renderedText || '')
      .split('\n')
      .map(normalizeRenderedTextLineForCoverage)
      .filter(line => line.length >= 8),
  ))
  if (lines.length === 0) return 0
  let totalChars = 0
  let matchedChars = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    totalChars += line.length
    if (haystack.includes(line.toLowerCase())) matchedChars += line.length
  }
  return totalChars > 0 ? matchedChars / totalChars : 0
}

function looksStructuredMarkdown(markdown: string): boolean {
  return /^(?:#{1,6}\s|[-*+]\s|\d+\.\s|> |\|.*\|)/m.test(String(markdown || ''))
}

function measureMarkdownStructureRichness(markdown: string): number {
  const text = String(markdown || '')
  if (!text.trim()) return 0
  let richness = 0
  if (/^#{1,6}\s/m.test(text)) richness += 1
  if (/^>\s/m.test(text)) richness += 1
  if (/^\s*\d+\.\s/m.test(text)) richness += 1
  if (/^\s*[-*+]\s/m.test(text)) richness += 1
  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) richness += 1
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) richness += 1
  if (/```|~~~/.test(text)) richness += 1
  if (/(^|[^`])`[^`\n]+`(?!`)/.test(text)) richness += 1
  if (/^\s*\|.*\|\s*$/m.test(text)) richness += 1
  if (/(^|[^\\])\$[^$\n]+\$(?!\$)/.test(text)) richness += 1
  return richness
}

function unwrapSingleFenceMarkdown(markdown: string): string {
  const lines = String(markdown || '').trim().split('\n')
  if (lines.length < 3) return ''
  const first = String(lines[0] || '').trim()
  const m = first.match(/^(`{3,}|~{3,})/)
  if (!m) return ''
  const fence = m[1] || ''
  const last = String(lines[lines.length - 1] || '').trim()
  if (!last.startsWith(fence)) return ''
  return lines.slice(1, -1).join('\n').trim()
}

function repairLeadingRenderedLineBoundaryMerges(convertedMarkdown: string, renderedTextMarkdown: string): string {
  let repaired = String(convertedMarkdown || '')
  if (!repaired) return repaired
  const renderedLines = String(renderedTextMarkdown || '')
    .split('\n')
    .map(line => String(line || '').trim())
    .filter(line => line.length >= 4)
    .slice(0, 8)
  if (renderedLines.length < 2) return repaired

  const shouldSplitBeforeLine = (line: string): boolean => {
    const wordCount = line.split(/\s+/).filter(Boolean).length
    if (line.length > 120 || wordCount > 14) return false
    return /^[A-Z0-9][A-Za-z0-9/&:,'"\-() ]*$/.test(line) || /^(?:show|summary|outline|references?)\b/i.test(line)
  }

  for (let i = 1; i < renderedLines.length; i += 1) {
    const previous = renderedLines[i - 1]!
    const next = renderedLines[i]!
    if (!shouldSplitBeforeLine(next)) continue
    const prefix = repaired.slice(0, 1_600)
    if (prefix.includes(`${previous}\n${next}`) || prefix.includes(`${previous}\n\n${next}`)) continue
    const joinedCandidates = [
      `${previous}${next}`,
      `${previous} ${next}`,
    ]
    const joined = joinedCandidates.find(candidate => prefix.includes(candidate))
    if (!joined) continue
    repaired = repaired.replace(joined, `${previous}\n\n${next}`)
  }

  return repaired
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

export function chooseDomRecoveredMarkdown(args: {
  mode: WebpageMarkdownCoverageMode
  convertedMarkdown: string
  renderedTextMarkdown: string
  preferStructuredMarkdown?: boolean
}): {
  markdown: string
  source: 'converted' | 'rendered'
  convertedScore: number
  renderedScore: number
  renderedCoverageRatio: number
} {
  const convertedMarkdown = String(args.convertedMarkdown || '').trim()
  const renderedTextMarkdown = String(args.renderedTextMarkdown || '').trim()
  const prunedRenderedTextMarkdown = pruneWebpageChromeText(renderedTextMarkdown)
  const coverageRenderedTextMarkdown = prunedRenderedTextMarkdown || renderedTextMarkdown
  const convertedScore = measureMarkdownContentCoverage(convertedMarkdown)
  const renderedScore = measureMarkdownContentCoverage(coverageRenderedTextMarkdown)
  const renderedCoverageRatio = measureRenderedTextCoverageInMarkdown(coverageRenderedTextMarkdown, convertedMarkdown)
  if (!convertedMarkdown && renderedTextMarkdown) {
    return { markdown: renderedTextMarkdown, source: 'rendered', convertedScore, renderedScore, renderedCoverageRatio }
  }
  if (!renderedTextMarkdown && convertedMarkdown) {
    return { markdown: convertedMarkdown, source: 'converted', convertedScore, renderedScore, renderedCoverageRatio }
  }
  const structuredConverted = looksStructuredMarkdown(convertedMarkdown)
  const repairedConvertedMarkdown = structuredConverted
    ? repairLeadingRenderedLineBoundaryMerges(convertedMarkdown, renderedTextMarkdown)
    : convertedMarkdown
  const convertedRichness = measureMarkdownStructureRichness(repairedConvertedMarkdown)
  const renderedRichness = measureMarkdownStructureRichness(renderedTextMarkdown)
  const keepsEnoughRenderedText =
    renderedCoverageRatio >= 0.72
    || (renderedCoverageRatio >= 0.6 && convertedScore >= Math.max(240, renderedScore * 0.7))
  const preferStructuredMarkdown = args.preferStructuredMarkdown === true
  const preservesEnoughStructuredContent =
    convertedScore >= Math.max(160, Math.floor(renderedScore * 0.25))
  const meaningfullyRicherStructuredMarkdown =
    structuredConverted
    && convertedRichness >= Math.max(3, renderedRichness + 2)
  const convertedSingleFenceBody = unwrapSingleFenceMarkdown(repairedConvertedMarkdown)
  if (
    preferStructuredMarkdown
    && renderedRichness >= 4
    && convertedSingleFenceBody
    && convertedSingleFenceBody === renderedTextMarkdown
  ) {
    return { markdown: renderedTextMarkdown, source: 'rendered', convertedScore, renderedScore, renderedCoverageRatio }
  }
  if (structuredConverted && keepsEnoughRenderedText) {
    return { markdown: repairedConvertedMarkdown, source: 'converted', convertedScore, renderedScore, renderedCoverageRatio }
  }
  if (
    preferStructuredMarkdown
    && meaningfullyRicherStructuredMarkdown
    && preservesEnoughStructuredContent
    && (renderedCoverageRatio >= 0.2 || convertedScore >= 320)
  ) {
    return { markdown: repairedConvertedMarkdown, source: 'converted', convertedScore, renderedScore, renderedCoverageRatio }
  }
  if (args.mode === 'import' && renderedTextMarkdown) {
    return { markdown: renderedTextMarkdown, source: 'rendered', convertedScore, renderedScore, renderedCoverageRatio }
  }
  return { markdown: repairedConvertedMarkdown, source: 'converted', convertedScore, renderedScore, renderedCoverageRatio }
}

export function shouldAcceptConvertedDomRecoveredMarkdown(args: {
  markdown: string
  title?: string
}): boolean {
  const markdown = String(args.markdown || '').trim()
  if (!markdown) return false
  if (looksStructuredMarkdown(markdown) && !looksLikeMostlyTitleOnlyMarkdown(markdown, args.title)) {
    return !isLikelyLowFidelityConvertedMarkdown(markdown)
  }
  if (markdown.length < 220) return false
  if (looksLikeMostlyTitleOnlyMarkdown(markdown, args.title)) return false
  return !isLikelyLowFidelityConvertedMarkdown(markdown)
}

function looksLikeMostlyTitleOnlyMarkdown(markdown: string, title?: string): boolean {
  const normalizedMarkdown = String(markdown || '').replace(/\s+/g, ' ').trim()
  const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim()
  if (!normalizedMarkdown || !normalizedTitle) return false
  if (normalizedMarkdown.length > 120) return false
  return normalizedMarkdown === normalizedTitle
}

function isLikelyLowFidelityConvertedMarkdown(markdown: string): boolean {
  const normalized = String(markdown || '').trim()
  if (!normalized) return true
  if (looksLikeWebpageShellText(normalized)) return true
  if (normalized.length >= 400) return false
  return normalized.length < 220
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
