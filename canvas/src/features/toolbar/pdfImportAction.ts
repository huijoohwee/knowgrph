import { coerceHttpUrl } from '@/lib/url'
import { UI_COPY } from '@/lib/config'
import { pickFileWithExtensions } from '@/lib/graph/filePicker'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { promptForUrl } from './ingestUtils'
import { applyImportedMarkdownToStore } from '@/features/toolbar/importSideEffects'
import { runImportFlow } from '@/features/toolbar/importFlow'
import { convertPdfFileToMarkdown, convertPdfUrlToMarkdown } from '@/lib/net/remoteMarkdownConversions'

export type PdfImportType = 'url' | 'local'

export async function performPdfImport(type: PdfImportType, providedUrl?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; markdown: string; sourceUrl: string | null } | null> => {
      if (type === 'url') {
        const rawUrl = (() => {
          const v = typeof providedUrl === 'string' ? providedUrl.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.pdfImportUrlPrompt) || ''
        })()
        const url = coerceHttpUrl(rawUrl)
        if (!url) return null
        const converted = await convertPdfUrlToMarkdown(url)
        if (!converted) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportFetchFailedStatus(url) })
          return null
        }
        if (converted.ok === false) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatusWithError(converted.error) })
          return null
        }
        return { name: converted.name, markdown: converted.markdown, sourceUrl: url }
      }
      if (type === 'local') {
        const file = await pickFileWithExtensions(['.pdf'])
        if (!file) return null
        const converted = await convertPdfFileToMarkdown(file)
        if (!converted) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatus })
          return null
        }
        if (converted.ok === false) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatusWithError(converted.error) })
          return null
        }
        return { name: converted.name, markdown: converted.markdown, sourceUrl: null }
      }
      return null
    })()

    if (!picked) return

    await runImportFlow({
      nameForParse: picked.name,
      textForParse: picked.markdown,
      openWorkspaceViewMode: 'table',
      onSuccess: (res) => {
        if (!res.input || !res.input.text.trim()) return
        const name = res.input.name
        applyImportedMarkdownToStore({
          name,
          text: res.input.text,
          sourceUrl: picked.sourceUrl,
          curationView: 'grid',
          recent: {
            name,
            url: type === 'url' ? (picked.sourceUrl || undefined) : undefined,
            type: 'markdown',
          },
        })
      },
    })
  } catch {
    applyLoaderResultToParserUi(null)
  }
}
