export type MarkdownSigil = {
  text: string
  color: string | null
  background: string | null
}

const SIGIL_RE = /^(#[0-9a-fA-F]{6})?(\|?bg#[0-9a-fA-F]{6})?:(.+)$/
const HEX6_RE = /^#[0-9a-fA-F]{6}$/

const normalizeHex6 = (value: string): string | null => {
  const raw = String(value || '').trim()
  if (!HEX6_RE.test(raw)) return null
  return raw.toUpperCase()
}

export const parseMarkdownSigil = (rawCell: string): MarkdownSigil | null => {
  const trimmed = String(rawCell || '').trim()
  const unwrapped = trimmed.replace(/^`|`$/g, '')
  const normalized = unwrapped.replace(/\\\|/g, '|')
  const match = normalized.match(SIGIL_RE)
  if (!match) return null
  const color = normalizeHex6(String(match[1] || ''))
  const background = normalizeHex6(String(match[2] || '').replace('|bg#', '#').replace('bg#', '#'))
  return {
    text: String(match[3] || ''),
    color,
    background,
  }
}

export const buildMarkdownSigil = (args: {
  text: string
  color?: string | null
  background?: string | null
}): string => {
  const text = String(args.text || '')
  const color = normalizeHex6(String(args.color || ''))
  const background = normalizeHex6(String(args.background || ''))
  if (!color && !background) return text
  if (color && background) return `\`${color}|bg${background}:${text}\``
  if (color) return `\`${color}:${text}\``
  return `\`bg${background}:${text}\``
}

export const unwrapDefaultHighlight = (raw: string): { text: string; wrapped: boolean } => {
  const source = String(raw || '')
  const match = source.match(/^==([\s\S]+)==$/)
  if (!match) return { text: source, wrapped: false }
  return { text: String(match[1] || ''), wrapped: true }
}

export const rewriteSigilSpansToInlineCodeHtml = (html: string): string => {
  const raw = String(html || '')
  if (!raw.trim()) return raw
  if (typeof DOMParser === 'undefined') return raw
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  } catch {
    return raw
  }
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return raw
  const nodes = Array.from(root.querySelectorAll('[data-kg-sigil="1"]')) as HTMLElement[]
  if (nodes.length === 0) return raw

  for (const el of nodes) {
    const text = String(el.textContent || '')
    const color = el.getAttribute('data-kg-sigil-color')
    const background = el.getAttribute('data-kg-sigil-bg')
    const sigil = buildMarkdownSigil({ text, color, background })
    const codeText = sigil.startsWith('`') && sigil.endsWith('`') ? sigil.slice(1, -1) : sigil
    const code = doc.createElement('code')
    code.textContent = codeText
    el.replaceWith(code)
  }

  return root.innerHTML
}

export const rewriteInlineCodeSigilsToStyledSpansHtml = (html: string): string => {
  const raw = String(html || '')
  if (!raw.trim()) return raw
  if (typeof DOMParser === 'undefined') return raw
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  } catch {
    return raw
  }
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return raw
  const codeNodes = Array.from(root.querySelectorAll('code')) as HTMLElement[]
  if (codeNodes.length === 0) return raw

  for (const code of codeNodes) {
    const parsed = parseMarkdownSigil(String(code.textContent || ''))
    if (!parsed) continue
    const span = doc.createElement('span')
    span.setAttribute('data-kg-sigil', '1')
    if (parsed.color) {
      span.setAttribute('data-kg-sigil-color', parsed.color)
      span.style.color = parsed.color
    }
    if (parsed.background) {
      span.setAttribute('data-kg-sigil-bg', parsed.background)
      span.style.backgroundColor = parsed.background
    }
    span.textContent = parsed.text
    code.replaceWith(span)
  }

  return root.innerHTML
}

export const rewriteInlineCodeSigilsToPlainTextHtml = (html: string): string => {
  const raw = String(html || '')
  if (!raw.trim()) return raw
  if (typeof DOMParser === 'undefined') return raw
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  } catch {
    return raw
  }
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return raw
  const codeNodes = Array.from(root.querySelectorAll('code')) as HTMLElement[]
  if (codeNodes.length === 0) return raw

  for (const code of codeNodes) {
    const parsed = parseMarkdownSigil(String(code.textContent || ''))
    if (!parsed) continue
    const text = doc.createTextNode(parsed.text)
    code.replaceWith(text)
  }

  return root.innerHTML
}
