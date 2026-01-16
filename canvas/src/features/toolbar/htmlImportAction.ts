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

    const res = await loadGraphDataFromTextViaParser(
      picked.displayName || 'imported.md',
      finalContent,
    )
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
      const warnings = res.warnings || []
      const counts = res.counts
      const nodeCount = counts ? Number(counts.n || 0) : 0
      const edgeCount = counts ? Number(counts.e || 0) : 0
      const hasGraph = nodeCount > 0 || edgeCount > 0
      if (warnings.length > 0 && !hasGraph) {
        ui.setDataLoadStatus(false, UI_COPY.parserDataLoadSyntaxErrorStatus(warnings[0] || ''))
      } else {
        ui.setDataLoadStatus(
          true,
          res.input && res.input.name ? res.input.name : UI_COPY.parserDataLoadSuccess,
        )
        // Auto-close panels on success to show canvas
        const store = useGraphStore.getState()
        try {
          // Force close by setting ratio to minimal or using collapse logic if available
          // We can't access setCollapsed directly, but we can set ratio small or close sidebar
          store.setSidebarOpen(false)
          // To "close" bottom panel, we can try setting a different tab or just relying on sidebar closure if that was the intent
          // But user said "do not auto open Sidebar, or other panels".
          // If we just don't open it, it should be fine. 
          // But if it was open, we might want to close it? 
          // Let's assume we just ensure sidebar is closed.
          // For bottom panel, we can use the persisted key hack
          try {
             if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('knowgrph:bottom-panel-collapsed', 'true')
                // Dispatch event to notify components listening to storage? 
                // Or just force re-render?
                // The BottomPanel listens to storage key? Yes, usePersistedBoolean.
                window.dispatchEvent(new StorageEvent('storage', { key: 'knowgrph:bottom-panel-collapsed', newValue: 'true' }))
             }
          } catch { void 0 }
        } catch { void 0 }
      }
      ui.setWarnings(warnings)
      if (counts) {
        ui.setCounts(counts)
      }
    } catch {
      void 0
    }
    try {
      const state = useGraphStore.getState()
      if (res.input && res.input.text.trim()) {
        const name = res.input.name
        state.setJsonSourceDocument(name, null)
        state.setMarkdownDocument(name, res.input.text)
        state.setBottomPanelCurationView('grid')
        state.addRecentFile({
          name: name,
          path: type === 'local' ? picked.name : undefined,
          url: type === 'url' ? picked.name : undefined,
          type: 'html',
        })
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
