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

const isCommentReferenceSemantic = (value: string) => {
  const parsed = parseMarkdownInlineCodeSemantic(value)
  return parsed?.kind === 'reference' && parsed.referenceKind === 'comment' ? parsed : null
}

const applyCommentRangeAttrs = (span: HTMLElement, args: { commentId: string; rawCode: string; text: string }) => {
  span.setAttribute('data-kg-comment', '1')
  span.setAttribute('data-kg-comment-range', '1')
  span.setAttribute('data-kg-comment-id', args.commentId)
  span.setAttribute('data-kg-comment-text', String(args.text || '').trim())
  span.setAttribute('data-kg-comment-raw-start', `\`${args.rawCode}\``)
  span.setAttribute('data-kg-comment-raw-end', `\`${args.rawCode}\``)
  span.setAttribute('role', 'note')
  span.setAttribute('tabindex', '0')
  span.setAttribute('aria-label', 'Comment range')
  span.setAttribute('title', String(args.text || '').trim() || 'Comment range')
  span.style.opacity = '0.95'
  span.style.cursor = 'pointer'
  span.style.textDecorationLine = 'underline'
  span.style.textDecorationStyle = 'dotted'
  span.style.textUnderlineOffset = '0.15em'
}

export const normalizeInlineCommentRangeIndicatorsInPlace = (root: HTMLElement, doc: Document = root.ownerDocument): void => {
  const parents = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[]
  parents.reverse().forEach(parent => {
    const childNodes = Array.from(parent.childNodes)
    for (let i = 0; i < childNodes.length; i += 1) {
      const startNode = childNodes[i]
      if (startNode?.nodeType !== Node.ELEMENT_NODE) continue
      const startElement = startNode as HTMLElement
      if (startElement.tagName.toLowerCase() !== 'code') continue
      const startSemantic = isCommentReferenceSemantic(String(startElement.textContent || ''))
      if (!startSemantic) continue
      const commentId = String(startSemantic.value || '').trim()
      if (!commentId) continue
      let endIndex = -1
      for (let j = i + 2; j < childNodes.length; j += 1) {
        const endNode = childNodes[j]
        if (endNode?.nodeType !== Node.ELEMENT_NODE) continue
        const endElement = endNode as HTMLElement
        if (endElement.tagName.toLowerCase() !== 'code') continue
        const endSemantic = isCommentReferenceSemantic(String(endElement.textContent || ''))
        if (!endSemantic) continue
        if (String(endSemantic.value || '').trim() !== commentId) continue
        endIndex = j
        break
      }
      if (endIndex < 0) continue
      const rangeSpan = doc.createElement('span')
      const wrappedNodes = childNodes.slice(i + 1, endIndex)
      wrappedNodes.forEach(node => rangeSpan.appendChild(node))
      applyCommentRangeAttrs(rangeSpan, {
        commentId,
        rawCode: startSemantic.code,
        text: String(rangeSpan.textContent || ''),
      })
      startElement.replaceWith(rangeSpan)
      childNodes[endIndex]?.remove()
      i = endIndex
    }
  })
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
  const commentRangeNodes = Array.from(root.querySelectorAll('[data-kg-comment-range="1"]')) as HTMLElement[]
  commentRangeNodes.forEach(node => {
    const rawStart = String(node.getAttribute('data-kg-comment-raw-start') || '').trim()
    const rawEnd = String(node.getAttribute('data-kg-comment-raw-end') || '').trim()
    if (!rawStart || !rawEnd) return
    node.before(doc.createTextNode(rawStart))
    node.after(doc.createTextNode(rawEnd))
    node.replaceWith(...Array.from(node.childNodes))
  })
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
  normalizeInlineCommentRangeIndicatorsInPlace(root, doc)
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
      Object.assign(span.style, readMarkdownSigilInlineStyle({
        text: parsed.displayText,
        color: parsed.color,
        background: parsed.background,
      }))
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
