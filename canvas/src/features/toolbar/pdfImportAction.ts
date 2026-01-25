import { coerceHttpUrl } from '@/lib/url'
import { UI_COPY } from '@/lib/config'
import { pickFileWithExtensions } from '@/lib/graph/filePicker'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { deriveMarkdownNameFromPdfFilename, promptForUrl } from './ingestUtils'
import { applyImportedMarkdownToStore } from '@/features/toolbar/importSideEffects'
import { runImportFlow } from '@/features/toolbar/importFlow'

type PdfMarkdownConversionOk = { markdown: string; displayName: string }
type PdfMarkdownConversionResult = PdfMarkdownConversionOk | { error: string }

async function convertPdfUrlToMarkdown(rawUrl: string): Promise<PdfMarkdownConversionResult | null> {
  const url = coerceHttpUrl(rawUrl)
  if (!url) return null
  try {
    const res = await fetch(`/__convert_pdf?url=${encodeURIComponent(url)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const fallbackName = (() => {
        try {
          const u = new URL(url)
          const parts = u.pathname.split('/').filter(Boolean)
          const last = parts[parts.length - 1] || ''
          return deriveMarkdownNameFromPdfFilename(last)
        } catch {
          return 'document.md'
        }
      })()
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : fallbackName
      return { markdown: json.markdown, displayName: name }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'PDF conversion failed' }
  } catch {
    return null
  }
}

async function convertPdfFileToMarkdown(file: File): Promise<PdfMarkdownConversionResult | null> {
  try {
    const buf = await file.arrayBuffer()
    const res = await fetch('/__convert_pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        Accept: 'application/json',
        'X-Import-Filename': file.name || '',
      },
      body: buf,
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : deriveMarkdownNameFromPdfFilename(file.name)
      return { markdown: json.markdown, displayName: name }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'PDF conversion failed' }
  } catch {
    return null
  }
}

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
        if ('error' in converted) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatusWithError(converted.error) })
          return null
        }
        return { name: converted.displayName, markdown: converted.markdown, sourceUrl: url }
      }
      if (type === 'local') {
        const file = await pickFileWithExtensions(['.pdf'])
        if (!file) return null
        const converted = await convertPdfFileToMarkdown(file)
        if (!converted) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatus })
          return null
        }
        if ('error' in converted) {
          applyLoaderResultToParserUi(null, { failureLabelOverride: UI_COPY.pdfImportConvertFailedStatusWithError(converted.error) })
          return null
        }
        return { name: converted.displayName, markdown: converted.markdown, sourceUrl: null }
      }
      return null
    })()

    if (!picked) return

    await runImportFlow({
      nameForParse: picked.name,
      textForParse: picked.markdown,
      openTab: 'curation',
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
