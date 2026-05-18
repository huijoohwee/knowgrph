import type { JSONValue } from '@/lib/graph/types'
import { fetchYouTubeTranscriptConversion } from '@/lib/net/youtubeTranscriptConversion'

export type YouTubeTranscriptMarkdownResult =
  | {
      markdown: string
      displayName: string
      transcriptJsonText: string | null
      transcript: Record<string, JSONValue> | null
      sourceUrl: string
    }
  | { error: string }

export async function fetchYouTubeTranscriptMarkdown(args: {
  url: string
  lang?: string
}): Promise<YouTubeTranscriptMarkdownResult | null> {
  const converted = await fetchYouTubeTranscriptConversion(args.url, { lang: args.lang })
  if (!converted) return null
  if (converted.ok === false) return { error: converted.error }
  return {
    markdown: converted.markdown,
    displayName: converted.name,
    transcriptJsonText: converted.transcriptJsonText,
    transcript: converted.transcript,
    sourceUrl: converted.sourceUrl,
  }
}
