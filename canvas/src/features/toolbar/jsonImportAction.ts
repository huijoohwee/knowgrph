import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { fetchRemoteText, promptForUrl } from './ingestUtils'
import { jsonToMarkdown, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { deriveFilenameFromUrl } from '@/lib/url'

export type JsonImportFormat = 'jsonld' | 'json'
export type JsonImportType = 'url' | 'local'

export async function performJsonImport(type: JsonImportType, format: JsonImportFormat, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string; sourceUrl?: string } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.jsonImportUrlPrompt) || ''
        })()
        if (!rawUrl) return null
        const text = await fetchRemoteText(rawUrl)
        if (!text) {
          try {
            const ui = useParserUIState.getState()
            ui.setDataLoadStatus(false, UI_COPY.jsonImportFetchFailedStatus(rawUrl))
          } catch {
            void 0
          }
          return null
        }
        const fallback = format === 'jsonld' ? 'remote.jsonld' : 'remote.json'
        return { name: deriveFilenameFromUrl(rawUrl, fallback), text, sourceUrl: rawUrl }
      }
      if (type === 'local') {
        const p = await pickTextFileWithExtensions(['.json', '.jsonld'])
        if (!p) return null
        return { ...p, sourceUrl: undefined }
      }
      return null
    })()

    if (!picked) return

    const res = await loadGraphDataFromTextViaParser(picked.name, picked.text)
    applyLoaderResultToParserUi(res, { collapsePanelsOnSuccess: true })
    if (!res) return

    try {
      const state = useGraphStore.getState()
      if (res.input && res.input.text.trim()) {
        const rawName = String(res.input.name || '')
        const baseName = rawName.trim() || (format === 'jsonld' ? 'graph.jsonld' : 'graph.json')
        const rawText = String(res.input.text || '')
        const trimmed = rawText.trim()
        let markdown = rawText
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed)
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
            state.setJsonSourceDocument(baseName, trimmed)
          } catch {
            const fenceLang = 'json'
            markdown = ['```' + fenceLang, trimmed, '```', ''].join('\n')
            state.setJsonSourceDocument(baseName, null)
          }
        } else {
          state.setJsonSourceDocument(baseName, null)
        }
        state.setMarkdownDocument(baseName, markdown)
        state.setMarkdownDocumentSourceUrl(null)
      }
    } catch {
      void 0
    }

    openBottomPanel('data')
  } catch {
    applyLoaderResultToParserUi(null)
  }
}

export async function performCsvImport() {
  try {
    const picked = await pickTextFileWithExtensions(['.csv'])
    if (!picked) return

    const res = await loadGraphDataFromTextViaParser(picked.name, picked.text)
    applyLoaderResultToParserUi(res)
    if (!res) return

    try {
      const state = useGraphStore.getState()
      if (res.input && res.input.text.trim()) {
        const rawName = String(res.input.name || '')
        const baseName = rawName.trim() || 'graph.csv'
        const rawText = String(res.input.text || '')
        const trimmed = rawText.trim()
        const markdown = trimmed
          ? ['```csv', trimmed, '```', ''].join('\n')
          : rawText
        state.setMarkdownDocument(baseName, markdown)
        state.setMarkdownDocumentSourceUrl(null)
      }
    } catch {
      void 0
    }

    openBottomPanel('data')
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
