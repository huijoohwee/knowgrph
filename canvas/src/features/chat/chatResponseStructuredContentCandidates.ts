import yaml from 'js-yaml'
import { isPlainObject } from '@/lib/graph/value'

export const STRUCTURED_ENVELOPE_KEYS = [
  'response',
  'result',
  'toolResult',
  'tool_result',
  'payload',
  'data',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value)

const readString = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : (typeof value === 'number' || typeof value === 'boolean')
      ? String(value).trim()
      : ''

const readFirstString = (record: Record<string, unknown>, keys: readonly string[]): string => {
  for (let i = 0; i < keys.length; i += 1) {
    const value = readString(record[keys[i] as string])
    if (value) return value
  }
  return ''
}

export const parseYamlOrJsonValue = (text: string): unknown | null => {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    return trimmed.startsWith('{') ? JSON.parse(trimmed) : yaml.load(trimmed)
  } catch {
    return null
  }
}

const extractLeadingFrontmatterCandidate = (text: string): string => {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trimStart()
  if (!normalized.startsWith('---\n')) return ''
  const end = normalized.indexOf('\n---', 4)
  if (end < 0) return ''
  return normalized.slice(4, end).trim()
}

const extractTopLevelYamlSection = (yamlText: string, key: string): string => {
  const lines = String(yamlText || '').replace(/\r\n/g, '\n').split('\n')
  const keyLabel = `${String(key || '').trim()}:`
  const start = lines.findIndex(line => String(line || '').startsWith(keyLabel))
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] || ''
    if (!line.trim()) continue
    if (/^\S/.test(line)) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

export const collectStructuredTextCandidates = (rawText: string, limit: number): string[] => {
  const text = String(rawText || '').replace(/\r\n/g, '\n')
  const candidates: string[] = []
  const frontmatterCandidate = extractLeadingFrontmatterCandidate(text)
  if (frontmatterCandidate) {
    const responseSection = extractTopLevelYamlSection(frontmatterCandidate, 'response')
    if (responseSection) candidates.push(responseSection)
    candidates.push(frontmatterCandidate)
  }
  const fenceRx = /(^|\n)\s*```+(?:ya?ml|json)\s*\n([\s\S]*?)\n\s*```+/gi
  let match: RegExpExecArray | null
  while ((match = fenceRx.exec(text))) {
    const body = String(match[2] || '').trim()
    if (body) candidates.push(body)
    if (candidates.length >= limit) break
  }
  if (/^\s*[\[{]/.test(text)) candidates.push(text)
  return candidates.slice(0, limit)
}

const collectEmbeddedContentText = (value: unknown, out: string[], depth = 0): void => {
  if (out.length >= 8 || depth > 4) return
  if (Array.isArray(value)) {
    for (const item of value) collectEmbeddedContentText(item, out, depth + 1)
    return
  }
  if (!isRecord(value)) return
  const content = value.content
  if (typeof content === 'string' && content.trim()) out.push(content)
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'string' && part.trim()) {
        out.push(part)
      } else if (isRecord(part)) {
        const text = readFirstString(part, ['text', 'content', 'output_text'])
        if (text) out.push(text)
      }
      if (out.length >= 8) return
    }
  }
  for (const key of STRUCTURED_ENVELOPE_KEYS) {
    collectEmbeddedContentText(value[key], out, depth + 1)
    if (out.length >= 8) return
  }
}

export const appendEmbeddedStructuredTextCandidates = (candidates: string[], limit: number): void => {
  const seen = new Set(candidates)
  for (let i = 0; i < candidates.length && candidates.length < limit; i += 1) {
    const parsed = parseYamlOrJsonValue(candidates[i] || '')
    if (!parsed) continue
    const embeddedTexts: string[] = []
    collectEmbeddedContentText(parsed, embeddedTexts)
    for (const embeddedText of embeddedTexts) {
      const nestedCandidates = collectStructuredTextCandidates(embeddedText, limit - candidates.length)
      for (const nested of nestedCandidates) {
        if (!nested || seen.has(nested)) continue
        seen.add(nested)
        candidates.push(nested)
        if (candidates.length >= limit) return
      }
    }
  }
}
