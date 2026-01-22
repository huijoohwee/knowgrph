import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { useParserUIState } from '@/features/parsers/uiState'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { unwrapUserProvidedText } from '@/lib/url'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { slugify } from '@/features/parsers/markdownJsonLd'

export type YouTubeImportType = 'url'

type YouTubeMarkdownConversionResult =
  | {
      markdown: string
      displayName: string
      transcriptJsonText: string | null
      transcript: Record<string, JSONValue> | null
      sourceUrl: string
    }
  | { error: string }

function buildYouTubeTranscriptGraphData(transcript: Record<string, JSONValue>): GraphData {
  const videoId = typeof transcript.video_id === 'string' ? transcript.video_id.trim() : ''
  const sourceUrl = typeof transcript.source_url === 'string' ? transcript.source_url.trim() : ''
  const title = typeof transcript.title === 'string' ? transcript.title.trim() : ''

  const id = (() => {
    if (videoId) return `youtube:${videoId}`
    if (sourceUrl) return `youtube:${slugify(sourceUrl)}`
    return `youtube:${slugify(JSON.stringify(transcript).slice(0, 2000))}`
  })()

  const node: GraphNode = {
    id,
    label: title || (videoId ? `YouTube Transcript: ${videoId}` : 'YouTube Transcript'),
    type: 'YouTubeTranscript',
    properties: transcript,
  }

  return {
    type: 'application/vnd.knowgrph.graph+json',
    nodes: [node],
    edges: [],
    metadata: {
      sourceDocument: {
        type: 'rag:YouTubeTranscript',
        video_id: videoId,
        source_url: sourceUrl,
      },
    },
  }
}

async function convertYouTubeUrlToMarkdown(rawUrl: string, opts?: { lang?: string }): Promise<YouTubeMarkdownConversionResult | null> {
  if (!rawUrl) return null
  try {
    const cleaned = unwrapUserProvidedText(rawUrl) || rawUrl
    const lang = typeof opts?.lang === 'string' ? opts.lang.trim() : ''
    const qs = new URLSearchParams({ url: cleaned })
    if (lang && lang !== 'en') qs.set('lang', lang)
    const res = await fetch(`/__youtube_transcript?${qs.toString()}`, {
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
      const sourceUrl = (() => {
        if (!json.transcript || typeof json.transcript !== 'object' || Array.isArray(json.transcript)) return rawUrl
        const tr = json.transcript as Record<string, unknown>
        const s1 = typeof tr.source_url === 'string' ? tr.source_url.trim() : ''
        if (s1) return s1
        return rawUrl
      })()
      const transcriptJsonText = (() => {
        if (!json.transcript || typeof json.transcript !== 'object' || Array.isArray(json.transcript)) return null
        try {
          return JSON.stringify(json.transcript, null, 2)
        } catch {
          return null
        }
      })()
      const transcript = (() => {
        if (!transcriptJsonText) return null
        try {
          const parsed = JSON.parse(transcriptJsonText) as JSONValue
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
          return parsed as Record<string, JSONValue>
        } catch {
          return null
        }
      })()
      return { markdown: json.markdown, displayName: name, transcriptJsonText, transcript, sourceUrl }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { error: err }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { error: 'YouTube conversion failed' }
  } catch {
    return null
  }
}

export async function performYouTubeImport(type: YouTubeImportType, providedUrlOrId?: string, lang?: string) {
  if (type !== 'url') return
  const raw = typeof providedUrlOrId === 'string' ? providedUrlOrId.trim() : ''
  if (!raw) return
  const cleaned = unwrapUserProvidedText(raw) || raw
  if (!cleaned) return

  try {
    const normalizedLang = typeof lang === 'string' ? lang.trim() : ''
    const converted = await convertYouTubeUrlToMarkdown(cleaned, { lang: normalizedLang || undefined })
    if (!converted) {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.youtubeImportFetchFailedStatus(cleaned))
      return
    }
    if ('error' in converted) {
      const ui = useParserUIState.getState()
      ui.setDataLoadStatus(false, UI_COPY.youtubeImportConvertFailedStatusWithError(converted.error))
      return
    }

    const res = await (async () => {
      if (converted.transcript) {
        const graphData = buildYouTubeTranscriptGraphData(converted.transcript)
        const jsonText = JSON.stringify(graphData, null, 2)
        const base = converted.displayName.replace(/\.(md|markdown)$/i, '') || converted.displayName
        return loadGraphDataFromTextViaParser(`${base}.json`, jsonText)
      }
      return loadGraphDataFromTextViaParser(converted.displayName, converted.markdown)
    })()
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
    state.setMarkdownDocument(converted.displayName, converted.markdown)
    state.setMarkdownDocumentSourceUrl(converted.sourceUrl)
    state.setJsonSourceDocument(converted.displayName, converted.transcriptJsonText)
    state.setBottomPanelCurationView('markdown')
    state.addRecentFile({
      name: converted.displayName,
      url: converted.sourceUrl,
      type: 'markdown',
    })
    openBottomPanel('curation')
  } catch (error) {
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error || '')
    const ui = useParserUIState.getState()
    ui.setDataLoadStatus(
      false,
      UI_COPY.youtubeImportConvertFailedStatusWithError(msg.trim() ? msg.trim() : UI_COPY.parserDataLoadFailed),
    )
  }
}
