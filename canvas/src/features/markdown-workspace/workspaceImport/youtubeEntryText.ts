import type { RemoteMarkdownConversionOk } from '@/lib/net/remoteMarkdownConversions'
import { getYouTubeId } from 'grph-shared/rich-media/providers'
import { yamlQuote } from './yaml'

export function buildYouTubeWorkspaceEntryText(args: {
  normalizedUrl: string
  converted: Pick<RemoteMarkdownConversionOk, 'markdown' | 'transcriptJsonText'>
  viewHint?: 'markdown' | 'json' | 'html'
}): string {
  const videoId = getYouTubeId(args.normalizedUrl)
  const format = args.viewHint === 'json' && args.converted.transcriptJsonText ? 'json' : 'markdown'
  const frontmatter = videoId
    ? `---\nkgYoutubeVideoId: ${yamlQuote(videoId)}\nkgYoutubeFormat: ${yamlQuote(format)}\n---\n\n`
    : ''
  const body =
    format === 'json' && args.converted.transcriptJsonText
      ? `\`\`\`json\n${args.converted.transcriptJsonText}\n\`\`\`\n`
      : String(args.converted.markdown || '')
  return `${frontmatter}${body}`
}
