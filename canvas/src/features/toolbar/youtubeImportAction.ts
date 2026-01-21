import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { promptForUrl } from './ingestUtils'

type YouTubeMarkdownConversionOk = { markdown: string; displayName: string; sourceUrl: string }
type YouTubeMarkdownConversionResult = YouTubeMarkdownConversionOk | { error: string }

async function convertYouTubeToMarkdown(rawUrlOrId: string): Promise<YouTubeMarkdownConversionResult | null> {
  const input = String(rawUrlOrId || '').trim()
  if (!input) return null
  try {
    const res = await fetch(`/__youtube_transcript?url=${encodeURIComponent(input)}`, {
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
      sourceUrl?: unknown
    }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const name = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : 'youtube.md'
      const sourceUrl =
        typeof json.sourceUrl === 'string' && json.sourceUrl.trim()
          ? json.sourceUrl.trim()
          : input
      return { markdown: json.markdown, displayName: name, sourceUrl }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'YouTube transcript conversion failed' }
  } catch {
    return null
  }
}

export type YouTubeImportType = 'url'

export async function performYouTubeImport(type: YouTubeImportType, providedUrlOrId?: string) {
  try {
    const picked = await (async (): Promise<{ name: string; markdown: string; sourceUrl: string } | null> => {
      if (type === 'url') {
        const raw = (() => {
          const v = typeof providedUrlOrId === 'string' ? providedUrlOrId.trim() : ''
          if (v) return v
          return promptForUrl(UI_COPY.youtubeImportUrlPrompt) || ''
        })()
        if (!raw) return null
        const converted = await convertYouTubeToMarkdown(raw)
        if (!converted) {
          try {
            const ui = useParserUIState.getState()
            ui.setDataLoadStatus(false, UI_COPY.youtubeImportFetchFailedStatus(raw))
          } catch {
            void 0
          }
          return null
        }
        if ('error' in converted) {
          try {
            const ui = useParserUIState.getState()
            ui.setDataLoadStatus(false, UI_COPY.youtubeImportConvertFailedStatusWithError(converted.error))
          } catch {
            void 0
          }
          return null
        }
        return { name: converted.displayName, markdown: converted.markdown, sourceUrl: converted.sourceUrl }
      }
      return null
    })()

    if (!picked) return

    const res = await loadGraphDataFromTextViaParser(picked.name, picked.markdown)
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
        if (res.counts) {
          ui.setCounts(res.counts)
        }
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
        state.setMarkdownDocumentSourceUrl(picked.sourceUrl)
        state.setBottomPanelCurationView('grid')
        state.addRecentFile({
          name,
          url: picked.sourceUrl,
          type: 'markdown',
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

