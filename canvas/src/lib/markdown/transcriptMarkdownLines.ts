const TRANSCRIPT_TAIL_STARTER_RX =
  /\s+(?=(?:First,|Now\b|Next,|Then\b|Let me\b|Actually,|But wait\b|Wait,|Good\.|Interesting\.))/gu

const TRANSCRIPT_SECTION_LABEL_RX =
  /([a-z0-9)])\s+(?=(?:Goldman Sachs|UBS|Shared blind spot|Conclusion|Result):)/gu

function countInlineTranscriptOrderedMarkers(text: string): number {
  return (String(text || '').match(/(?:^|[^\d])\d+\.\s/gu) || []).length
}

function countInlineTranscriptBulletMarkers(text: string): number {
  return (String(text || '').match(/\s-\s+/gu) || []).length
}

function hasMarkdownLinkOrImage(text: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)/u.test(String(text || ''))
}

function splitInlineTranscriptNarrativeTails(text: string): string {
  const raw = String(text || '')
  if (!raw) return raw
  if (hasMarkdownLinkOrImage(raw)) return raw
  const orderedMarkerCount = countInlineTranscriptOrderedMarkers(raw)
  const bulletMarkerCount = countInlineTranscriptBulletMarkers(raw)
  const startsAsListItem = /^\s*(?:[-*+]\s+|\d+\.\s+)/u.test(raw)
  const hasInlineTranscriptContext = startsAsListItem || orderedMarkerCount >= 2 || bulletMarkerCount >= 2
  if (!hasInlineTranscriptContext) return raw
  return raw
    .replace(TRANSCRIPT_TAIL_STARTER_RX, '\n')
    .replace(TRANSCRIPT_SECTION_LABEL_RX, '$1\n')
}

export function expandInlineTranscriptMarkdownLines(line: string): string[] {
  let text = splitInlineTranscriptNarrativeTails(String(line || '').trim())
  if (!text) return []
  const containsMarkdownLinkOrImage = hasMarkdownLinkOrImage(text)
  const orderedMarkerCount = countInlineTranscriptOrderedMarkers(text)
  if (!containsMarkdownLinkOrImage && (orderedMarkerCount >= 2 || /:\s+\d+\.\s/u.test(text))) {
    text = text.replace(/([^\n])\s+(?=\d+\.\s)/gu, '$1\n')
  }
  const bulletMarkerCount = countInlineTranscriptBulletMarkers(text)
  if (!containsMarkdownLinkOrImage && (bulletMarkerCount >= 2 || /:\s+-\s/u.test(text))) {
    text = text.replace(/([^\n])\s+(?=-\s+)/gu, '$1\n')
  }
  return text
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)
}
