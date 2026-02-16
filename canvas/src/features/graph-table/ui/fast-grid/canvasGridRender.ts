import { binarySearchFloor, clamp, getVisibleColumnsRange, getVisibleRange } from './fastGridMath'

export type GridColumnMeta = {
  kind: 'select' | 'order' | 'data'
  id: string
  title: string
  width: number
  pinned: boolean
  editable: boolean
}

export type GridDisplayRow<RowT> =
  | { kind: 'group'; label: string; count: number }
  | { kind: 'row'; row: RowT; groupLabel?: string }

export type GridLayout = {
  pinned: GridColumnMeta[]
  scrollable: GridColumnMeta[]
  pinnedWidth: number
  scrollableOffsets: number[]
  totalWidth: number
  totalHeight: number
}

export type GridHit<RowT> = {
  x: number
  y: number
  inHeader: boolean
  rowIndex: number
  rowItem: GridDisplayRow<RowT> | null
  col: GridColumnMeta | null
  scrollableColIndex: number
}

export function getCellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function hitTest<RowT extends { id: string }>(args: {
  clientX: number
  clientY: number
  viewportEl: HTMLElement
  scrollLeft: number
  scrollTop: number
  rowHeight: number
  headerHeight: number
  layout: GridLayout
  displayRows: GridDisplayRow<RowT>[]
}): GridHit<RowT> | null {
  const { viewportEl, clientX, clientY, scrollLeft, scrollTop, rowHeight, headerHeight, layout, displayRows } = args
  const rect = viewportEl.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null

  const inHeader = y <= headerHeight
  const rowIndex = inHeader ? -1 : Math.floor((y - headerHeight + scrollTop) / rowHeight)
  const rowItem = rowIndex >= 0 && rowIndex < displayRows.length ? displayRows[rowIndex] : null

  let col: GridColumnMeta | null = null
  let scrollableColIndex = -1

  if (x < layout.pinnedWidth) {
    let acc = 0
    for (const c of layout.pinned) {
      if (x >= acc && x < acc + c.width) {
        col = c
        break
      }
      acc += c.width
    }
  } else {
    const sx = x - layout.pinnedWidth + scrollLeft
    const idx = clamp(binarySearchFloor(layout.scrollableOffsets, sx), 0, Math.max(0, layout.scrollable.length - 1))
    const start = layout.scrollableOffsets[idx] || 0
    const end = layout.scrollableOffsets[idx + 1] || start
    if (sx >= start && sx < end) {
      col = layout.scrollable[idx] || null
      scrollableColIndex = idx
    }
  }

  return { x, y, inHeader, rowIndex, rowItem, col, scrollableColIndex }
}

export function drawGrid<RowT extends { id: string; __order?: number }>(args: {
  canvas: HTMLCanvasElement
  viewportEl: HTMLElement
  scrollLeft: number
  scrollTop: number
  rowHeight: number
  headerHeight: number
  layout: GridLayout
  displayRows: GridDisplayRow<RowT>[]
  selectedSet: Set<string>
  allSelected: boolean
  someSelected: boolean
  sortIndexByColumnId: Record<string, { dir: 'asc' | 'desc'; index: number }>
  isGroupCollapsed: (label: string) => boolean
}): void {
  const {
    canvas,
    viewportEl,
    scrollLeft,
    scrollTop,
    rowHeight,
    headerHeight,
    layout,
    displayRows,
    selectedSet,
    allSelected,
    someSelected,
    sortIndexByColumnId,
    isGroupCollapsed,
  } = args

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = viewportEl.getBoundingClientRect()
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  const nextW = Math.max(1, Math.floor(w * dpr))
  const nextH = Math.max(1, Math.floor(h * dpr))
  if (canvas.width !== nextW) canvas.width = nextW
  if (canvas.height !== nextH) canvas.height = nextH
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const computed = window.getComputedStyle(viewportEl)
  const fontSize = computed.fontSize || '12px'
  const fontFamily = computed.fontFamily || 'ui-sans-serif'
  ctx.font = `400 ${fontSize} ${fontFamily}`
  ctx.textBaseline = 'middle'

  const panelBg = computed.getPropertyValue('--kg-panel-bg')?.trim() || '#ffffff'
  const divider = computed.getPropertyValue('--kg-divider')?.trim() || 'rgba(0,0,0,0.12)'
  const border = computed.getPropertyValue('--kg-border')?.trim() || 'rgba(0,0,0,0.18)'
  const textPrimary = computed.getPropertyValue('--kg-text-primary')?.trim() || '#111'
  const textSecondary = computed.getPropertyValue('--kg-text-secondary')?.trim() || '#666'
  const textTertiary = computed.getPropertyValue('--kg-text-tertiary')?.trim() || '#888'

  ctx.fillStyle = panelBg
  ctx.fillRect(0, 0, w, h)

  const drawCheckbox = (x: number, y: number, size: number, checked: boolean, indeterminate: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(128,128,128,0.8)'
    ctx.beginPath()
    ctx.rect(0.5, 0.5, size - 1, size - 1)
    ctx.stroke()
    if (checked || indeterminate) {
      ctx.fillStyle = 'rgba(59,130,246,0.95)'
      ctx.beginPath()
      ctx.rect(1, 1, size - 2, size - 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.beginPath()
      if (indeterminate) {
        ctx.moveTo(3, Math.round(size / 2))
        ctx.lineTo(size - 3, Math.round(size / 2))
      } else {
        ctx.moveTo(3, Math.round(size / 2))
        ctx.lineTo(Math.round(size / 2) - 1, size - 4)
        ctx.lineTo(size - 3, 4)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  const drawCellText = (text: string, x: number, y: number, cellW: number, color: string, bold: boolean) => {
    ctx.save()
    ctx.fillStyle = color
    ctx.font = `${bold ? 600 : 400} ${fontSize} ${fontFamily}`
    ctx.beginPath()
    ctx.rect(x + 6, y + 1, Math.max(0, cellW - 12), rowHeight - 2)
    ctx.clip()
    ctx.fillText(text, x + 8, y + rowHeight / 2)
    ctx.restore()
  }

  ctx.fillStyle = panelBg
  ctx.fillRect(0, 0, w, headerHeight)
  ctx.strokeStyle = divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, headerHeight + 0.5)
  ctx.lineTo(w, headerHeight + 0.5)
  ctx.stroke()

  let pinnedX = 0
  for (const col of layout.pinned) {
    const x = pinnedX
    const cellW = col.width
    if (col.kind === 'select') {
      drawCheckbox(x + 14, 7, 14, allSelected, !allSelected && someSelected)
    } else {
      drawCellText(col.title, x, 0, cellW, textSecondary, true)
    }
    ctx.strokeStyle = divider
    ctx.beginPath()
    ctx.moveTo(x + cellW + 0.5, 0)
    ctx.lineTo(x + cellW + 0.5, h)
    ctx.stroke()
    pinnedX += cellW
  }

  const colRange = getVisibleColumnsRange({
    offsets: layout.scrollableOffsets,
    startPx: scrollLeft,
    viewportPx: Math.max(0, w - layout.pinnedWidth),
    overscan: 2,
  })

  for (let i = colRange.start; i < colRange.end; i += 1) {
    const col = layout.scrollable[i]
    if (!col) continue
    const colX = layout.scrollableOffsets[i] || 0
    const x = layout.pinnedWidth + colX - scrollLeft
    const cellW = col.width
    const sortMeta = sortIndexByColumnId[col.id]
    drawCellText(col.title, x, 0, cellW, textSecondary, true)
    if (sortMeta) {
      ctx.save()
      ctx.fillStyle = textTertiary
      ctx.font = `600 10px ${fontFamily}`
      ctx.fillText(sortMeta.dir === 'desc' ? `↓${sortMeta.index}` : `↑${sortMeta.index}`, x + cellW - 24, headerHeight / 2)
      ctx.restore()
    }
    ctx.strokeStyle = divider
    ctx.beginPath()
    ctx.moveTo(x + cellW + 0.5, 0)
    ctx.lineTo(x + cellW + 0.5, h)
    ctx.stroke()
    ctx.strokeStyle = border
    ctx.beginPath()
    ctx.moveTo(x + cellW - 2 + 0.5, 6)
    ctx.lineTo(x + cellW - 2 + 0.5, headerHeight - 6)
    ctx.stroke()
  }

  const rowRange = getVisibleRange({
    startPx: scrollTop,
    viewportPx: Math.max(0, h - headerHeight),
    itemSizePx: rowHeight,
    itemCount: displayRows.length,
    overscan: 6,
  })

  for (let r = rowRange.start; r < rowRange.end; r += 1) {
    const item = displayRows[r]
    if (!item) continue
    const y = headerHeight + r * rowHeight - scrollTop
    if (y + rowHeight < headerHeight || y > h) continue

    if (item.kind === 'row') {
      const selected = selectedSet.has(item.row.id)
      if (selected) {
        ctx.fillStyle = 'rgba(59,130,246,0.12)'
        ctx.fillRect(0, y, w, rowHeight)
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.02)'
      ctx.fillRect(0, y, w, rowHeight)
    }

    ctx.strokeStyle = divider
    ctx.beginPath()
    ctx.moveTo(0, y + rowHeight + 0.5)
    ctx.lineTo(w, y + rowHeight + 0.5)
    ctx.stroke()

    let x = 0
    for (const col of layout.pinned) {
      const cellW = col.width
      if (item.kind === 'row') {
        if (col.kind === 'select') {
          drawCheckbox(x + 14, y + Math.round((rowHeight - 14) / 2), 14, selectedSet.has(item.row.id), false)
        } else if (col.kind === 'order') {
          drawCellText(String(item.row.__order ?? 0), x, y, cellW, textSecondary, false)
        }
      }
      x += cellW
    }

    if (item.kind === 'group') {
      const collapsed = isGroupCollapsed(item.label)
      ctx.save()
      ctx.fillStyle = textSecondary
      ctx.font = `600 ${fontSize} ${fontFamily}`
      ctx.fillText(collapsed ? '▶' : '▼', layout.pinnedWidth + 8, y + rowHeight / 2)
      ctx.restore()
      drawCellText(`${item.label} (${item.count})`, layout.pinnedWidth + 18, y, Math.max(80, w - layout.pinnedWidth - 18), textSecondary, true)
      continue
    }

    for (let i = colRange.start; i < colRange.end; i += 1) {
      const col = layout.scrollable[i]
      if (!col) continue
      const colX = layout.scrollableOffsets[i] || 0
      const cellX = layout.pinnedWidth + colX - scrollLeft
      const raw = (item.row as unknown as Record<string, unknown>)[col.id]
      drawCellText(getCellText(raw), cellX, y, col.width, textPrimary, false)
    }
  }
}

