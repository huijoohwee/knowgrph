import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { countYamlIndent, findLeadingUnfencedYamlMetadataEnd } from '@/lib/markdown/frontmatterYamlRepair'

export const parseStrybldrStoryboardFrontmatter = (text: string): ReturnType<typeof parseMarkdownFrontmatter> => {
  const lines = splitMarkdownLines(String(text || ''))
  const fenced = parseMarkdownFrontmatter(lines)
  if (Object.keys(fenced.meta || {}).length > 0 || fenced.warnings.length > 0 || fenced.startIndex > 0) return fenced
  const end = findLeadingUnfencedYamlMetadataEnd(lines)
  return end > 0 ? parseMarkdownFrontmatter(['---', ...lines.slice(0, end), '---']) : fenced
}

function readFrontmatterLines(text: string): string[] {
  const lines = splitMarkdownLines(String(text || ''))
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (/^---\s*$/.test(String(lines[lead] || ''))) {
    for (let index = lead + 1; index < lines.length; index += 1) {
      if (/^---\s*$/.test(String(lines[index] || ''))) return lines.slice(lead + 1, index)
    }
    return []
  }
  const end = findLeadingUnfencedYamlMetadataEnd(lines)
  return end > 0 ? lines.slice(0, end) : []
}

export function readStrybldrStoryboardPayloadValue(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function readStrybldrStoryboardPayloadFromFrontmatterLines(text: string, payloadKeys: readonly string[]): Record<string, unknown> | null {
  const lines = readFrontmatterLines(text)
  for (const key of payloadKeys) {
    const start = lines.findIndex(raw => countYamlIndent(String(raw || '')) === 0 && String(raw || '').trim().startsWith(`${key}:`))
    if (start < 0) continue
    let end = lines.length
    for (let index = start + 1; index < lines.length; index += 1) {
      const raw = String(lines[index] || '')
      if (raw.trim() && countYamlIndent(raw) === 0 && /^[A-Za-z0-9_.-]+\s*:/.test(raw.trim())) {
        end = index
        break
      }
    }
    const parsed = parseMarkdownFrontmatter(['---', ...lines.slice(start, end), '---'])
    const payload = readStrybldrStoryboardPayloadValue((parsed.meta as Record<string, unknown> | undefined)?.[key])
    if (payload) return payload
  }
  return null
}
