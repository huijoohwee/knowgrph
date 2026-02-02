import { useGraphStore } from '@/hooks/useGraphStore'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { jsonToMarkdown, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import type { RecentFileEntry } from '@/hooks/store/types'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'

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
  state.setMarkdownDocument(name, text)
  state.setJsonSourceDocument(name, null)
  state.setMarkdownDocumentSourceUrl(sourceUrl)
  if (args.curationView === 'markdown') {
    state.setWorkspaceViewMode('editor')
  } else if (args.curationView === 'grid') {
    state.setBottomPanelCurationView('grid')
  }
  if (args.recent) {
    state.addRecentFile(args.recent)
  }
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
}): void {
  const name = String(args.name || '').trim()
  const rawText = String(args.text || '')
  const trimmed = rawText.trim()
  if (!name) return

  const state = useGraphStore.getState()
  if (!trimmed) {
    state.setJsonSourceDocument(name, null)
    state.setMarkdownDocument(name, rawText)
    state.setMarkdownDocumentSourceUrl(args.sourceUrl)
    if (args.recent) state.addRecentFile(args.recent)
    return
  }

  let markdown = rawText
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
    markdown = jsonToMarkdown(parsed, { defaultMode: persistedMode }, persistedMode)
    lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, persistedMode)
    state.setJsonSourceDocument(name, trimmed)
  } catch {
    const fenceLang = args.fallbackFenceLang || 'json'
    markdown = ['```' + fenceLang, trimmed, '```', ''].join('\n')
    state.setJsonSourceDocument(name, null)
  }

  state.setMarkdownDocument(name, markdown)
  state.setMarkdownDocumentSourceUrl(args.sourceUrl)
  state.setWorkspaceViewMode('editor')
  if (args.recent) state.addRecentFile(args.recent)
}
