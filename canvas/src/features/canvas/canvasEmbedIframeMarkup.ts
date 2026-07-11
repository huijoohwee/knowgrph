const CANVAS_EMBED_TITLE = 'Knowgrph canvas'
const CANVAS_EMBED_SANDBOX = 'allow-scripts allow-same-origin'
const CANVAS_EMBED_STYLE = 'width:100%;min-height:640px;border:0;border-radius:16px'

const escapeHtmlAttribute = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

export function buildCanvasEmbedIframeMarkup(embedUrl: string): string | null {
  const value = String(embedUrl || '').trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  return [
    '<iframe',
    `  src="${escapeHtmlAttribute(url.toString())}"`,
    `  title="${CANVAS_EMBED_TITLE}"`,
    '  loading="lazy"',
    `  sandbox="${CANVAS_EMBED_SANDBOX}"`,
    '  referrerpolicy="no-referrer"',
    '  allow="fullscreen"',
    '  allowfullscreen',
    `  style="${CANVAS_EMBED_STYLE}"`,
    '></iframe>',
  ].join('\n')
}
