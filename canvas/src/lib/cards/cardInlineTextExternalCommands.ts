export type CardInlineTextExternalMediaCandidate = {
  kind: 'image' | 'audio' | 'video'
  url: string
  label: string
  thumbnailUrl?: string
  sourceKey?: string
}

export type CardInlineTextExternalCommandTarget = {
  id: string
  insertMedia: (candidate: CardInlineTextExternalMediaCandidate) => boolean
}

let activeCardInlineTextExternalTarget: CardInlineTextExternalCommandTarget | null = null

const normalizeText = (value: unknown): string => String(value || '').trim()

const escapeMarkdownAlt = (value: string): string =>
  value.replace(/[[\]\n\r]/g, ' ').trim()

const escapeAttribute = (value: string): string =>
  value.replace(/[\n\r<>]/g, ' ').replace(/"/g, '&quot;').trim()

export function buildCardInlineTextMediaEmbed(candidate: CardInlineTextExternalMediaCandidate): string {
  const url = normalizeText(candidate.url)
  const label = normalizeText(candidate.label || candidate.sourceKey)
  if (candidate.kind === 'image') {
    return `![${escapeMarkdownAlt(label || 'Image alt')}](${url || 'image-url'})`
  }
  const title = escapeAttribute(label)
  const titleAttr = title ? ` title="${title}"` : ''
  if (candidate.kind === 'audio') return `<audio src="${url || 'audio-url'}"${titleAttr} controls></audio>`
  const poster = normalizeText(candidate.thumbnailUrl)
  const posterAttr = poster ? ` poster="${escapeAttribute(poster)}"` : ''
  return `<video src="${url || 'video-url'}"${posterAttr}${titleAttr} controls></video>`
}

export function setActiveCardInlineTextExternalCommandTarget(target: CardInlineTextExternalCommandTarget | null): void {
  activeCardInlineTextExternalTarget = target
}

export function clearActiveCardInlineTextExternalCommandTarget(id: string): void {
  if (activeCardInlineTextExternalTarget?.id === id) activeCardInlineTextExternalTarget = null
}

export function insertMediaIntoActiveCardInlineTextEditor(candidate: CardInlineTextExternalMediaCandidate): boolean {
  return activeCardInlineTextExternalTarget?.insertMedia(candidate) === true
}
