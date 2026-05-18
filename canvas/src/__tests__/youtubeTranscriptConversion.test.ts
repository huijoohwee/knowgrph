import { fetchYouTubeTranscriptConversion } from '@/lib/net/youtubeTranscriptConversion'

type FetchResponseStub = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export async function testYouTubeTranscriptConversionCachesInflightAndDerivesTranscriptJson() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  const fakeId = 'z9y8x7w6v5U'
  const watchUrl = `https://www.youtube.com/watch?v=${fakeId}`
  let fetchCount = 0
  const transcript = {
    ok: true,
    title: 'Cached Transcript',
    video_id: fakeId,
    source_url: `https://youtu.be/${fakeId}`,
    segment_count: 2,
    segments: [
      { text: 'One.', start: 0, duration: 1 },
      { text: 'Two.', start: 1, duration: 1 },
    ],
  }

  g.fetch = (async () => {
    fetchCount += 1
    const response: FetchResponseStub = {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        name: `youtube-${fakeId}.md`,
        markdown: '# Cached Transcript\n\nOne.\n\nTwo.\n',
        transcript,
      }),
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const [first, second] = await Promise.all([
      fetchYouTubeTranscriptConversion(watchUrl),
      fetchYouTubeTranscriptConversion(watchUrl),
    ])
    if (fetchCount !== 1) throw new Error(`expected one in-flight YouTube request, got ${fetchCount}`)
    if (!first || first.ok !== true) throw new Error('expected first YouTube conversion result')
    if (!second || second.ok !== true) throw new Error('expected second YouTube conversion result')
    if (!first.transcriptJsonText) throw new Error('expected transcriptJsonText derived from transcript object')
    const parsed = JSON.parse(first.transcriptJsonText) as Record<string, unknown>
    if (parsed.video_id !== fakeId) throw new Error('expected derived transcript JSON to preserve video_id')
    if (first.sourceUrl !== `https://youtu.be/${fakeId}`) throw new Error('expected sourceUrl from transcript')
    const cached = await fetchYouTubeTranscriptConversion(watchUrl)
    if (!cached || cached.ok !== true) throw new Error('expected cached YouTube conversion result')
    if (fetchCount !== 1) throw new Error(`expected cached YouTube request count to stay one, got ${fetchCount}`)
  } finally {
    g.fetch = prevFetch
  }
}
