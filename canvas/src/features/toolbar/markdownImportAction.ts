import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { parseHtmlToMarkdown } from '@/features/parsers/html-parser'
import { coerceHttpUrl } from '@/lib/url'
import {
  fetchRemoteMarkdownText,
  promptForUrl,
  deriveMarkdownNameFromUrl,
  isMarkdownUrlPath,
} from './ingestUtils'

export type MarkdownImportType = 'url' | 'local'

export async function performMarkdownImport(type: MarkdownImportType, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; text: string; displayName?: string } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.markdownImportUrlPrompt) || ''
        })()
        if (!rawUrl) return null
        return fetchRemoteMarkdownText(rawUrl)
      }
      if (type === 'local') {
        return pickTextFileWithExtensions(['.md', '.markdown'])
      }
      return null
    })()

    if (!picked) return

    const text = (() => {
      const raw = String(picked.text || '')
      const trimmed = raw.trim().toLowerCase()
      const looksHtml =
        trimmed.startsWith('<!doctype html') ||
        trimmed.startsWith('<html') ||
        (trimmed.includes('<html') && trimmed.includes('</html>'))
      if (!looksHtml) return raw
      const baseUrl = coerceHttpUrl(picked.name) || undefined
      return parseHtmlToMarkdown(raw, baseUrl)
    })()

    const res = await loadGraphDataFromTextViaParser(picked.name, text)
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
        const rawName = String(res.input.name || '')
        const isHttp = /^https?:\/\//i.test(rawName)
        if (isHttp && isMarkdownUrlPath(rawName)) {
          const baseName = deriveMarkdownNameFromUrl(rawName)
          state.setJsonSourceDocument(baseName, null)
          state.setMarkdownDocument(baseName, res.input.text)
          state.setMarkdownDocumentSourceUrl(rawName)
          state.addRecentFile({
            name: baseName,
            url: rawName,
            type: 'url',
          })
        } else {
          const name = res.input.name
          state.setJsonSourceDocument(name, null)
          state.setMarkdownDocument(name, res.input.text)
          state.addRecentFile({
            name,
            path: type === 'local' ? name : undefined,
            url: type === 'url' ? name : undefined,
            type: 'markdown',
          })
        }
        state.setBottomPanelCurationView('markdown')
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
