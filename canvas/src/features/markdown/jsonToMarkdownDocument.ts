import { buildFlowchartMarkdownFromJsonText, buildFlowchartMarkdownFromJsonValue } from '@/features/markdown/flowchartJsonToMarkdown'
import { jsonToMarkdownPreferTable, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { buildJsonMarkdownConfigFromPreferences, readJsonMarkdownMode, writeJsonMarkdownMode } from '@/features/markdown/jsonMarkdownPreferences'
import { readMarkdownSourceFidelityTextFromValue } from '@/features/markdown/jsonMarkdownSourceFidelity'
import { tryBuildBytePlusLuminaCanvasGraphData } from '@/lib/graph/io/byteplusLuminaCanvas'

export type JsonMarkdownDocumentResult = {
  markdown: string
  jsonSourceText: string | null
  mode: JsonToMarkdownMode
}

export function tryBuildJsonMarkdownDocumentFromText(
  text: string,
  preferredMode?: JsonToMarkdownMode,
  opts?: { documentName?: string | null },
): JsonMarkdownDocumentResult | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const markdownSourceText = readMarkdownSourceFidelityTextFromValue(parsed)
    if (markdownSourceText !== null) {
      return {
        markdown: markdownSourceText,
        jsonSourceText: trimmed,
        mode: preferredMode || readJsonMarkdownMode(),
      }
    }
    return buildJsonMarkdownDocumentFromValue(parsed, {
      preferredMode,
      sourceText: trimmed,
      documentName: opts?.documentName,
    })
  } catch {
    return null
  }
}

export function buildJsonMarkdownDocumentFromValue(
  value: unknown,
  opts?: { preferredMode?: JsonToMarkdownMode; sourceText?: string | null; documentName?: string | null },
): JsonMarkdownDocumentResult {
  const mode = opts?.preferredMode || readJsonMarkdownMode()
  const sourceName = String(opts?.documentName || 'workspace.json').trim() || 'workspace.json'
  const specializedGraph = tryBuildBytePlusLuminaCanvasGraphData({ name: sourceName, json: value })
  const specializedMarkdownSource = specializedGraph
    ? readMarkdownSourceFidelityTextFromValue(specializedGraph.graphData)
    : null
  if (specializedMarkdownSource !== null) {
    return {
      markdown: specializedMarkdownSource,
      jsonSourceText: typeof opts?.sourceText === 'string' && opts.sourceText.trim() ? opts.sourceText.trim() : null,
      mode,
    }
  }
  const flowchart = buildFlowchartMarkdownFromJsonValue(value)
  const config = buildJsonMarkdownConfigFromPreferences()
  const markdown = flowchart || jsonToMarkdownPreferTable(value, { ...config, defaultMode: mode }, mode)
  writeJsonMarkdownMode(mode)
  const jsonSourceText = typeof opts?.sourceText === 'string' && opts.sourceText.trim() ? opts.sourceText.trim() : null
  return { markdown, jsonSourceText, mode }
}

export function tryBuildJsonMarkdownTablesFromText(text: string, preferredMode?: JsonToMarkdownMode): string | null {
  const flowchart = buildFlowchartMarkdownFromJsonText(text)
  if (flowchart) return flowchart
  const built = tryBuildJsonMarkdownDocumentFromText(text, preferredMode)
  return built ? built.markdown : null
}
