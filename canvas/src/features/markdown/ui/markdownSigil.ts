import {
  buildMarkdownSigil,
  parseMarkdownInlineCodeSemantic,
  parseMarkdownSigil,
  readMarkdownSigilInlineStyle,
  unwrapDefaultHighlight,
} from '@/lib/markdown/markdownSigil'

export {
  buildMarkdownSigil,
  parseMarkdownInlineCodeSemantic,
  parseMarkdownSigil,
  readMarkdownSigilInlineStyle,
  unwrapDefaultHighlight,
}
export type { MarkdownAnnotation, MarkdownInlineCodeSemantic, MarkdownSigil } from '@/lib/markdown/markdownSigil'

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
  const nodes = Array.from(root.querySelectorAll('[data-kg-sigil="1"],[data-kg-inline-code-token="1"]')) as HTMLElement[]
  if (nodes.length === 0) return raw

  for (const el of nodes) {
    const nestedInlineCodeNodes = Array.from(el.querySelectorAll('[data-kg-inline-code-token="1"]')) as HTMLElement[]
    nestedInlineCodeNodes.reverse().forEach(node => {
      const rawToken = String(node.getAttribute('data-kg-inline-code-raw') || '').trim()
      if (!rawToken) return
      node.replaceWith(doc.createTextNode(rawToken))
    })
    const inlineCodeRaw = String(el.getAttribute('data-kg-inline-code-raw') || '').trim()
    if (inlineCodeRaw) {
      const code = doc.createElement('code')
      code.textContent = inlineCodeRaw
      el.replaceWith(code)
      continue
    }
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
    const parsed = parseMarkdownInlineCodeSemantic(String(code.textContent || ''))
    if (!parsed) continue
    const span = doc.createElement('span')
    span.setAttribute('data-kg-inline-code-token', '1')
    span.setAttribute('data-kg-inline-code-kind', parsed.kind)
    if (parsed.kind === 'annotation') {
      span.setAttribute('data-kg-sigil', '1')
      if (parsed.color) {
        span.setAttribute('data-kg-sigil-color', parsed.color)
      }
      if (parsed.background) {
        span.setAttribute('data-kg-sigil-bg', parsed.background)
      }
      Object.assign(span.style, readMarkdownSigilInlineStyle(parsed))
      span.textContent = parsed.displayText
    } else {
      span.setAttribute('data-kg-inline-code-raw', parsed.code)
      span.setAttribute('data-kg-inline-code-badge', parsed.badgeLabel)
      span.style.borderRadius = '0.375rem'
      span.style.padding = '0 0.35em'
      span.style.border = '1px solid rgba(148, 163, 184, 0.45)'
      span.style.backgroundColor = 'rgba(148, 163, 184, 0.10)'
      span.style.color = 'inherit'
      span.style.fontFamily = 'inherit'
      const leftTick = doc.createElement('span')
      leftTick.setAttribute('data-kg-inline-code-affix', 'left')
      leftTick.setAttribute('aria-hidden', 'true')
      leftTick.style.fontSize = '0'
      leftTick.style.lineHeight = '0'
      leftTick.style.opacity = '0'
      leftTick.style.pointerEvents = 'none'
      leftTick.textContent = '`'
      const text = doc.createElement('span')
      text.setAttribute('data-kg-inline-code-text', '1')
      text.textContent = parsed.code
      const rightTick = doc.createElement('span')
      rightTick.setAttribute('data-kg-inline-code-affix', 'right')
      rightTick.setAttribute('aria-hidden', 'true')
      rightTick.style.fontSize = '0'
      rightTick.style.lineHeight = '0'
      rightTick.style.opacity = '0'
      rightTick.style.pointerEvents = 'none'
      rightTick.textContent = '`'
      span.append(leftTick, text, rightTick)
    }
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
    const parsed = parseMarkdownInlineCodeSemantic(String(code.textContent || ''))
    if (!parsed) continue
    const text = doc.createTextNode(parsed.displayText)
    code.replaceWith(text)
  }

  return root.innerHTML
}
