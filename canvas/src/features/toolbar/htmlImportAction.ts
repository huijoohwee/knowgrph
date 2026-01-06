import { coerceHttpUrl } from './markdownImport'
import { parseHtmlToMarkdown, extractJsonLd } from '@/features/parsers/html-parser'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY, looksLikeViteDevIndexHtml } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'

export async function fetchRemoteHtmlText(rawUrl: string): Promise<string | null> {
  const proxyUrl = `/__fetch_remote?url=${encodeURIComponent(rawUrl)}`
  const shouldPreferProxy = (() => {
    try {
      const u = new URL(rawUrl)
      if (!/^https?:$/.test(u.protocol)) return false
      if (typeof window === 'undefined') return true
      return u.origin !== window.location.origin
    } catch {
      return true
    }
  })()

  const attempt = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const text = await res.text()
      if (looksLikeViteDevIndexHtml(text)) return null
      return text
    } catch {
      return null
    }
  }

  if (shouldPreferProxy) {
    const viaProxy = await attempt(proxyUrl)
    if (viaProxy !== null) return viaProxy
    return attempt(rawUrl)
  }

  const direct = await attempt(rawUrl)
  if (direct !== null) return direct
  return attempt(proxyUrl)
}

export type HtmlImportType = 'url' | 'local'

export async function performHtmlImport(type: HtmlImportType, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string; displayName?: string } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return typeof window !== 'undefined'
            ? String(window.prompt(UI_COPY.htmlImportUrlPrompt, '') || '').trim()
            : ''
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

    const markdown = parseHtmlToMarkdown(picked.text)
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
