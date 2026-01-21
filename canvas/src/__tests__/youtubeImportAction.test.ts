import { performYouTubeImport } from '@/features/toolbar/youtubeImportAction'
import { useGraphStore } from '@/hooks/useGraphStore'

type FetchResponseStub = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export async function testYouTubeImportPopulatesMarkdownAndJsonEditors() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch

  const fakeId = 'a1b2c3d4e5F'
  const transcript = {
    ok: true,
    type: 'rag:YouTubeTranscript',
    videoId: fakeId,
    url: `https://www.youtube.com/watch?v=${fakeId}`,
    languageCode: 'en',
    language: 'English',
    isGenerated: true,
    snippets: [
      { text: 'Hello there.', start: 0.0, duration: 1.0 },
      { text: 'General Kenobi.', start: 1.1, duration: 1.2 },
    ],
  }

  const markdown = `# YouTube Transcript: ${fakeId}\n\nSource: ${transcript.url}\n\nHello there.\n\nGeneral Kenobi.\n`

  g.fetch = (async (input: unknown) => {
    const url = typeof input === 'string' ? input : ''
    if (!url.includes('/__youtube_transcript')) {
      throw new Error(`Unexpected fetch url: ${url}`)
    }
    const response: FetchResponseStub = {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, markdown, name: `youtube-${fakeId}.md`, transcript }),
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  const state = useGraphStore.getState()
  state.setMarkdownDocument(null, null)
  state.setJsonSourceDocument(null, null)
  state.setMarkdownDocumentSourceUrl(null)
  state.setBottomPanelCurationView('grid')

  try {
    await performYouTubeImport('url', fakeId)
  } finally {
    g.fetch = prevFetch
  }

  const next = useGraphStore.getState()
  if (next.bottomPanelCurationView !== 'markdown') {
    throw new Error(`Expected bottomPanelCurationView=markdown, got ${String(next.bottomPanelCurationView)}`)
  }
  if (!next.markdownDocumentText || !next.markdownDocumentText.includes(`YouTube Transcript: ${fakeId}`)) {
    throw new Error('Expected markdownDocumentText to be populated with transcript markdown')
  }
  if (!next.jsonSourceDocumentText) {
    throw new Error('Expected jsonSourceDocumentText to be populated with transcript JSON')
  }
  try {
    const parsed = JSON.parse(next.jsonSourceDocumentText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Transcript JSON did not parse to an object')
    }
  } catch (e) {
    throw new Error(`Transcript JSON invalid: ${String(e)}`)
  }
}

