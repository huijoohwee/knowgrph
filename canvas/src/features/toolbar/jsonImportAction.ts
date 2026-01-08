import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { fetchRemoteText, promptForUrl } from './ingestUtils'

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

