import type {
  Token,
  ListItemToken,
  TokensText,
  TokensCode,
  TokensHeading,
  TokensParagraph,
  TokensHr,
  TokensHTML,
  TokensBlockquote,
  TokensList,
  TokensTable,
  TokensFootnoteBlock,
} from './MarkdownTokens'
import {
  MdToken,
  TokenWithLines,
  getAttr,
  mapLines,
} from './markdownPreviewLexUtils'
import {
  buildInlineTokens,
  buildInlineTokensWithText,
} from './markdownPreviewLexInline'

export const buildBlockTokens = (mdTokens: MdToken[], lineOffset: number, srcLines: string[]): TokenWithLines[] => {
  const out: TokenWithLines[] = []
  let i = 0
  while (i < mdTokens.length) {
    const t = mdTokens[i]
    if (t.type === 'heading_open') {
      const inlineTok = mdTokens[i + 1]
      const closeTok = mdTokens[i + 2]
      const depth = Number.parseInt(t.tag.replace(/^h/i, ''), 10) || 1
      const inlineChildren = inlineTok && inlineTok.type === 'inline' ? inlineTok.children : undefined
      const { tokens: inlineTokens, text } = buildInlineTokensWithText(inlineChildren)
      const { startLine, endLine } = mapLines(t, lineOffset)
      const map = t.map || [0, 0]
      const raw = srcLines.slice(map[0], map[1]).join('\n')
      const h: TokensHeading = {
        type: 'heading',
        raw,
        depth,
        id: getAttr(t, 'id'),
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
      const inlineChildren = inlineTok && inlineTok.type === 'inline' ? inlineTok.children : undefined
      const { tokens: inlineTokens, text } = buildInlineTokensWithText(inlineChildren)
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
        info,
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
        const para: TokensParagraph & { startLine?: number; endLine?: number } = {
          type: 'paragraph',
          raw: itemRaw,
          tokens: inlineTokens,
          text: inlineTokens
            .map(tt => (tt as { text?: string }).text || '')
            .join(''),
        }
        if (itemMap) {
          const itemStart = lineOffset + itemMap[0] + 1
          const itemEnd = lineOffset + itemMap[1]
          para.startLine = itemStart
          para.endLine = itemEnd
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
                const inlineChildren = inlineTok && inlineTok.type === 'inline' ? inlineTok.children : undefined
                const { tokens: inlineTokens, text: cellText } = buildInlineTokensWithText(inlineChildren)
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
                const inlineChildren = inlineTok && inlineTok.type === 'inline' ? inlineTok.children : undefined
                const { tokens: inlineTokens, text: cellText } = buildInlineTokensWithText(inlineChildren)
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
    if (t.type === 'footnote_block_open') {
      const { startLine, endLine } = mapLines(t, lineOffset)
      const items: TokensFootnoteBlock['items'] = []
      let j = i + 1
      while (j < mdTokens.length && mdTokens[j].type !== 'footnote_block_close') {
        if (mdTokens[j].type === 'footnote_open') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta = (mdTokens[j] as any).meta || {}
          const itemLabel = meta.label || String(meta.id || '')
          j += 1
          const itemTokens: Token[] = []
          while (j < mdTokens.length && mdTokens[j].type !== 'footnote_close') {
            if (mdTokens[j].type === 'paragraph_open') {
              const inlineTok = mdTokens[j + 1]
              if (inlineTok && inlineTok.type === 'inline') {
                const { tokens } = buildInlineTokensWithText(inlineTok.children)
                itemTokens.push(...tokens)
              }
            }
            j += 1
          }
          items.push({ label: itemLabel, tokens: itemTokens })
        }
        j += 1
      }
      const fb: TokensFootnoteBlock = {
        type: 'footnote_block',
        items,
        raw: '',
      }
      out.push(Object.assign({}, fb, { startLine, endLine }) as TokenWithLines)
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
