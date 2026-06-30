import { fetchYouTubeTranscriptConversion } from '@/lib/net/youtubeTranscriptConversion'

type FetchResponseStub = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const buildSyntheticYouTubeId = (seed: string): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  let out = ''
  for (let i = 0; i < 11; i += 1) {
    hash ^= i + 0x9e3779b9
    hash = Math.imul(hash, 0x85ebca6b) >>> 0
    out += alphabet[hash % alphabet.length] || 'A'
  }
  return out
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
    if (!first.markdown.includes(`[![Cached Transcript](https://i.ytimg.com/vi/${fakeId}/hqdefault.jpg)](https://youtu.be/${fakeId})`)) {
      throw new Error('expected markdown to include a linked YouTube thumbnail image')
    }
    const cached = await fetchYouTubeTranscriptConversion(watchUrl)
    if (!cached || cached.ok !== true) throw new Error('expected cached YouTube conversion result')
    if (fetchCount !== 1) throw new Error(`expected cached YouTube request count to stay one, got ${fetchCount}`)
  } finally {
    g.fetch = prevFetch
  }
}

export async function testYouTubeTranscriptConversionRewritesStandaloneShortUrlToThumbnailImage() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  const fakeId = 'q1w2e3R4t5Y'
  const watchUrl = `https://www.youtube.com/watch?v=${fakeId}&t=2178`
  const shortUrl = `https://youtu.be/${fakeId}?t=2178`
  const frameUrl = '/image/video-frame/20260630T000000Z/frame-test-t2178.png'
  let transcriptFetchCount = 0
  let frameFetchCount = 0
  const transcript = {
    ok: true,
    title: 'Timestamped Transcript',
    video_id: fakeId,
    source_url: watchUrl,
    segment_count: 1,
    segments: [
      { text: 'Timestamped line.', start: 2178, duration: 1 },
    ],
  }

  g.fetch = (async (input: unknown) => {
    const requestUrl = String(input || '')
    if (requestUrl.startsWith('/__video_frame')) {
      frameFetchCount += 1
      const response: FetchResponseStub = {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          imageUrl: frameUrl,
          publicUrl: frameUrl,
          semanticKey: 'rich-media-preview:test-frame',
          cached: false,
          bytes: 1234,
          timeSeconds: 2178,
          format: 'png',
        }),
      }
      return response as unknown as Response
    }
    transcriptFetchCount += 1
    const response: FetchResponseStub = {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        name: `youtube-${fakeId}.md`,
        markdown: `# Timestamped Transcript\n\n${shortUrl};\n\nTimestamped line.\n`,
        transcript,
      }),
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const result = await fetchYouTubeTranscriptConversion(watchUrl)
    if (transcriptFetchCount !== 1) throw new Error(`expected one YouTube request, got ${transcriptFetchCount}`)
    if (frameFetchCount !== 1) throw new Error(`expected one timestamp frame request, got ${frameFetchCount}`)
    if (!result || result.ok !== true) throw new Error('expected YouTube conversion result')
    const expectedImage = `[![Timestamped Transcript](${frameUrl})](${shortUrl})`
    if (!result.markdown.includes(expectedImage)) {
      throw new Error(`expected standalone YouTube URL to become a linked thumbnail image, got:\n${result.markdown}`)
    }
    if (result.markdown.includes(`\n${shortUrl};\n`)) {
      throw new Error('expected stale standalone YouTube URL line to be replaced')
    }
    if (!result.markdown.includes('Timestamped line.')) {
      throw new Error('expected transcript text to remain after replacing the source URL line')
    }
  } finally {
    g.fetch = prevFetch
  }
}

export async function testYouTubeTranscriptConversionPreservesTimestampRowsAsMarkdownLinks() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  const fakeId = buildSyntheticYouTubeId('timestamp rows before thumbnail insertion')
  const watchUrl = `https://www.youtube.com/watch?v=${fakeId}`
  const shortUrl = `https://youtu.be/${fakeId}?t=421`
  let fetchCount = 0
  const transcript = {
    ok: true,
    title: 'Timestamped Transcript',
    video_id: fakeId,
    source_url: watchUrl,
    segment_count: 1,
    segments: [
      { text: 'event transcript segment,', start: 421, duration: 3 },
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
        markdown: [
          '# Timestamped Transcript',
          '',
          shortUrl,
          'event transcript segment,',
          '',
        ].join('\n'),
        transcript,
      }),
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const result = await fetchYouTubeTranscriptConversion(watchUrl)
    if (fetchCount !== 1) throw new Error(`expected one YouTube request, got ${fetchCount}`)
    if (!result || result.ok !== true) throw new Error('expected YouTube conversion result')
    if (!result.markdown.includes(`[7:01](${shortUrl}) event transcript segment,`)) {
      throw new Error(`expected transcript URL row to become a timestamp Markdown link, got:\n${result.markdown}`)
    }
    if (result.markdown.includes(`\n${shortUrl}\nevent transcript segment,`)) {
      throw new Error('expected raw timestamp URL row to be removed before thumbnail insertion')
    }
    if (!result.markdown.includes(`[![Timestamped Transcript](https://i.ytimg.com/vi/${fakeId}/hqdefault.jpg)](${watchUrl})`)) {
      throw new Error(`expected thumbnail insertion to preserve source link separately, got:\n${result.markdown}`)
    }
  } finally {
    g.fetch = prevFetch
  }
}

export async function testYouTubeTranscriptConversionRewritesGenericThumbnailAltFromTranscriptContext() {
  const g = globalThis as unknown as { fetch?: unknown }
  const prevFetch = g.fetch
  const fakeId = 'aBcD123xYz9'
  const watchUrl = `https://www.youtube.com/watch?v=${fakeId}`
  const shortUrl = `https://youtu.be/${fakeId}?t=421`
  const thumbnailUrl = `https://img.youtube.com/vi/${fakeId}/maxresdefault.jpg`
  let fetchCount = 0
  const transcript = {
    ok: true,
    title: `YouTube Transcript: ${fakeId}`,
    video_id: fakeId,
    source_url: watchUrl,
    segment_count: 1,
    segments: [
      { text: 'segment from transcript context,', start: 421, duration: 4 },
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
        markdown: [
          `# YouTube Transcript: ${fakeId}`,
          '',
          `![Thumbnail](${thumbnailUrl})`,
          '',
          shortUrl,
          'segment from transcript context,',
          '',
        ].join('\n'),
        transcript,
      }),
    }
    return response as unknown as Response
  }) as unknown as typeof fetch

  try {
    const result = await fetchYouTubeTranscriptConversion(watchUrl)
    if (fetchCount !== 1) throw new Error(`expected one YouTube request, got ${fetchCount}`)
    if (!result || result.ok !== true) throw new Error('expected YouTube conversion result')
    const expectedAlt = 'YouTube thumbnail: segment from transcript context at 7:01'
    if (!result.markdown.includes(`![${expectedAlt}](${thumbnailUrl})`)) {
      throw new Error(`expected generic thumbnail alt to be semantic, got:\n${result.markdown}`)
    }
    if (result.markdown.includes('![Thumbnail](')) {
      throw new Error('expected generic thumbnail alt to be removed')
    }
    if (!result.markdown.includes(`[7:01](${shortUrl}) segment from transcript context,`)) {
      throw new Error(`expected transcript timestamp URL row to become a semantic timestamp link, got:\n${result.markdown}`)
    }
    if (result.markdown.includes(`\n${shortUrl}\n`)) {
      throw new Error('expected raw transcript timestamp URL row to be removed')
    }
  } finally {
    g.fetch = prevFetch
  }
}
