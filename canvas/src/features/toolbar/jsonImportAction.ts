import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { fetchRemoteText, promptForUrl } from './ingestUtils'
import { jsonToMarkdown, type JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'

export type JsonImportFormat = 'jsonld' | 'json'
export type JsonImportType = 'url' | 'local'

function deriveNameFromUrl(rawUrl: string, format: JsonImportFormat): string {
  const fallback = format === 'jsonld' ? 'remote.jsonld' : 'remote.json'
  try {
    const url = new URL(rawUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return last || fallback
  } catch {
    return fallback
  }
}

export async function performJsonImport(type: JsonImportType, format: JsonImportFormat, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string } | null> => {
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
        return { name: deriveNameFromUrl(rawUrl, format), text }
      }
      if (type === 'local') {
        return pickTextFileWithExtensions(['.json', '.jsonld'])
      }
      return null
    })()

    if (!picked) return

    const res = await loadGraphDataFromTextViaParser(picked.name, picked.text)
    if (!res) {
      try {
        const ui = useParserUIState.getState()
        ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
      } catch {
        void 0
      }
      return
    }

    try {
      const ui = useParserUIState.getState()
      if (res.input) {
        ui.setLastInput(res.input.name, res.input.text)
      }
      if (res.warnings && res.warnings.length > 0) {
        ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(res.warnings[0] || ''))
        ui.setWarnings(res.warnings)
      } else {
        ui.setDataLoadStatus(true, res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess)
        ui.setWarnings([])
      }
      if (res.counts) {
        ui.setCounts(res.counts)
      }
    } catch {
      void 0
    }

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
    try {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
    } catch {
      void 0
    }
  }
}

export async function performCsvImport() {
  try {
    const picked = await pickTextFileWithExtensions(['.csv'])
    if (!picked) return

    const res = await loadGraphDataFromTextViaParser(picked.name, picked.text)
    if (!res) {
      try {
        const ui = useParserUIState.getState()
        ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
      } catch {
        void 0
      }
      return
    }

    try {
      const ui = useParserUIState.getState()
      if (res.input) {
        ui.setLastInput(res.input.name, res.input.text)
      }
      if (res.warnings && res.warnings.length > 0) {
        ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(res.warnings[0] || ''))
        ui.setWarnings(res.warnings)
      } else {
        ui.setDataLoadStatus(true, res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess)
        ui.setWarnings([])
      }
      if (res.counts) {
        ui.setCounts(res.counts)
      }
    } catch {
      void 0
    }

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
    try {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
    } catch {
      void 0
    }
  }
}
