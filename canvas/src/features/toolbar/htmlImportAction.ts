import { coerceHttpUrl } from '@/lib/url'
import { parseHtmlToMarkdown, extractJsonLd } from '@/features/parsers/html-parser'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { fetchRemoteHtmlText as fetchRemoteHtmlTextUtil, promptForUrl } from './ingestUtils'

export const fetchRemoteHtmlText = fetchRemoteHtmlTextUtil

export type HtmlImportType = 'url' | 'local'

export async function performHtmlImport(type: HtmlImportType, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string; displayName?: string } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.htmlImportUrlPrompt) || ''
        })()
        const url = coerceHttpUrl(rawUrl)
        if (!url) return null
        const text = await fetchRemoteHtmlText(url)
        if (!text) {
          try {
            const ui = useParserUIState.getState()
            ui.setDataLoadStatus(false, UI_COPY.htmlImportFetchFailedStatus(url))
          } catch {
            void 0
          }
          return null
        }
        return { name: url, displayName: url, text }
      }
      if (type === 'local') {
        return pickTextFileWithExtensions(['.html', '.htm'])
      }
      return null
    })()
    
    if (!picked) return

    const baseUrl = (() => {
      const fromName = coerceHttpUrl(picked.name)
      if (fromName) return fromName
      const fromDisplay = picked.displayName ? coerceHttpUrl(picked.displayName) : null
      return fromDisplay || undefined
    })()
    const markdown = parseHtmlToMarkdown(picked.text, baseUrl)
    const jsonLd = extractJsonLd(picked.text)
    
    let finalContent = markdown
    if (!finalContent.trim() && (!jsonLd || jsonLd.length === 0)) {
      finalContent = UI_COPY.htmlImportEmptyMarkdown
    }

    if (jsonLd && jsonLd.length > 0) {
      finalContent += '\n\n# Extracted JSON-LD\n\n```json\n' + JSON.stringify(jsonLd, null, 2) + '\n```\n'
    }

    const res = await loadGraphDataFromTextViaParser(picked.displayName || 'imported.md', finalContent)
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
        state.setMarkdownDocument(res.input.name, res.input.text)
        state.setBottomPanelCurationView('grid')
      }
    } catch {
      void 0
    }
    openBottomPanel('curation')
  } catch {
    try {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.parserDataLoadFailed)
    } catch {
      void 0
    }
  }
}
