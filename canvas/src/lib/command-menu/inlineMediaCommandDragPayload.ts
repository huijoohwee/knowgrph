import { buildInlineMediaEmbed, type InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

const normalizeText = (value: unknown): string => String(value || '').trim()

export function buildInlineMediaCommandDragPayload(candidate: InlineMediaCommandCandidate): MediaDragPayload | null {
  const kind = candidate.kind
  const url = normalizeText(candidate.url)
  if ((kind !== 'image' && kind !== 'audio' && kind !== 'video') || !url) return null
  return {
    kind,
    url,
    label: normalizeText(candidate.label) || kind,
    thumbnailUrl: normalizeText(candidate.thumbnailUrl) || undefined,
    sourceKey: normalizeText(candidate.sourceKey) || candidate.id,
  }
}

export function buildInlineMediaCommandChipMarkdown(candidate: InlineMediaCommandCandidate): string {
  return buildInlineMediaEmbed({
    kind: candidate.kind,
    url: normalizeText(candidate.url),
    thumbnailUrl: normalizeText(candidate.thumbnailUrl) || undefined,
    label: normalizeText(candidate.label) || candidate.kind,
    sourceKey: normalizeText(candidate.sourceKey) || undefined,
  })
}
