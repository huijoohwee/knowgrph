import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { LRUCache } from '@/lib/cache/LRUCache'

export type MarkdownDesignBlock = {
  id: string
  type: string
  startLine: number
  endLine: number
  title: string
  summary: string
  preview: {
    kind: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'callout' | 'blockquote' | 'hr' | 'html' | 'other'
    headingDepth?: number
    ordered?: boolean
    listItems?: Array<{ text: string; task?: boolean; checked?: boolean }>
    table?: { columns: string[]; rows: string[][]; rowCount: number }
    code?: { lang: string; lines: string[] }
    callout?: { calloutType: string; title: string; collapsed: boolean }
    blockquote?: { lines: string[] }
  }
  x: number
  y: number
  w: number
  h: number
}

export type MarkdownDesignLayout = {
  key: string
  blocks: MarkdownDesignBlock[]
}

export const MARKDOWN_DESIGN_LAYOUT = {
  block: {
    widthPx: 320,
    minHeightPx: 72,
    maxHeightPx: 320,
    gapPx: 14,
    cornerPx: 10,
  },
  canvas: {
    padX: 120,
    padY: 120,
    columnMaxHeightPx: 1280,
    columnGapPx: 120,
  },
  cacheCapacity: 24,
  viewportOverscanPx: 600,
} as const

const layoutCache = new LRUCache<string, MarkdownDesignLayout>(MARKDOWN_DESIGN_LAYOUT.cacheCapacity)

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

const estimateTokenTextLength = (t: TokenWithLines): number => {
  const anyTok = t as unknown as { text?: unknown; tokens?: unknown; header?: unknown; rows?: unknown; items?: unknown }
  if (typeof anyTok.text === 'string') return anyTok.text.length
  if (Array.isArray(anyTok.tokens)) {
    return anyTok.tokens
      .map(x => (x as { text?: unknown; raw?: unknown }).text ?? (x as { raw?: unknown }).raw ?? '')
      .join('')
      .length
  }
  if (Array.isArray(anyTok.header) || Array.isArray(anyTok.rows)) {
    const header = Array.isArray(anyTok.header) ? anyTok.header : []
    const rows = Array.isArray(anyTok.rows) ? anyTok.rows : []
    const cellText = (cell: unknown): string => String((cell as { text?: unknown }).text ?? '')
    const h = header.map(cellText).join('')
    const r = rows.map((row: unknown) => (Array.isArray(row) ? row : []).map(cellText).join('')).join('')
    return (h + r).length
  }
  if (Array.isArray(anyTok.items)) {
    return anyTok.items
      .map(x => (x as { text?: unknown }).text ?? '')
      .join('')
      .toString().length
  }
  return 64
}

const estimateBlockHeightPx = (t: TokenWithLines): number => {
  const base = (() => {
    if (t.type === 'heading') return 84
    if (t.type === 'table') return 220
    if (t.type === 'list') return 160
    if (t.type === 'code') return 220
    if (t.type === 'blockquote' || t.type === 'callout') return 160
    return 120
  })()
  const n = estimateTokenTextLength(t)
  const lines = Math.max(1, Math.ceil(n / 42))
  const h = base + lines * 16
  return clamp(h, MARKDOWN_DESIGN_LAYOUT.block.minHeightPx, MARKDOWN_DESIGN_LAYOUT.block.maxHeightPx)
}

const buildBlockId = (t: TokenWithLines): string => {
  const type = String(t.type || 'block')
  const startLine = Math.max(1, Math.floor(t.startLine || 1))
  const endLine = Math.max(startLine, Math.floor((t.endLine || t.startLine) as number))
  return `${type}:${startLine}-${endLine}`
}

const buildTitleAndSummary = (t: TokenWithLines): { title: string; summary: string } => {
  const type = String(t.type || 'block')
  const anyTok = t as unknown as { text?: unknown; rows?: unknown; items?: unknown }
  const text = typeof anyTok.text === 'string' ? anyTok.text.trim() : ''

  if (type === 'heading') return { title: text || 'Heading', summary: '' }
  if (type === 'table') {
    const rows = Array.isArray(anyTok.rows) ? anyTok.rows : []
    return { title: 'Table', summary: rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'}` : '' }
  }
  if (type === 'list') {
    const items = Array.isArray(anyTok.items) ? anyTok.items : []
    return { title: 'List', summary: items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : '' }
  }

  const title = type[0]?.toUpperCase() + type.slice(1) || 'Block'
  const summary = text ? (text.length <= 140 ? text : `${text.slice(0, 137)}...`) : ''
  return { title, summary }
}

const estimateBlockWidthPx = (t: TokenWithLines): number => {
  if (t.type === 'table') return 560
  if (t.type === 'code') return 520
  if (t.type === 'callout') return 420
  if (t.type === 'heading') return 420
  return MARKDOWN_DESIGN_LAYOUT.block.widthPx
}

const buildPreview = (t: TokenWithLines): MarkdownDesignBlock['preview'] => {
  const type = String(t.type || 'block')
  if (type === 'heading') {
    const anyTok = t as unknown as { depth?: unknown }
    const depth = typeof anyTok.depth === 'number' && Number.isFinite(anyTok.depth) ? Math.max(1, Math.min(6, anyTok.depth)) : 1
    return { kind: 'heading', headingDepth: depth }
  }
  if (type === 'paragraph') {
    return { kind: 'paragraph' }
  }
  if (type === 'list') {
    const anyTok = t as unknown as { ordered?: unknown; items?: unknown }
    const ordered = anyTok.ordered === true
    const items = Array.isArray(anyTok.items) ? (anyTok.items as Array<{ task?: boolean; checked?: boolean; tokens?: unknown }>) : []
    const listItems = items.slice(0, 6).map(it => {
      const toks = Array.isArray(it.tokens) ? (it.tokens as Array<{ type?: unknown; text?: unknown }>) : []
      const firstPara = toks.find(x => (x as { type?: unknown }).type === 'paragraph') as unknown as { text?: unknown } | null
      const text = typeof firstPara?.text === 'string' ? firstPara.text : ''
      return { text: String(text || '').trim(), task: it.task, checked: it.checked }
    })
    return { kind: 'list', ordered, listItems }
  }
  if (type === 'table') {
    const anyTok = t as unknown as { header?: unknown; rows?: unknown }
    const header = Array.isArray(anyTok.header) ? (anyTok.header as Array<{ text?: unknown }>) : []
    const rows = Array.isArray(anyTok.rows) ? (anyTok.rows as Array<Array<{ text?: unknown }>>) : []
    const columns = header.map(c => String(c?.text ?? '').trim()).filter(Boolean).slice(0, 6)
    const previewRows = rows
      .slice(0, 4)
      .map(r => (Array.isArray(r) ? r : []).slice(0, columns.length || 6).map(c => String(c?.text ?? '').trim()))
    return { kind: 'table', table: { columns, rows: previewRows, rowCount: rows.length } }
  }
  if (type === 'code') {
    const anyTok = t as unknown as { lang?: unknown; text?: unknown }
    const lang = typeof anyTok.lang === 'string' ? anyTok.lang.trim() : ''
    const text = typeof anyTok.text === 'string' ? anyTok.text : ''
    const lines = text.split(/\r?\n/g).slice(0, 10)
    return { kind: 'code', code: { lang, lines } }
  }
  if (type === 'callout') {
    const anyTok = t as unknown as { calloutType?: unknown; title?: unknown; collapsed?: unknown }
    const calloutType = String(anyTok.calloutType ?? '').trim().toLowerCase()
    const title = String(anyTok.title ?? '').trim()
    const collapsed = anyTok.collapsed === true
    return { kind: 'callout', callout: { calloutType, title, collapsed } }
  }
  if (type === 'blockquote') {
    const lines: string[] = []
    const anyTok = t as unknown as { raw?: unknown; tokens?: unknown }
    const raw = typeof anyTok.raw === 'string' ? anyTok.raw : ''
    if (raw) {
      const rawLines = raw
        .split(/\r?\n/g)
        .map(s => s.replace(/^\s*>\s?/, '').trim())
        .filter(Boolean)
      for (let i = 0; i < rawLines.length && lines.length < 4; i += 1) lines.push(rawLines[i]!)
    }
    if (lines.length >= 2) return { kind: 'blockquote', blockquote: { lines } }

    const inner = Array.isArray(anyTok.tokens) ? (anyTok.tokens as Array<{ type?: unknown; text?: unknown }>) : []
    for (let i = 0; i < inner.length && lines.length < 4; i += 1) {
      const it = inner[i]
      const tt = String((it as { type?: unknown }).type || '')
      if (tt !== 'paragraph' && tt !== 'heading') continue
      const text = typeof (it as { text?: unknown }).text === 'string' ? String((it as { text?: unknown }).text || '').trim() : ''
      if (!text) continue
      const split = text.split(/\r?\n/g).map(s => s.trim()).filter(Boolean)
      for (let j = 0; j < split.length && lines.length < 4; j += 1) lines.push(split[j]!)
    }
    return { kind: 'blockquote', blockquote: { lines } }
  }
  if (type === 'hr') return { kind: 'hr' }
  if (type === 'html') return { kind: 'html' }
  return { kind: 'other' }
}

export const buildMarkdownDesignLayoutKey = (args: {
  activeDocumentPath: string
  markdownTokensKey: string | null
}): string => {
  const doc = String(args.activeDocumentPath || '')
  const key = String(args.markdownTokensKey || '')
  return `${doc}|${key}`
}

export const deriveMarkdownDesignLayout = (args: {
  activeDocumentPath: string
  markdownTokensKey: string | null
  tokens: TokenWithLines[]
}): MarkdownDesignLayout => {
  const key = buildMarkdownDesignLayoutKey({
    activeDocumentPath: args.activeDocumentPath,
    markdownTokensKey: args.markdownTokensKey,
  })

  const cached = layoutCache.get(key)
  if (cached) return cached

  const gap = MARKDOWN_DESIGN_LAYOUT.block.gapPx
  const colMaxH = MARKDOWN_DESIGN_LAYOUT.canvas.columnMaxHeightPx
  const colGap = MARKDOWN_DESIGN_LAYOUT.canvas.columnGapPx

  let x = MARKDOWN_DESIGN_LAYOUT.canvas.padX
  let y = MARKDOWN_DESIGN_LAYOUT.canvas.padY
  let colW = 0
  const blocks: MarkdownDesignBlock[] = []
  for (const t of args.tokens) {
    const id = buildBlockId(t)
    const h = estimateBlockHeightPx(t)
    const { title, summary } = buildTitleAndSummary(t)
    const preview = buildPreview(t)
    const w = estimateBlockWidthPx(t)

    const isMajorHeading = t.type === 'heading' && (preview.kind === 'heading' ? (preview.headingDepth || 1) <= 2 : true)
    if (blocks.length > 0 && isMajorHeading && y > MARKDOWN_DESIGN_LAYOUT.canvas.padY) {
      x += Math.max(colW, w) + colGap
      y = MARKDOWN_DESIGN_LAYOUT.canvas.padY
      colW = 0
    }
    if (y + h > MARKDOWN_DESIGN_LAYOUT.canvas.padY + colMaxH && blocks.length > 0) {
      x += Math.max(colW, w) + colGap
      y = MARKDOWN_DESIGN_LAYOUT.canvas.padY
      colW = 0
    }
    colW = Math.max(colW, w)

    blocks.push({
      id,
      type: t.type,
      startLine: t.startLine,
      endLine: t.endLine || t.startLine,
      title,
      summary,
      preview,
      x,
      y,
      w,
      h,
    })
    y += h + gap
  }

  const layout: MarkdownDesignLayout = { key, blocks }
  layoutCache.set(key, layout)
  return layout
}

export const patchMarkdownDesignLayoutPositions = (args: {
  layoutKey: string
  updates: Array<{ id: string; x: number; y: number }>
}): void => {
  const cached = layoutCache.get(args.layoutKey)
  if (!cached) return
  const updatesById = new Map(args.updates.map(u => [u.id, u]))
  const blocks = cached.blocks.map(b => {
    const u = updatesById.get(b.id)
    if (!u) return b
    return { ...b, x: u.x, y: u.y }
  })
  layoutCache.set(args.layoutKey, { ...cached, blocks })
}
