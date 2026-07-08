import { recoverStructuredKgcAssistantPayload } from '../chatHistoryWorkspace.kgc.recovery'

export const extractKgcBlockFromAssistantText = (
  raw: string,
): { answer: string; kgc: string | null } => {
  return recoverStructuredKgcAssistantPayload(raw)
}

export const toConciseBulletText = (raw: string, maxWords = 50): string => {
  const cleaned = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/````[\s\S]*?````/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 0) return 'No response content.'
  const sliced = words.slice(0, Math.max(1, maxWords))
  const suffix = words.length > sliced.length ? '…' : ''
  return `${sliced.join(' ')}${suffix}`
}

export const scoreFallbackCandidate = (raw: string): number => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return -1_000
  if (text.includes('Previous invalid KGC attempt was omitted')) return -900
  const looksLikeStructuredArtifact =
    text.startsWith('---\n') ||
    (/@node:|@edge:/.test(text) && !/^##\s+/m.test(text))
  if (looksLikeStructuredArtifact) return -850
  const words = text.split(/\s+/).filter(Boolean).length
  const headings = (text.match(/^#{2,4}\s+/gm) || []).length
  const bullets = (text.match(/^\s*[-*]\s+/gm) || []).length
  const hasKgcFence = /```+\s*kgc\b/i.test(text)
  const hasEscapedKgc = /\\`\\`\\`\s*kgc\b/i.test(text)
  const hasResidualArtifact = /\n\s*kgc\s*\n/i.test(`\n${text}\n`) || text.includes('\\---')
  let score = words + headings * 24 + bullets * 4
  if (hasKgcFence) score -= 120
  if (hasEscapedKgc) score -= 80
  if (hasResidualArtifact) score -= 60
  return score
}

export const pickBestErrorFallbackSource = (args: {
  rawAssistantText: string
  extractedAnswer: string
  extractedKgc: string | null
  fallbackNote: string
}): string => {
  const candidates = [
    String(args.rawAssistantText || ''),
    String(args.extractedAnswer || ''),
    String(args.fallbackNote || ''),
  ]
  let best = ''
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const score = scoreFallbackCandidate(candidate)
    if (score <= bestScore) continue
    best = candidate
    bestScore = score
  }
  return best || args.fallbackNote
}
