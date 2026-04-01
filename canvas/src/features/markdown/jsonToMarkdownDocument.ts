import { buildBipartiteMarkdownFromJsonText, buildBipartiteMarkdownFromJsonValue } from '@/features/markdown/bipartiteJsonToMarkdown'
import { jsonToMarkdownPreferTable, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { buildJsonMarkdownConfigFromPreferences, readJsonMarkdownMode, writeJsonMarkdownMode } from '@/features/markdown/jsonMarkdownPreferences'

export type JsonMarkdownDocumentResult = {
  markdown: string
  jsonSourceText: string | null
  mode: JsonToMarkdownMode
}

export function tryBuildJsonMarkdownDocumentFromText(text: string, preferredMode?: JsonToMarkdownMode): JsonMarkdownDocumentResult | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return buildJsonMarkdownDocumentFromValue(parsed, { preferredMode, sourceText: trimmed })
  } catch {
    return null
  }
}

export function buildJsonMarkdownDocumentFromValue(
  value: unknown,
  opts?: { preferredMode?: JsonToMarkdownMode; sourceText?: string | null },
): JsonMarkdownDocumentResult {
  const mode = opts?.preferredMode || readJsonMarkdownMode()
  const bipartite = buildBipartiteMarkdownFromJsonValue(value)
  const config = buildJsonMarkdownConfigFromPreferences()
  const markdown = bipartite || jsonToMarkdownPreferTable(value, { ...config, defaultMode: mode }, mode)
  writeJsonMarkdownMode(mode)
  const jsonSourceText = typeof opts?.sourceText === 'string' && opts.sourceText.trim() ? opts.sourceText.trim() : null
  return { markdown, jsonSourceText, mode }
}

export function tryBuildJsonMarkdownTablesFromText(text: string, preferredMode?: JsonToMarkdownMode): string | null {
  const bipartite = buildBipartiteMarkdownFromJsonText(text)
  if (bipartite) return bipartite
  const built = tryBuildJsonMarkdownDocumentFromText(text, preferredMode)
  return built ? built.markdown : null
}
