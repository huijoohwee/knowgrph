import { splitLeadingFrontmatterAndBody } from './chatKgcFrontmatter'

const countLeadingSpaces = (line: string): number => {
  const match = /^\s*/.exec(String(line || ''))
  return match?.[0]?.length ?? 0
}

const removeGroupingAliasBlocksFromFrontmatter = (frontmatter: string): string => {
  const lines = String(frontmatter || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const match = /^(\s*)(kg:subgraphs|clusters|cluster|groups|group|layers|layer)\s*:\s*(.*)$/.exec(line)
    if (!match) {
      out.push(line)
      continue
    }
    const currentIndent = countLeadingSpaces(line)
    let end = i
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = String(lines[j] || '')
      if (!next.trim()) {
        end = j
        continue
      }
      if (countLeadingSpaces(next) <= currentIndent) break
      end = j
    }
    i = end
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export const sanitizeStructuredKgcCandidate = (raw: string): string => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return text
  const parsed = splitLeadingFrontmatterAndBody(text)
  if (!parsed) return text
  const sanitizedFrontmatter = removeGroupingAliasBlocksFromFrontmatter(parsed.frontmatter)
  return ['---', sanitizedFrontmatter.trimEnd(), '---', parsed.body.trim()].join('\n').trimEnd()
}

const maybeExtractStructuredDocumentSlice = (raw: string): { kgc: string | null; wrapperStart: number; wrapperEnd: number } => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return { kgc: null, wrapperStart: -1, wrapperEnd: -1 }
  if (text.startsWith('---\n')) {
    return {
      kgc: sanitizeStructuredKgcCandidate(text),
      wrapperStart: 0,
      wrapperEnd: text.length,
    }
  }

  const kgcFenceRx = /(^|\n)\s*```+kgc\s*\n([\s\S]*?)\n\s*```+/gi
  const kgcMatches: Array<{ full: string; body: string; start: number; end: number }> = []
  let match: RegExpExecArray | null
  while ((match = kgcFenceRx.exec(text))) {
    const full = String(match[0] || '')
    const body = typeof match[2] === 'string' ? String(match[2] || '').trim() : ''
    if (!full || !body || typeof match.index !== 'number') continue
    kgcMatches.push({
      full,
      body,
      start: match.index,
      end: match.index + full.length,
    })
    if (kgcMatches.length > 2) break
  }
  if (kgcMatches.length === 1) {
    const only = kgcMatches[0]
    return {
      kgc: sanitizeStructuredKgcCandidate(only.body),
      wrapperStart: only.start,
      wrapperEnd: only.end,
    }
  }

  const outerFenceMatch = /(^|\n)([ \t]*```+[^\n]*\n)(---\n)/.exec(text)
  if (outerFenceMatch && typeof outerFenceMatch.index === 'number') {
    const wrapperStart = outerFenceMatch.index + outerFenceMatch[1].length
    const documentStart = wrapperStart + outerFenceMatch[2].length
    const closingFenceStart = text.lastIndexOf('\n```')
    if (documentStart >= 0 && closingFenceStart > documentStart) {
      return {
        kgc: sanitizeStructuredKgcCandidate(text.slice(documentStart, closingFenceStart).trim()),
        wrapperStart,
        wrapperEnd: Math.min(text.length, closingFenceStart + 1),
      }
    }
  }

  const rawDocumentStart = text.indexOf('\n---\n')
  if (rawDocumentStart >= 0) {
    return {
      kgc: sanitizeStructuredKgcCandidate(text.slice(rawDocumentStart + 1).trim()),
      wrapperStart: rawDocumentStart + 1,
      wrapperEnd: text.length,
    }
  }
  return { kgc: null, wrapperStart: -1, wrapperEnd: -1 }
}

export const recoverStructuredKgcAssistantPayload = (
  raw: string,
): { answer: string; kgc: string | null } => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return { answer: '', kgc: null }
  const recovered = maybeExtractStructuredDocumentSlice(text)
  const kgc = typeof recovered.kgc === 'string' ? recovered.kgc.trim() : ''
  if (!kgc) return { answer: text, kgc: null }
  if (recovered.wrapperStart <= 0 && recovered.wrapperEnd >= text.length) {
    return { answer: '', kgc }
  }
  const answer = [
    text.slice(0, Math.max(0, recovered.wrapperStart)).trim(),
    text.slice(Math.max(0, recovered.wrapperEnd)).replace(/^\s*```+[^\n]*\s*/g, '').trim(),
  ].filter(Boolean).join('\n\n').trim()
  return { answer, kgc }
}
