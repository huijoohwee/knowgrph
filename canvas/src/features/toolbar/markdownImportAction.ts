import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { UI_COPY } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { parseHtmlToMarkdown } from '@/features/parsers/html-parser'
import { coerceHttpUrl } from '@/lib/url'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { applyImportedMarkdownToStore } from '@/features/toolbar/importSideEffects'
import {
  fetchRemoteMarkdownText,
  promptForUrl,
  deriveMarkdownNameFromUrl,
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

    const nameForParse = picked.displayName || picked.name
    const res = await loadGraphDataFromTextViaParser(nameForParse, text)
    applyLoaderResultToParserUi(res)
    if (!res) return

    try {
      if (res.input && res.input.text.trim()) {
        const rawSourceName = String(picked.name || '')
        const isHttp = /^https?:\/\//i.test(rawSourceName)
        if (isHttp) {
          const baseName = deriveMarkdownNameFromUrl(rawSourceName)
          applyImportedMarkdownToStore({
            name: baseName,
            text: res.input.text,
            sourceUrl: rawSourceName,
            curationView: 'markdown',
            recent: { name: baseName, url: rawSourceName, type: 'url' },
          })
        } else {
          const name = res.input.name
          applyImportedMarkdownToStore({
            name,
            text: res.input.text,
            sourceUrl: null,
            curationView: 'markdown',
            recent: {
              name,
              path: type === 'local' ? picked.name : undefined,
              type: 'markdown',
            },
          })
        }
      }
    } catch {
      void 0
    }
    openBottomPanel('curation')
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
