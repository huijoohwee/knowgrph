import type {
  Token,
  TokensStrong,
  TokensEm,
  TokensDel,
  TokensSub,
  TokensSup,
  TokensMark,
  TokensLink,
  TokensCode,
  TokensBr,
  TokensImage,
  TokensHTML,
  TokensFootnoteRef,
} from './MarkdownTokens'
import {
  MdToken,
  getAttr,
  splitTextIntoTextAndMath,
} from './markdownPreviewLexUtils'

export const buildInlineTokens = (inlineChildren: MdToken[] | undefined): Token[] => {
  const children = Array.isArray(inlineChildren) ? inlineChildren : []
  const root: Token[] = []
  const stack: Array<{
    kind: 'strong' | 'em' | 'del' | 'link' | 'sub' | 'sup' | 'mark'
    token: TokensStrong | TokensEm | TokensDel | TokensLink | TokensSub | TokensSup | TokensMark
    children: Token[]
  }> = []

  const pushNode = (node: Token) => {
    const top = stack[stack.length - 1]
    if (top) {
      top.children.push(node)
    } else {
      root.push(node)
    }
  }

  const mergeSimpleHtmlSpanLike = (
    startIndex: number,
  ): { merged: TokensHTML | null; nextIndex: number } => {
    const start = children[startIndex]
    if (!start || start.type !== 'html_inline') {
      return { merged: null, nextIndex: startIndex }
    }
    const rawOpen = String(start.content || '')
    const trimmedOpen = rawOpen.trim().toLowerCase()
    const isAbbrOpen = trimmedOpen === '<abbr>' || trimmedOpen.startsWith('<abbr ')
    const isSpanOpen = trimmedOpen === '<span>' || trimmedOpen.startsWith('<span ')
    const isVClickOpen = trimmedOpen === '<v-click>' || trimmedOpen.startsWith('<v-click ')
    const isVMarkOpen = trimmedOpen === '<v-mark>' || trimmedOpen.startsWith('<v-mark ')
    if (!isAbbrOpen && !isSpanOpen && !isVClickOpen && !isVMarkOpen) {
      return { merged: null, nextIndex: startIndex }
    }
    const closingTag = isAbbrOpen ? '</abbr>' : isSpanOpen ? '</span>' : isVClickOpen ? '</v-click>' : '</v-mark>'
    let textContent = ''
    let endIndex = -1
    for (let i = startIndex + 1; i < children.length; i += 1) {
      const t = children[i]
      if (t.type === 'html_inline') {
        const raw = String(t.content || '')
        const trimmed = raw.trim().toLowerCase()
        if (trimmed === closingTag) {
          endIndex = i
          break
        }
        return { merged: null, nextIndex: startIndex }
      }
      if (t.type === 'text') {
        textContent += t.content
        continue
      }
      return { merged: null, nextIndex: startIndex }
    }
    if (endIndex < 0) {
      return { merged: null, nextIndex: startIndex }
    }
    const rawClose = String(children[endIndex].content || '')
    const fullRaw = `${rawOpen}${textContent}${rawClose}`
    const htmlTok: TokensHTML = {
      type: 'html',
      raw: fullRaw,
      text: fullRaw,
    }
    return { merged: htmlTok, nextIndex: endIndex }
  }

  for (let index = 0; index < children.length; index += 1) {
    const t = children[index]
    if (t.type === 'text') {
      const pieces = splitTextIntoTextAndMath(t.content)
      for (const piece of pieces) {
        pushNode(piece)
      }
      continue
    }
    if (t.type === 'code_inline') {
      const code: TokensCode = {
        type: 'code',
        raw: t.content,
        text: t.content,
      }
      pushNode(code)
      continue
    }
    if (t.type === 'softbreak' || t.type === 'hardbreak') {
      const br: TokensBr = {
        type: 'br',
        raw: '',
      }
      pushNode(br)
      continue
    }
    if (t.type === 'image') {
      const src = getAttr(t, 'src')
      const alt = getAttr(t, 'alt') || t.content
      const img: TokensImage = {
        type: 'image',
        raw: t.content,
        href: src,
        text: alt,
      }
      pushNode(img)
      continue
    }
    if (t.type === 'html_inline') {
      const merged = mergeSimpleHtmlSpanLike(index)
      if (merged.merged) {
        pushNode(merged.merged)
        index = merged.nextIndex
        continue
      }
      const raw = String(t.content || '')
      if (raw) {
        const htmlTok: TokensHTML = {
          type: 'html',
          raw,
          text: raw,
        }
        pushNode(htmlTok)
      }
      continue
    }
    if (t.type === 'strong_open' || t.type === 'em_open' || t.type === 's_open' || t.type === 'sub_open' || t.type === 'sup_open' || t.type === 'mark_open') {
      const kind = t.type === 'strong_open' ? 'strong' : t.type === 'em_open' ? 'em' : t.type === 's_open' ? 'del' : t.type === 'sub_open' ? 'sub' : t.type === 'sup_open' ? 'sup' : 'mark'
      const token =
        kind === 'strong'
          ? ({ type: 'strong', raw: '' } as TokensStrong)
          : kind === 'em'
          ? ({ type: 'em', raw: '' } as TokensEm)
          : kind === 'del'
          ? ({ type: 'del', raw: '' } as TokensDel)
          : kind === 'sub'
          ? ({ type: 'sub', raw: '' } as TokensSub)
          : kind === 'sup'
          ? ({ type: 'sup', raw: '' } as TokensSup)
          : ({ type: 'mark', raw: '' } as TokensMark)
      stack.push({ kind, token, children: [] })
      continue
    }
    if (t.type === 'strong_close' || t.type === 'em_close' || t.type === 's_close' || t.type === 'sub_close' || t.type === 'sup_close' || t.type === 'mark_close') {
      const kind = t.type === 'strong_close' ? 'strong' : t.type === 'em_close' ? 'em' : t.type === 's_close' ? 'del' : t.type === 'sub_close' ? 'sub' : t.type === 'sup_close' ? 'sup' : 'mark'
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].kind === kind) {
          const frame = stack.splice(i, 1)[0]
          ;(frame.token as { tokens?: Token[] }).tokens = frame.children
          pushNode(frame.token as Token)
          break
        }
      }
      continue
    }
    if (t.type === 'footnote_ref') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (t as any).meta || {}
      const id = Number(meta.id)
      const label = String(meta.label || '')
      const caption = String(meta.caption || '')
      const ref: TokensFootnoteRef = {
        type: 'footnote_ref',
        id,
        label,
        caption,
        raw: t.content,
      }
      pushNode(ref)
      continue
    }
    if (t.type === 'link_open') {
      const href = getAttr(t, 'href')
      const link: TokensLink = {
        type: 'link',
        raw: '',
        href,
        tokens: [],
      }
      stack.push({ kind: 'link', token: link, children: [] })
      continue
    }
    if (t.type === 'link_close') {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].kind === 'link') {
          const frame = stack.splice(i, 1)[0]
          frame.token.tokens = frame.children
          pushNode(frame.token as Token)
          break
        }
      }
      continue
    }
  }

  return root
}

export const buildInlineTokensWithText = (
  inlineChildren: MdToken[] | undefined,
): { tokens: Token[]; text: string } => {
  const tokens = buildInlineTokens(inlineChildren)
  const text = tokens
    .map(tt => (tt as { text?: string }).text || '')
    .join('')
  return { tokens, text }
}
