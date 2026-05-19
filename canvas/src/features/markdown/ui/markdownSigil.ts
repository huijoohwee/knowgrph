import {
  buildMarkdownSigil,
  parseMarkdownSigil,
  readMarkdownSigilInlineStyle,
  unwrapDefaultHighlight,
} from '@/lib/markdown/markdownSigil'

export {
  buildMarkdownSigil,
  parseMarkdownSigil,
  readMarkdownSigilInlineStyle,
  unwrapDefaultHighlight,
}
export type { MarkdownAnnotation, MarkdownSigil } from '@/lib/markdown/markdownSigil'

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
    }
    if (parsed.background) {
      span.setAttribute('data-kg-sigil-bg', parsed.background)
    }
    Object.assign(span.style, readMarkdownSigilInlineStyle(parsed))
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
