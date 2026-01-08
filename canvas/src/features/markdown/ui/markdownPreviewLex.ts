import MarkdownIt from 'markdown-it'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'
import type {
  Token,
  ListItemToken,
  TokensStrong,
  TokensEm,
  TokensDel,
  TokensLink,
  TokensText,
  TokensCode,
  TokensBr,
  TokensImage,
  TokensHeading,
  TokensParagraph,
  TokensHr,
  TokensHTML,
  TokensBlockquote,
  TokensList,
  TokensTable,
} from './MarkdownTokens'

export type TokenWithLines = Token & {
  startLine: number
  endLine: number
}

type MdToken = {
  type: string
  tag: string
  content: string
  map?: [number, number]
  children?: MdToken[]
  attrs?: [string, string][]
  info?: string
}

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
})

export const addLineRangesToTokens = (tokens: Token[], lineOffset: number): TokenWithLines[] => {
  const out: TokenWithLines[] = []
  let cursorLine = 1
  for (const t of tokens) {
    const raw = String((t as unknown as { raw?: unknown }).raw || '')
    const startLine = cursorLine + lineOffset
    const lineCount = raw ? raw.split('\n').length : 0
    const endLine = Math.max(startLine, startLine + Math.max(0, lineCount - 1))
    out.push(Object.assign({}, t, { startLine, endLine }) as TokenWithLines)
    cursorLine += Math.max(0, lineCount - 1)
  }
  return out
}

const getAttr = (token: MdToken, name: string): string => {
  const list = token.attrs || []
  for (const [k, v] of list) {
    if (k === name) return v
  }
  return ''
}

const buildInlineTokens = (inlineChildren: MdToken[] | undefined): Token[] => {
  const children = Array.isArray(inlineChildren) ? inlineChildren : []
  const root: Token[] = []
  const stack: Array<{
    kind: 'strong' | 'em' | 'del' | 'link'
    token: TokensStrong | TokensEm | TokensDel | TokensLink
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

  for (const t of children) {
    if (t.type === 'text') {
      const text: TokensText = {
        type: 'text',
        raw: t.content,
        text: t.content,
      }
      pushNode(text)
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
    if (t.type === 'strong_open' || t.type === 'em_open' || t.type === 's_open') {
      const kind = t.type === 'strong_open' ? 'strong' : t.type === 'em_open' ? 'em' : 'del'
      const token =
        kind === 'strong'
          ? ({ type: 'strong', raw: '' } as TokensStrong)
          : kind === 'em'
          ? ({ type: 'em', raw: '' } as TokensEm)
          : ({ type: 'del', raw: '' } as TokensDel)
      stack.push({ kind, token, children: [] })
      continue
    }
    if (t.type === 'strong_close' || t.type === 'em_close' || t.type === 's_close') {
      const kind = t.type === 'strong_close' ? 'strong' : t.type === 'em_close' ? 'em' : 'del'
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

const mapLines = (tok: MdToken, lineOffset: number): { startLine: number; endLine: number } => {
  const map = tok.map
  if (!map) {
    const base = lineOffset + 1
    return { startLine: base, endLine: base }
  }
  const startLine = lineOffset + map[0] + 1
  const endLine = lineOffset + map[1]
  return { startLine, endLine: Math.max(startLine, endLine) }
}

const buildBlockTokens = (mdTokens: MdToken[], lineOffset: number, srcLines: string[]): TokenWithLines[] => {
  const out: TokenWithLines[] = []
  let i = 0
  while (i < mdTokens.length) {
    const t = mdTokens[i]
    if (t.type === 'heading_open') {
      const inlineTok = mdTokens[i + 1]
      const closeTok = mdTokens[i + 2]
      const depth = Number.parseInt(t.tag.replace(/^h/i, ''), 10) || 1
      const inlineTokens = inlineTok && inlineTok.type === 'inline' ? buildInlineTokens(inlineTok.children) : []
      const text = inlineTokens
        .map(tt => (tt as { text?: string }).text || '')
        .join('')
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const h: TokensHeading = {
        type: 'heading',
        raw,
        depth,
        text,
        tokens: inlineTokens,
      }
      out.push(Object.assign({}, h, { startLine, endLine }) as TokenWithLines)
      i += closeTok && closeTok.type === 'heading_close' ? 3 : 1
      continue
    }
    if (t.type === 'paragraph_open') {
      const inlineTok = mdTokens[i + 1]
      const closeTok = mdTokens[i + 2]
      const inlineTokens = inlineTok && inlineTok.type === 'inline' ? buildInlineTokens(inlineTok.children) : []
      const text = inlineTokens
        .map(tt => (tt as { text?: string }).text || '')
        .join('')
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const p: TokensParagraph = {
        type: 'paragraph',
        raw,
        text,
        tokens: inlineTokens,
      }
      out.push(Object.assign({}, p, { startLine, endLine }) as TokenWithLines)
      i += closeTok && closeTok.type === 'paragraph_close' ? 3 : 1
      continue
    }
    if (t.type === 'fence' || t.type === 'code_block') {
      const info = t.info || ''
      const lang = info.split(/\s+/)[0] || ''
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const c: TokensCode = {
        type: 'code',
        raw,
        text: t.content,
        lang: lang || undefined,
      }
      out.push(Object.assign({}, c, { startLine, endLine }) as TokenWithLines)
      i += 1
      continue
    }
    if (t.type === 'hr') {
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const hr: TokensHr = {
        type: 'hr',
        raw,
      }
      out.push(Object.assign({}, hr, { startLine, endLine }) as TokenWithLines)
      i += 1
      continue
    }
    if (t.type === 'html_block') {
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n') || t.content
      const h: TokensHTML = {
        type: 'html',
        raw,
        text: raw,
      }
      out.push(Object.assign({}, h, { startLine, endLine }) as TokenWithLines)
      i += 1
      continue
    }
    if (t.type === 'blockquote_open') {
      const open = t
      const { startLine, endLine } = mapLines(open, lineOffset)
      const map = open.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      let j = i + 1
      while (j < mdTokens.length && mdTokens[j].type !== 'blockquote_close') j += 1
      const bq: TokensBlockquote = {
        type: 'blockquote',
        raw,
        tokens: [],
      }
      out.push(Object.assign({}, bq, { startLine, endLine }) as TokenWithLines)
      i = j + 1
      continue
    }
    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
      const open = t
      const ordered = t.type === 'ordered_list_open'
      const { startLine, endLine } = mapLines(open, lineOffset)
      const map = open.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const items: TokensList['items'] = []
      let j = i + 1
      while (j < mdTokens.length) {
        const cur = mdTokens[j]
        if (cur.type === 'bullet_list_close' || cur.type === 'ordered_list_close') {
          break
        }
        if (cur.type !== 'list_item_open') {
          j += 1
          continue
        }
        const itemMap = cur.map || map
        const itemLines = srcLines.slice(itemMap[0], itemMap[1])
        const itemRaw = itemLines.join('\n')
        let k = j + 1
        let inlineTokens: Token[] = []
        while (k < mdTokens.length && mdTokens[k].type !== 'list_item_close') {
          const tk = mdTokens[k]
          if (tk.type === 'paragraph_open') {
            const inlineTok = mdTokens[k + 1]
            if (inlineTok && inlineTok.type === 'inline') {
              inlineTokens = buildInlineTokens(inlineTok.children)
            }
          }
          k += 1
        }
        const firstText = inlineTokens.find(tt => (tt as { type?: string }).type === 'text') as
          | TokensText
          | undefined
        let task = false
        let checked = false
        if (firstText && typeof firstText.text === 'string') {
          const m = firstText.text.match(/^\s*\[([ xX])]\s+(.*)$/)
          if (m) {
            task = true
            checked = m[1].toLowerCase() === 'x'
            firstText.text = m[2]
            firstText.raw = firstText.text
          }
        }
        const para: TokensParagraph = {
          type: 'paragraph',
          raw: itemRaw,
          tokens: inlineTokens,
          text: inlineTokens
            .map(tt => (tt as { text?: string }).text || '')
            .join(''),
        }
        const listItem: ListItemToken = {
          task,
          checked,
          tokens: [para as Token],
        }
        items.push(listItem)
        j = k + 1
      }
        const list: TokensList = {
        type: 'list',
        raw,
        ordered,
        items,
      }
      out.push(Object.assign({}, list, { startLine, endLine }) as TokenWithLines)
      while (j < mdTokens.length && mdTokens[j].type !== 'bullet_list_close' && mdTokens[j].type !== 'ordered_list_close') {
        j += 1
      }
      i = j + 1
      continue
    }
    if (t.type === 'table_open') {
      const open = t
      const { startLine, endLine } = mapLines(open, lineOffset)
      const map = open.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const header: TokensTable['header'] = []
      const rows: TokensTable['rows'] = []
      let j = i + 1
      while (j < mdTokens.length && mdTokens[j].type !== 'thead_open') j += 1
      if (j < mdTokens.length && mdTokens[j].type === 'thead_open') {
        j += 1
        while (j < mdTokens.length && mdTokens[j].type !== 'thead_close') {
          if (mdTokens[j].type === 'tr_open') {
            j += 1
            const headCells: TokensTable['header'] = []
            while (j < mdTokens.length && mdTokens[j].type !== 'tr_close') {
              if (mdTokens[j].type === 'th_open') {
                const inlineTok = mdTokens[j + 1]
                const inlineTokens = inlineTok && inlineTok.type === 'inline' ? buildInlineTokens(inlineTok.children) : []
                const cellText = inlineTokens
                  .map(tt => (tt as { text?: string }).text || '')
                  .join('')
                headCells.push({
                  text: cellText,
                  tokens: inlineTokens,
                })
                while (j < mdTokens.length && mdTokens[j].type !== 'th_close') j += 1
              }
              j += 1
            }
            header.push(...headCells)
          } else {
            j += 1
          }
        }
      }
      while (j < mdTokens.length && mdTokens[j].type !== 'tbody_open') j += 1
      if (j < mdTokens.length && mdTokens[j].type === 'tbody_open') {
        j += 1
        while (j < mdTokens.length && mdTokens[j].type !== 'tbody_close') {
          if (mdTokens[j].type === 'tr_open') {
            j += 1
            const rowCells: TokensTable['header'] = []
            while (j < mdTokens.length && mdTokens[j].type !== 'tr_close') {
              if (mdTokens[j].type === 'td_open') {
                const inlineTok = mdTokens[j + 1]
                const inlineTokens =
                  inlineTok && inlineTok.type === 'inline' ? buildInlineTokens(inlineTok.children) : []
                const cellText = inlineTokens
                  .map(tt => (tt as { text?: string }).text || '')
                  .join('')
                rowCells.push({
                  text: cellText,
                  tokens: inlineTokens,
                })
                while (j < mdTokens.length && mdTokens[j].type !== 'td_close') j += 1
              }
              j += 1
            }
            if (rowCells.length) rows.push(rowCells)
          } else {
            j += 1
          }
        }
      }
      const table: TokensTable = {
        type: 'table',
        raw,
        header,
        rows,
      }
      out.push(Object.assign({}, table, { startLine, endLine }) as TokenWithLines)
      while (j < mdTokens.length && mdTokens[j].type !== 'table_close') j += 1
      i = j + 1
      continue
    }
    if (t.type === 'inline') {
      i += 1
      continue
    }
    i += 1
  }
  return out
}

export const lexMarkdown = (
  markdownText: string,
): { tokens: TokenWithLines[]; startLineOffset: number; meta: MarkdownFrontmatter } => {
  const lines = splitMarkdownLines(markdownText)
  const { startIndex, meta } = parseMarkdownFrontmatter(lines)
  const content = lines.slice(startIndex).join('\n')
  const { tokens } = lexMarkdownContent(content, startIndex)
  return { tokens, startLineOffset: startIndex, meta }
}

export const lexMarkdownContent = (
  markdownText: string,
  lineOffset: number,
): { tokens: TokenWithLines[] } => {
  const content = String(markdownText || '')
  const srcLines = splitMarkdownLines(content)
  const mdTokens = md.parse(content, {}) as unknown as MdToken[]
  const tokens = buildBlockTokens(mdTokens, lineOffset, srcLines)
  return { tokens }
}
