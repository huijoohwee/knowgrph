import { coerceHttpUrl } from '@/lib/url'
import { parseHtmlToMarkdown, extractJsonLd } from '@/features/parsers/html-parser'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { deriveMarkdownNameFromUrl, fetchRemoteHtmlText as fetchRemoteHtmlTextUtil, promptForUrl } from './ingestUtils'
import { applyImportedMarkdownToStore } from '@/features/toolbar/importSideEffects'
import { runImportFlow } from '@/features/toolbar/importFlow'

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
        const text = await fetchRemoteHtmlTextUtil(url)
        if (!text) {
          try {
            const ui = useParserUIState.getState()
            ui.setDataLoadStatus(false, UI_COPY.htmlImportFetchFailedStatus(url))
          } catch {
            void 0
          }
          return null
        }
        return { name: url, displayName: deriveMarkdownNameFromUrl(url), text }
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

    await runImportFlow({
      nameForParse: picked.displayName || 'imported.md',
      textForParse: finalContent,
      openTab: 'curation',
      onSuccess: (res) => {
        if (!res.input || !res.input.text.trim()) return
        const name = res.input.name
        applyImportedMarkdownToStore({
          name,
          text: res.input.text,
          sourceUrl: type === 'url' ? picked.name : null,
          curationView: 'grid',
          recent: {
            name,
            path: type === 'local' ? picked.name : undefined,
            url: type === 'url' ? picked.name : undefined,
            type: 'html',
          },
        })
      },
    })
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
