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
  TokensCallout,
} from './MarkdownTokens'
import {
  MdToken,
  TokenWithLines,
  getAttr,
  mapLines,
} from './markdownPreviewLexUtils'
import {
  buildInlineTokensWithText,
} from './markdownPreviewLexInline'
import { slugify } from 'grph-shared/markdown/slugify'

const maybeExtractTrailingBlockId = (tokens: Token[], paragraphText: string): { tokens: Token[]; text: string } => {
  if (!tokens.length) return { tokens, text: paragraphText }
  const last = tokens[tokens.length - 1] as unknown as { type?: unknown; text?: unknown; raw?: unknown }
  if (last.type !== 'text') return { tokens, text: paragraphText }
  const rawText = String(last.text || '')
  const m = rawText.match(/^(.*?)(?:\s+)?\^([A-Za-z0-9][A-Za-z0-9_-]{0,127})\s*$/)
  if (!m) return { tokens, text: paragraphText }
  const before = String(m[1] || '').replace(/\s+$/g, '')
  const blockId = String(m[2] || '').trim()
  if (!blockId) return { tokens, text: paragraphText }
  const anchorId = `^${blockId}`

  const nextTokens = tokens.slice(0, -1)
  if (before) {
    const nextText: TokensText = { type: 'text', raw: before, text: before }
    nextTokens.push(nextText)
  }
  const html: TokensHTML = {
    type: 'html',
    raw: `<a id="${anchorId}"></a>`,
    text: `<a id="${anchorId}"></a>`,
  }
  nextTokens.push(html)
  const text = nextTokens
    .map(tt => (tt as unknown as { text?: unknown }).text)
    .filter(v => typeof v === 'string')
    .join('')
  return { tokens: nextTokens, text }
}

const maybeConvertBlockquoteToCallout = (args: {
  raw: string
  startLine: number
  endLine: number
  tokens: TokenWithLines[]
}): TokenWithLines | null => {
  const first = args.tokens[0] as unknown as { type?: unknown; text?: unknown; tokens?: Token[] }
  if (first?.type !== 'paragraph') return null
  const firstTokens = Array.isArray(first.tokens) ? first.tokens : []
  let brIndex = -1
  let firstLineText = ''
  for (let i = 0; i < firstTokens.length; i += 1) {
    const tok = firstTokens[i] as unknown as { type?: unknown; text?: unknown }
    if (tok.type === 'br') {
      brIndex = i
      break
    }
    if (typeof tok.text === 'string') {
      firstLineText += tok.text
    }
  }
  const m = firstLineText.match(/^\s*\[!([A-Za-z0-9_-]+)([+-])?\]\s*(.*)$/)
  if (!m) return null
  const calloutType = String(m[1] || '').trim().toLowerCase()
  if (!calloutType) return null
  const foldMarker = String(m[2] || '').trim()
  const foldable = foldMarker === '+' || foldMarker === '-'
  const collapsed = foldMarker === '-'
  const titleRaw = String(m[3] || '').trim()
  const title = titleRaw || calloutType.slice(0, 1).toUpperCase() + calloutType.slice(1)

  const remainderTokens = brIndex >= 0 ? firstTokens.slice(brIndex + 1) : []
  const remainderText = remainderTokens
    .map(t => (t as unknown as { text?: unknown }).text)
    .filter(v => typeof v === 'string')
    .join('')
  const remainderParagraph: Token | null = remainderTokens.length
    ? ({ type: 'paragraph', raw: remainderText, text: remainderText, tokens: remainderTokens } as unknown as Token)
    : null

  const content = args.tokens.slice(1).map(t => {
    const { startLine, endLine, ...rest } = t as unknown as { startLine?: number; endLine?: number }
    return rest as unknown as Token
  })
  const contentWithRemainder = remainderParagraph ? [remainderParagraph, ...content] : content

  const callout: TokensCallout = {
    type: 'callout',
    raw: args.raw,
    calloutType,
    title,
    foldable,
    collapsed,
    tokens: contentWithRemainder,
  }
  return Object.assign({}, callout, { startLine: args.startLine, endLine: args.endLine }) as TokenWithLines
}

export const buildBlockTokens = (mdTokens: MdToken[], lineOffset: number, srcLines: string[]): TokenWithLines[] => {
  const buildRawLinePlaceholder = (t: MdToken): string => {
    const map = t.map || [0, 0]
    const lineCount = Math.max(0, (map[1] || 0) - (map[0] || 0))
    if (lineCount <= 1) return ''
    return '\n'.repeat(lineCount - 1)
  }

  const usedHeadingIds = new Set<string>()
  const headingIdCounters = new Map<string, number>()
  const allocateUniqueHeadingId = (raw: string): string => {
    const base = String(raw || '').trim()
    if (!base) return ''
    if (!usedHeadingIds.has(base)) {
      usedHeadingIds.add(base)
      return base
    }
    let n = headingIdCounters.get(base) || 1
    for (;;) {
      const candidate = `${base}-${n}`
      if (!usedHeadingIds.has(candidate)) {
        headingIdCounters.set(base, n + 1)
        usedHeadingIds.add(candidate)
        return candidate
      }
      n += 1
    }
  }

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
      const raw = buildRawLinePlaceholder(t)
      const explicitId = String(getAttr(t, 'id') || '').trim()
      const slugBase = explicitId || slugify(text || '') || `h${depth}`
      const id = allocateUniqueHeadingId(slugBase)
      const h: TokensHeading = {
        type: 'heading',
        raw,
        depth,
        id,
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
      const map = t.map || [0, 0]
      const rawBlock = srcLines.length > 0 ? (srcLines.slice(map[0], map[1]).join('\n') || '') : ''
      const rawTrimmed = rawBlock.trim()
      if (
        rawTrimmed &&
        /^<a\b[^>]*>\s*<\/a>$/i.test(rawTrimmed) &&
        !/\bhref\s*=\s*/i.test(rawTrimmed)
      ) {
        const { startLine, endLine } = mapLines(t, lineOffset)
        const h: TokensHTML = {
          type: 'html',
          raw: rawBlock,
          text: rawTrimmed,
        }
        out.push(Object.assign({}, h, { startLine, endLine }) as TokenWithLines)
        i += closeTok && closeTok.type === 'paragraph_close' ? 3 : 1
        continue
      }
      const inlineChildren = inlineTok && inlineTok.type === 'inline' ? inlineTok.children : undefined
      const { tokens: inlineTokensRaw, text: textRaw } = buildInlineTokensWithText(inlineChildren)

      const maybeStandaloneHtml = (() => {
        const meaningful = inlineTokensRaw.filter(tok => {
          const tt = tok as unknown as { type?: unknown; text?: unknown }
          if (tt.type !== 'text') return true
          const s = typeof tt.text === 'string' ? tt.text : ''
          return !/^\s*$/.test(s)
        })
        if (meaningful.length < 1) return null
        const allHtml = meaningful.every(tok => (tok as unknown as { type?: unknown }).type === 'html')
        if (!allHtml) return null
        const html = meaningful
          .map(tok => {
            const t = tok as unknown as { text?: unknown; raw?: unknown }
            return String(t.text ?? t.raw ?? '')
          })
          .join('')
          .trim()
        const lower = html.toLowerCase()
        if (
          !(
            lower.startsWith('<iframe') ||
            lower.startsWith('<svg') ||
            lower.startsWith('<video') ||
            lower.startsWith('<audio') ||
            lower.startsWith('<img') ||
            lower.startsWith('<picture') ||
            lower.startsWith('<details')
          )
        ) {
          return null
        }
        return html
      })()

      if (maybeStandaloneHtml) {
        const { startLine, endLine } = mapLines(t, lineOffset)
        const raw = rawBlock || maybeStandaloneHtml
        const h: TokensHTML = {
          type: 'html',
          raw,
          text: raw,
        }
        out.push(Object.assign({}, h, { startLine, endLine }) as TokenWithLines)
        i += closeTok && closeTok.type === 'paragraph_close' ? 3 : 1
        continue
      }

      const { tokens: inlineTokens, text } = maybeExtractTrailingBlockId(inlineTokensRaw, textRaw)
      const { startLine, endLine } = mapLines(t, lineOffset)
      const raw = buildRawLinePlaceholder(t)
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
      const raw = buildRawLinePlaceholder(t)
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
      const raw = buildRawLinePlaceholder(t)
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
      const raw = srcLines.length > 0 ? srcLines.slice(map[0], map[1]).join('\n') : buildRawLinePlaceholder(open)
      let j = i + 1
      let balance = 1
      while (j < mdTokens.length) {
        if (mdTokens[j].type === 'blockquote_open') balance += 1
        if (mdTokens[j].type === 'blockquote_close') balance -= 1
        if (balance === 0) break
        j += 1
      }
      const innerTokens = mdTokens.slice(i + 1, j)
      const tokens = buildBlockTokens(innerTokens, lineOffset, srcLines)
      const callout = maybeConvertBlockquoteToCallout({ raw, startLine, endLine, tokens })
      if (callout) {
        out.push(callout)
      } else {
        const bq: TokensBlockquote = {
          type: 'blockquote',
          raw,
          tokens,
        }
        out.push(Object.assign({}, bq, { startLine, endLine }) as TokenWithLines)
      }
      i = j + 1
      continue
    }
    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
      const open = t
      const ordered = t.type === 'ordered_list_open'
      const { startLine, endLine } = mapLines(open, lineOffset)
      const raw = buildRawLinePlaceholder(open)
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
        
        let k = j + 1
        let balance = 1
        while (k < mdTokens.length) {
          if (mdTokens[k].type === 'list_item_open') balance += 1
          if (mdTokens[k].type === 'list_item_close') balance -= 1
          if (balance === 0) break
          k += 1
        }
        
        const itemTokensRaw = mdTokens.slice(j + 1, k)
        const itemBlockTokens = buildBlockTokens(itemTokensRaw, lineOffset, srcLines)
        
        let task = false
        let checked = false
        
        // Check for task list in the first paragraph
        if (itemBlockTokens.length > 0 && itemBlockTokens[0].type === 'paragraph') {
            const p = itemBlockTokens[0] as TokensParagraph
            if (p.tokens && p.tokens.length > 0) {
                const firstText = p.tokens.find(tt => (tt as { type?: string }).type === 'text') as TokensText | undefined
                if (firstText && typeof firstText.text === 'string') {
                    const m = firstText.text.match(/^\s*\[([ xX])]\s+(.*)$/)
                    if (m) {
                        task = true
                        checked = m[1].toLowerCase() === 'x'
                        firstText.text = m[2]
                        firstText.raw = firstText.text
                        // Update paragraph text as well to reflect stripped check
                        p.text = p.tokens.map(tt => (tt as { text?: string }).text || '').join('')
                        p.raw = p.text // Approximate raw update
                    }
                }
            }
        }

        const listItem: ListItemToken = {
          task,
          checked,
          tokens: itemBlockTokens as Token[],
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
      // Skip until matching list close
      // The inner loop handled items, so j is now at a non-item token.
      // We expect it to be the list close token.
      // But we need to handle the case where we might have nested lists that we didn't consume? 
      // No, we consumed everything inside items.
      // So j should be at list close.
      // But we need to make sure we advance past the list close token of THIS list.
      // The outer while loop condition `if (cur.type === ... close ...)` handles breaking.
      // But we need to advance i to j + 1 after the loop.
      // Wait, the loop breaks when j is AT the close token.
      // So i should become j + 1.
      
      // However, we need to handle the case where there are nested lists that are NOT inside items? (Invalid MD)
      // Or if the loop terminated because of end of tokens (shouldn't happen).
      
      while (j < mdTokens.length && mdTokens[j].type !== 'bullet_list_close' && mdTokens[j].type !== 'ordered_list_close') {
        j += 1
      }
      i = j + 1
      continue
    }
    if (t.type === 'table_open') {
      const open = t
      const { startLine, endLine } = mapLines(open, lineOffset)
      const raw = buildRawLinePlaceholder(open)
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
      const maxCols = Math.max(header.length, ...rows.map(r => r.length))
      if (Number.isFinite(maxCols) && maxCols > 0) {
        while (header.length < maxCols) header.push({ text: '', tokens: [] })
        for (const row of rows) {
          while (row.length < maxCols) row.push({ text: '', tokens: [] })
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
