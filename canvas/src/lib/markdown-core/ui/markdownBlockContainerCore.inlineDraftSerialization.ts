import { restoreInlineMediaEditTokensInPlace } from './markdownBlockContainerCore.inlineMediaEditHtml'

export const readFastInlineMarkdownDraft = (
  root: HTMLElement | null,
  htmlRenderMode: 'block' | 'inline',
): string | null => {
  if (!root || htmlRenderMode !== 'inline') return null
  const workingRoot = root.cloneNode(true) as HTMLElement
  restoreInlineMediaEditTokensInPlace(workingRoot)
  const serializeChildren = (node: Node): string | null => {
    let out = ''
    const children = Array.from(node.childNodes)
    for (let i = 0; i < children.length; i += 1) {
      const next = serializeNode(children[i]!)
      if (next == null) return null
      out += next
    }
    return out
  }
  const serializeNode = (node: Node): string | null => {
    if (node.nodeType === 3) return String((node as Text).nodeValue || '').replace(/\r/g, '')
    if (node.nodeType === 8) return `<!--${String((node as Comment).nodeValue || '')}-->`
    if (node.nodeType !== 1) return ''
    const element = node as HTMLElement
    const tag = String(element.tagName || '').toLowerCase()
    if (tag === 'br') return '\n'
    if (tag === 'u') {
      const inner = serializeChildren(element)
      return inner == null ? null : `<u>${inner}</u>`
    }
    if (tag === 'mark' || element.hasAttribute('data-kg-default-highlight')) {
      const inner = serializeChildren(element)
      return inner == null ? null : `==${inner}==`
    }
    if (tag === 'strong' || tag === 'b') {
      const inner = serializeChildren(element)
      return inner == null ? null : `**${inner}**`
    }
    if (tag === 'em' || tag === 'i') {
      const inner = serializeChildren(element)
      return inner == null ? null : `_${inner}_`
    }
    if (tag === 's' || tag === 'strike' || tag === 'del') {
      const inner = serializeChildren(element)
      return inner == null ? null : `~~${inner}~~`
    }
    if (tag === 'code') {
      const code = String(element.textContent || '').replace(/\r/g, '')
      return code.includes('`') ? null : `\`${code}\``
    }
    if (tag === 'span') {
      if (element.hasAttribute('data-kg-comment')) {
        if (element.getAttribute('data-kg-comment-range') === '1') return null
        const raw = String(element.getAttribute('data-kg-comment-raw') || '').replace(/\r/g, '').trim()
        if (raw) return raw
      }
      if (
        element.hasAttribute('data-kg-sigil')
        || element.hasAttribute('data-kg-inline-code-token')
        || element.hasAttribute('data-kg-footnote-ref')
        || element.hasAttribute('data-kg-sigil-color')
        || element.hasAttribute('data-kg-sigil-bg')
        || String(element.getAttribute('style') || '').trim().length > 0
      ) {
        return null
      }
      return serializeChildren(element)
    }
    if (tag === 'a') {
      const href = String(element.getAttribute('href') || '').trim()
      if (!href) return serializeChildren(element)
      const label = serializeChildren(element)
      return label == null ? null : `[${label}](${href})`
    }
    if (tag === 'div' || tag === 'p' || tag === 'section') {
      const inner = serializeChildren(element)
      return inner == null ? null : `${inner}\n`
    }
    return null
  }
  const markdown = serializeChildren(workingRoot)
  return typeof markdown === 'string' ? markdown.replace(/\n+$/g, '') : null
}
