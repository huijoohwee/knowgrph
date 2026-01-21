import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { promptForUrl } from './ingestUtils'

export type YouTubeImportType = 'url'

type YouTubeMarkdownConversionResult =
  | { markdown: string; displayName: string; transcriptJsonText: string | null }
  | { error: string }

async function convertYouTubeUrlToMarkdown(rawUrl: string): Promise<YouTubeMarkdownConversionResult | null> {
  if (!rawUrl) return null
  try {
    const res = await fetch(`/__youtube_transcript?url=${encodeURIComponent(rawUrl)}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    })
    const json = (await res.json()) as {
      ok?: unknown
      markdown?: unknown
      error?: unknown
      name?: unknown
      transcript?: unknown
    }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube-transcript.md'
      const transcriptJsonText = (() => {
        if (!json.transcript || typeof json.transcript !== 'object' || Array.isArray(json.transcript)) return null
        try {
          return JSON.stringify(json.transcript, null, 2)
        } catch {
          return null
        }
      })()
      return { markdown: json.markdown, displayName: name, transcriptJsonText }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'YouTube conversion failed' }
  } catch {
    return null
  }
}

export async function performYouTubeImport(type: YouTubeImportType, providedUrlOrId?: string) {
  if (type !== 'url') return
  const raw = (() => {
    const v = typeof providedUrlOrId === 'string' ? providedUrlOrId.trim() : ''
    if (v) return v
    return promptForUrl(UI_COPY.youtubeImportUrlPrompt) || ''
  })()
  if (!raw) return

  try {
    const converted = await convertYouTubeUrlToMarkdown(raw)
    if (!converted) {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.youtubeImportFetchFailedStatus(raw))
      return
    }
    if ('error' in converted) {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.youtubeImportConvertFailedStatusWithError(converted.error))
      return
    }

    const res = await loadGraphDataFromTextViaParser(converted.displayName, converted.markdown)
    if (!res) {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.youtubeImportConvertFailedStatusWithError(UI_COPY.parserDataLoadFailed))
      return
    }

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
      if (res.counts) ui.setCounts(res.counts)
    }

    const state = useGraphStore.getState()
    if (res.input && res.input.text.trim()) {
      const name = res.input.name
      state.setMarkdownDocument(name, res.input.text)
      state.setMarkdownDocumentSourceUrl(raw)
      state.setJsonSourceDocument(name, converted.transcriptJsonText)
      state.setBottomPanelCurationView('markdown')
      state.addRecentFile({
        name,
        url: raw,
        type: 'markdown',
      })
    }
    openBottomPanel('curation')
  } catch {
    const ui = useParserUIState.getState()
    ui.setDataLoadStatus(false, UI_COPY.youtubeImportConvertFailedStatusWithError(UI_COPY.parserDataLoadFailed))
  }
}
