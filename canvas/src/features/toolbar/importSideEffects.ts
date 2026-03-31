import { useGraphStore } from '@/hooks/useGraphStore'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { jsonToMarkdown, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { buildBipartiteMarkdownFromJsonValue } from '@/features/markdown/bipartiteJsonToMarkdown'
import type { RecentFileEntry } from '@/hooks/store/types'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { applyJsonImportWorkspaceTarget } from '@/features/workspace-table/jsonImportWorkspaceTarget'

export function applyImportedMarkdownToStore(args: {
  name: string
  text: string
  sourceUrl: string | null
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'>
  curationView?: 'grid' | 'markdown'
}): void {
  const name = String(args.name || '').trim()
  const text = normalizeMermaidMmdToMarkdown(name, String(args.text || ''))
  const sourceUrl = typeof args.sourceUrl === 'string' ? args.sourceUrl : null
  if (!name) return

  const state = useGraphStore.getState()
  void state.setActiveMarkdownDocument({
    name,
    text,
    normalizeMermaidMmd: false,
    sourceUrl,
    jsonSourceText: null,
    workspaceViewMode: args.curationView === 'markdown' ? 'editor' : args.curationView === 'grid' ? 'canvas' : null,
    recent: args.recent,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
}

export function applyImportedCsvToStore(args: {
  name: string
  text: string
  sourceUrl: string | null
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'>
}): void {
  const name = String(args.name || '').trim()
  const rawText = String(args.text || '')
  if (!name) return
  const trimmed = rawText.trim()
  const markdown = trimmed ? ['```csv', trimmed, '```', ''].join('\n') : rawText
  applyImportedMarkdownToStore({
    name,
    text: markdown,
    sourceUrl: args.sourceUrl,
    recent: args.recent,
    curationView: 'markdown',
  })
}

export function applyImportedJsonToStore(args: {
  name: string
  text: string
  fallbackFenceLang?: 'json' | 'jsonld'
  sourceUrl: string | null
  recent?: Omit<RecentFileEntry, 'id' | 'timestamp'>
  preferFlowEditor?: boolean
}): void {
  const name = String(args.name || '').trim()
  const rawText = String(args.text || '')
  const trimmed = rawText.trim()
  if (!name) return

  const state = useGraphStore.getState()
  const applyWorkspaceTarget = () => applyJsonImportWorkspaceTarget({ preferFlowEditor: args.preferFlowEditor === true })
  if (!trimmed) {
    void state
      .setActiveMarkdownDocument({
      name,
      text: rawText,
      normalizeMermaidMmd: false,
      sourceUrl: args.sourceUrl,
      jsonSourceText: null,
      recent: args.recent,
    })
      .finally(applyWorkspaceTarget)
    return
  }

  let markdown = rawText
  let jsonSourceText: string | null = null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const persistedMode = lsJson<JsonToMarkdownMode>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
      value =>
        value === 'table' ||
        value === 'key-value' ||
        value === 'hierarchical' ||
        value === 'auto'
          ? value
          : 'auto',
    )
    markdown = buildBipartiteMarkdownFromJsonValue(parsed) || jsonToMarkdown(parsed, { defaultMode: persistedMode }, persistedMode)
    lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, persistedMode)
    jsonSourceText = trimmed
  } catch {
    const fenceLang = args.fallbackFenceLang || 'json'
    markdown = ['```' + fenceLang, trimmed, '```', ''].join('\n')
    jsonSourceText = null
  }

  void state
    .setActiveMarkdownDocument({
    name,
    text: markdown,
    normalizeMermaidMmd: false,
    sourceUrl: args.sourceUrl,
    jsonSourceText,
    recent: args.recent,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
    .finally(applyWorkspaceTarget)
}
