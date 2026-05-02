import type { MarkdownDesignBlock } from '@/features/markdown-edgeless/markdownDesignLayout'
import {
  PANEL_FRAME_BODY_STYLE,
  PANEL_FRAME_HEADER_STYLE,
  PANEL_FRAME_HEADER_TITLE_STYLE,
  PANEL_FRAME_ROOT_STYLE,
  type CssStyle,
} from '@/lib/ui/panelFrame'

const toKebab = (k: string): string => k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)

const styleToString = (s: CssStyle): string => {
  const parts: string[] = []
  for (const k of Object.keys(s)) {
    const v = s[k]
    if (v === undefined) continue
    const key = toKebab(k)
    const value = typeof v === 'number' ? String(v) : String(v)
    parts.push(`${key}:${value}`)
  }
  return parts.join(';')
}

const createEl = (doc: Document, tag: string): HTMLElement => doc.createElement(tag)

const appendText = (el: HTMLElement, text: string): void => {
  el.textContent = String(text || '')
}

const renderBodyContent = (doc: Document, block: MarkdownDesignBlock): HTMLElement => {
  const body = createEl(doc, 'div')
  body.setAttribute('style', styleToString(PANEL_FRAME_BODY_STYLE))

  const preview = block.preview
  if (preview.kind === 'table' && preview.table) {
    const table = createEl(doc, 'table')
    table.setAttribute(
      'style',
      [
        'width:100%',
        'border-collapse:collapse',
        'font-size:11px',
        'line-height:1.25',
        'color:var(--kg-text)',
      ].join(';'),
    )

    const cols = Array.isArray(preview.table.columns) ? preview.table.columns : []
    const rows = Array.isArray(preview.table.rows) ? preview.table.rows : []

    if (cols.length > 0) {
      const thead = createEl(doc, 'thead')
      const tr = createEl(doc, 'tr')
      for (let i = 0; i < cols.length; i += 1) {
        const th = createEl(doc, 'th')
        th.setAttribute(
          'style',
          [
            'text-align:left',
            'border:1px solid var(--kg-border)',
            'padding:2px 4px',
            'background:rgba(0,0,0,0.04)',
            'font-weight:600',
          ].join(';'),
        )
        appendText(th, cols[i] || '')
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
    }

    const tbody = createEl(doc, 'tbody')
    const maxRows = Math.max(1, Math.min(10, rows.length))
    for (let r = 0; r < maxRows; r += 1) {
      const tr = createEl(doc, 'tr')
      const row = Array.isArray(rows[r]) ? rows[r] : []
      const cells = cols.length > 0 ? cols.length : row.length
      for (let c = 0; c < cells; c += 1) {
        const td = createEl(doc, 'td')
        td.setAttribute('style', ['border:1px solid var(--kg-border)', 'padding:2px 4px', 'vertical-align:top'].join(';'))
        appendText(td, String(row[c] ?? ''))
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    body.appendChild(table)
    return body
  }

  if (preview.kind === 'code' && preview.code) {
    const pre = createEl(doc, 'pre')
    pre.setAttribute(
      'style',
      [
        'margin:0',
        'padding:6px',
        'border-radius:8px',
        'background:rgba(0,0,0,0.06)',
        'font-size:11px',
        'line-height:1.35',
        'overflow:hidden',
        'font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        'white-space:pre',
        'color:var(--kg-text)',
      ].join(';'),
    )
    const lines = Array.isArray(preview.code.lines) ? preview.code.lines : []
    appendText(pre, lines.slice(0, 14).join('\n'))
    body.appendChild(pre)
    return body
  }

  if (preview.kind === 'blockquote' && preview.blockquote) {
    const box = createEl(doc, 'div')
    box.setAttribute(
      'style',
      [
        'border-left:3px solid var(--kg-border)',
        'padding-left:8px',
        'color:var(--kg-text)',
        'font-size:12px',
        'line-height:1.35',
        'white-space:pre-wrap',
      ].join(';'),
    )
    const lines = Array.isArray(preview.blockquote.lines) ? preview.blockquote.lines : []
    appendText(box, lines.slice(0, 8).join('\n'))
    body.appendChild(box)
    return body
  }

  if (preview.kind === 'list' && Array.isArray(preview.listItems) && preview.listItems.length > 0) {
    const ul = createEl(doc, 'ul')
    ul.setAttribute('style', ['margin:0', 'padding:0 0 0 16px', 'font-size:12px', 'line-height:1.35'].join(';'))
    const max = Math.min(10, preview.listItems.length)
    for (let i = 0; i < max; i += 1) {
      const it = preview.listItems[i]
      const li = createEl(doc, 'li')
      li.setAttribute('style', ['margin:0', 'padding:0', 'color:var(--kg-text)'].join(';'))
      const prefix = it.task ? (it.checked ? '[x] ' : '[ ] ') : ''
      appendText(li, `${prefix}${String(it.text || '').trim()}`)
      ul.appendChild(li)
    }
    body.appendChild(ul)
    return body
  }

  if (preview.kind === 'heading') {
    const h = createEl(doc, 'div')
    const depth = typeof preview.headingDepth === 'number' && Number.isFinite(preview.headingDepth)
      ? Math.max(1, Math.min(6, Math.floor(preview.headingDepth)))
      : 2
    const size = depth <= 2 ? 14 : depth === 3 ? 13 : 12
    h.setAttribute('style', [`font-weight:700`, `font-size:${size}px`, 'line-height:1.2', 'color:var(--kg-text)'].join(';'))
    appendText(h, block.title)
    body.appendChild(h)
    return body
  }

  const p = createEl(doc, 'div')
  p.setAttribute('style', ['font-size:12px', 'line-height:1.35', 'color:var(--kg-text)', 'white-space:pre-wrap'].join(';'))
  appendText(p, block.summary || block.title)
  body.appendChild(p)
  return body
}

export function injectMarkdownDesignBlocksIntoSvgEl(args: {
  svgEl: SVGSVGElement
  blocks: MarkdownDesignBlock[]
  maxBlocks?: number
}): void {
  const svgEl = args.svgEl
  const blocks = Array.isArray(args.blocks) ? args.blocks : []
  if (!svgEl || blocks.length === 0) return

  const maxBlocksRaw = typeof args.maxBlocks === 'number' && Number.isFinite(args.maxBlocks) ? Math.floor(args.maxBlocks) : 0
  const maxBlocks = maxBlocksRaw > 0 ? Math.max(1, Math.min(600, maxBlocksRaw)) : 240

  const doc = svgEl.ownerDocument
  if (!doc) return
  const ns = svgEl.namespaceURI || 'http://www.w3.org/2000/svg'

  const zoomRoot = (() => {
    const kids = Array.from(svgEl.children)
    for (let i = 0; i < kids.length; i += 1) {
      const el = kids[i] as Element
      if (String((el as any).tagName || '').toLowerCase() === 'g') return el as SVGGElement
    }
    return null
  })()
  if (!zoomRoot) return

  let layer = zoomRoot.querySelector('g[data-kg-layer="markdown-design-blocks"]') as SVGGElement | null
  if (!layer) {
    layer = doc.createElementNS(ns, 'g') as SVGGElement
    layer.setAttribute('data-kg-layer', 'markdown-design-blocks')
    zoomRoot.appendChild(layer)
  }
  while (layer.firstChild) layer.removeChild(layer.firstChild)

  for (let i = 0; i < blocks.length && i < maxBlocks; i += 1) {
    const b = blocks[i]!
    const x = Number(b.x)
    const y = Number(b.y)
    const w = Number(b.w)
    const h = Number(b.h)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) continue

    const fo = doc.createElementNS(ns, 'foreignObject') as unknown as SVGForeignObjectElement
    fo.setAttribute('x', String(x))
    fo.setAttribute('y', String(y))
    fo.setAttribute('width', String(w))
    fo.setAttribute('height', String(h))
    fo.setAttribute('data-kg-markdown-block-id', String(b.id || ''))
    ;(fo.style as any).overflow = 'hidden'
    ;(fo.style as any).pointerEvents = 'none'

    const root = doc.createElement('div')
    root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    root.setAttribute('style', `${styleToString(PANEL_FRAME_ROOT_STYLE)};width:100%;height:100%;pointer-events:none`)

    const header = doc.createElement('header')
    header.setAttribute('style', `${styleToString(PANEL_FRAME_HEADER_STYLE)};pointer-events:none`)
    const title = doc.createElement('h3')
    title.setAttribute('style', styleToString(PANEL_FRAME_HEADER_TITLE_STYLE))
    appendText(title, b.title || 'Block')
    header.appendChild(title)
    root.appendChild(header)
    root.appendChild(renderBodyContent(doc, b))

    fo.appendChild(root)
    layer.appendChild(fo)
  }
}
