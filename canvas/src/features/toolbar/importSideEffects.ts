import { useGraphStore } from '@/hooks/useGraphStore'
import type { RecentFileEntry } from '@/hooks/store/types'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'
import { applyJsonImportWorkspaceTarget } from '@/features/workspace-table/jsonImportWorkspaceTarget'
import { tryBuildJsonMarkdownDocumentFromText } from '@/features/markdown/jsonToMarkdownDocument'

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
  const workspaceViewMode = args.curationView === 'markdown' ? 'editor' : args.curationView === 'grid' ? 'canvas' : null
  if (workspaceViewMode === 'editor' || workspaceViewMode === 'canvas') {
    try {
      state.setWorkspaceViewMode(workspaceViewMode)
    } catch {
      void 0
    }
  }
  void state.setActiveMarkdownDocument({
    name,
    text,
    normalizeMermaidMmd: false,
    sourceUrl,
    jsonSourceText: null,
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
  applyToGraph?: boolean
}): void {
  const name = String(args.name || '').trim()
  const rawText = String(args.text || '')
  const trimmed = rawText.trim()
  if (!name) return

  const state = useGraphStore.getState()
  const applyWorkspaceTarget = () => applyJsonImportWorkspaceTarget({ preferFlowEditor: args.preferFlowEditor === true })
  const applyToGraph = args.applyToGraph !== false
  if (!trimmed) {
    void state
      .setActiveMarkdownDocument({
      name,
      text: rawText,
      normalizeMermaidMmd: false,
      sourceUrl: args.sourceUrl,
      jsonSourceText: null,
      recent: args.recent,
      applyToGraph,
      forceApplyToGraph: applyToGraph,
    })
      .finally(applyWorkspaceTarget)
    return
  }

  let markdown = rawText
  let jsonSourceText: string | null = null
  const converted = tryBuildJsonMarkdownDocumentFromText(trimmed)
  if (converted) {
    markdown = converted.markdown
    jsonSourceText = converted.jsonSourceText
  } else {
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
    applyToGraph,
    forceApplyToGraph: applyToGraph,
  })
    .finally(applyWorkspaceTarget)
}
