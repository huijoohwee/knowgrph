import React from 'react'

export const deriveSafeLayoutStyleFromClassAttrImpl = (rawClass: string): React.CSSProperties | undefined => {
  const input = String(rawClass || '').trim()
  if (!input) return undefined
  const tokens = input.split(/\s+/).filter(Boolean)
  if (!tokens.length) return undefined

  const bpRank: Record<string, number> = { '': 0, sm: 1, md: 2, lg: 3, xl: 4, '2xl': 5 }
  const pickBreakpoint = (full: string): { bp: string; util: string } => {
    const parts = full.split(':').filter(Boolean)
    if (parts.length <= 1) return { bp: '', util: full }
    const util = parts[parts.length - 1] || ''
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      const p = parts[i] || ''
      if (p in bpRank) return { bp: p, util }
    }
    return { bp: '', util }
  }

  const best = <T,>(current: { rank: number; value: T } | null, rank: number, value: T) => {
    if (!current) return { rank, value }
    if (rank >= current.rank) return { rank, value }
    return current
  }

  let display: { rank: number; value: string } | null = null
  let tableLayout: { rank: number; value: string } | null = null
  let borderCollapse: { rank: number; value: string } | null = null
  let gridCols: { rank: number; value: number } | null = null
  let gridRows: { rank: number; value: number } | null = null
  let gap: { rank: number; value: number } | null = null
  let gapX: { rank: number; value: number } | null = null
  let gapY: { rank: number; value: number } | null = null
  let columns: { rank: number; value: number } | null = null
  let flexDir: { rank: number; value: string } | null = null
  let flexWrap: { rank: number; value: string } | null = null
  let alignItems: { rank: number; value: string } | null = null
  let justifyItems: { rank: number; value: string } | null = null
  let justifyContent: { rank: number; value: string } | null = null
  let alignContent: { rank: number; value: string } | null = null
  let gridAutoFlow: { rank: number; value: string } | null = null
  let gridAutoRows: { rank: number; value: string } | null = null
  let gridAutoCols: { rank: number; value: string } | null = null
  let colSpan: { rank: number; value: number } | null = null
  let rowSpan: { rank: number; value: number } | null = null
  let colStart: { rank: number; value: number } | null = null
  let colEnd: { rank: number; value: number } | null = null
  let rowStart: { rank: number; value: number } | null = null
  let rowEnd: { rank: number; value: number } | null = null
  let gridColsArb: { rank: number; value: string } | null = null
  let gridRowsArb: { rank: number; value: string } | null = null
  let gapArb: { rank: number; value: string } | null = null
  let gapXArb: { rank: number; value: string } | null = null
  let gapYArb: { rank: number; value: string } | null = null
  let gridAutoRowsArb: { rank: number; value: string } | null = null
  let gridAutoColsArb: { rank: number; value: string } | null = null
  let width: { rank: number; value: string } | null = null
  let height: { rank: number; value: string } | null = null
  let minWidth: { rank: number; value: string } | null = null
  let minHeight: { rank: number; value: string } | null = null
  let maxWidth: { rank: number; value: string } | null = null
  let maxHeight: { rank: number; value: string } | null = null
  let aspectRatio: { rank: number; value: string } | null = null
  let colSpanFull: { rank: number; value: true } | null = null
  let rowSpanFull: { rank: number; value: true } | null = null
  let flex: { rank: number; value: string } | null = null
  let padT: { rank: number; value: string } | null = null
  let padR: { rank: number; value: string } | null = null
  let padB: { rank: number; value: string } | null = null
  let padL: { rank: number; value: string } | null = null
  let marT: { rank: number; value: string } | null = null
  let marR: { rank: number; value: string } | null = null
  let marB: { rank: number; value: string } | null = null
  let marL: { rank: number; value: string } | null = null
  let borderWidth: { rank: number; value: string } | null = null
  let borderColor: { rank: number; value: string } | null = null
  let borderRadius: { rank: number; value: string } | null = null
  let boxShadow: { rank: number; value: string } | null = null
  let overflow: { rank: number; value: string } | null = null
  let overflowX: { rank: number; value: string } | null = null
  let overflowY: { rank: number; value: string } | null = null
  const toSpacingRem = (raw: string): number | null => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return null
    if (n < 0 || n > 96) return null
    return n / 4
  }
  const toSpanValue = (raw: string): number | null => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return null
    if (n < 1 || n > 12) return null
    return n
  }
  const toIndexValue = (raw: string): number | null => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return null
    if (n < 1 || n > 13) return null
    return n
  }
  const unbracket = (raw: string): string => {
    const v = String(raw || '').trim()
    if (!v) return ''
    if (!v.startsWith('[') || !v.endsWith(']')) return ''
    const inner = v.slice(1, -1).trim()
    if (!inner) return ''
    if (inner.length > 120) return ''
    if (/url\s*\(|expression\s*\(|@import/i.test(inner)) return ''
    if (!/^[a-zA-Z0-9\s().,%:/_+-]+$/.test(inner)) return ''
    return inner
  }
  const toDimension = (util: string): string | null => {
    if (/^(?:full)$/i.test(util)) return '100%'
    if (/^screen$/i.test(util)) return '100vh'
    if (/^min$/i.test(util)) return 'min-content'
    if (/^max$/i.test(util)) return 'max-content'
    if (/^fit$/i.test(util)) return 'fit-content'
    const frac = util.match(/^(\d+)\/(\d+)$/)
    if (frac) {
      const a = Number.parseInt(frac[1], 10)
      const b = Number.parseInt(frac[2], 10)
      if (Number.isFinite(a) && Number.isFinite(b) && b > 0) return `${(a / b) * 100}%`
    }
    const n = Number.parseInt(util, 10)
    if (Number.isFinite(n) && n >= 0 && n <= 96) return `${n / 4}rem`
    const arb = unbracket(util)
    if (arb) return arb
    return null
  }

  for (const full of tokens) {
    const { bp, util } = pickBreakpoint(full)
    const rank = bpRank[bp] ?? 0

    if (util === 'grid') { display = best(display, rank, 'grid'); continue }
    if (util === 'inline-grid') { display = best(display, rank, 'inline-grid'); continue }
    if (util === 'flex') { display = best(display, rank, 'flex'); continue }
    if (util === 'inline-flex') { display = best(display, rank, 'inline-flex'); continue }
    if (util === 'table') { display = best(display, rank, 'table'); continue }
    if (util === 'inline-table') { display = best(display, rank, 'inline-table'); continue }
    if (util === 'table-row') { display = best(display, rank, 'table-row'); continue }
    if (util === 'table-cell') { display = best(display, rank, 'table-cell'); continue }
    if (util === 'table-row-group') { display = best(display, rank, 'table-row-group'); continue }
    if (util === 'table-header-group') { display = best(display, rank, 'table-header-group'); continue }
    if (util === 'table-footer-group') { display = best(display, rank, 'table-footer-group'); continue }
    if (util === 'table-column') { display = best(display, rank, 'table-column'); continue }
    if (util === 'table-column-group') { display = best(display, rank, 'table-column-group'); continue }
    if (util === 'table-caption') { display = best(display, rank, 'table-caption'); continue }
    if (util === 'block') { display = best(display, rank, 'block'); continue }
    if (util === 'inline-block') { display = best(display, rank, 'inline-block'); continue }

    if (util === 'table-fixed') { tableLayout = best(tableLayout, rank, 'fixed'); continue }
    if (util === 'table-auto') { tableLayout = best(tableLayout, rank, 'auto'); continue }
    if (util === 'border-collapse') { borderCollapse = best(borderCollapse, rank, 'collapse'); continue }
    if (util === 'border-separate') { borderCollapse = best(borderCollapse, rank, 'separate'); continue }

    let m = util.match(/^grid-cols-(\d{1,2})$/)
    if (m) {
      const n = Number.parseInt(m[1], 10)
      if (n >= 1 && n <= 24) gridCols = best(gridCols, rank, n)
      continue
    }
    m = util.match(/^grid-rows-(\d{1,2})$/)
    if (m) {
      const n = Number.parseInt(m[1], 10)
      if (n >= 1 && n <= 24) gridRows = best(gridRows, rank, n)
      continue
    }
    m = util.match(/^grid-cols-\[(.+)\]$/)
    if (m) {
      const v = unbracket(`[${m[1]}]`)
      if (v) gridColsArb = best(gridColsArb, rank, v)
      continue
    }
    m = util.match(/^grid-rows-\[(.+)\]$/)
    if (m) {
      const v = unbracket(`[${m[1]}]`)
      if (v) gridRowsArb = best(gridRowsArb, rank, v)
      continue
    }

    m = util.match(/^gap-(\d{1,2})$/)
    if (m) { const v = toSpacingRem(m[1]); if (v != null) gap = best(gap, rank, v); continue }
    m = util.match(/^gap-x-(\d{1,2})$/)
    if (m) { const v = toSpacingRem(m[1]); if (v != null) gapX = best(gapX, rank, v); continue }
    m = util.match(/^gap-y-(\d{1,2})$/)
    if (m) { const v = toSpacingRem(m[1]); if (v != null) gapY = best(gapY, rank, v); continue }
    m = util.match(/^gap-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) gapArb = best(gapArb, rank, v); continue }
    m = util.match(/^gap-x-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) gapXArb = best(gapXArb, rank, v); continue }
    m = util.match(/^gap-y-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) gapYArb = best(gapYArb, rank, v); continue }

    m = util.match(/^columns-(\d+)$/)
    if (m) {
      const n = Number.parseInt(m[1], 10)
      if (n >= 1 && n <= 6) columns = best(columns, rank, n)
      continue
    }
    m = util.match(/^w-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) width = best(width, rank, v); continue }
    m = util.match(/^h-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) height = best(height, rank, v); continue }
    m = util.match(/^min-w-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) minWidth = best(minWidth, rank, v); continue }
    m = util.match(/^min-h-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) minHeight = best(minHeight, rank, v); continue }
    m = util.match(/^max-w-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) maxWidth = best(maxWidth, rank, v); continue }
    m = util.match(/^max-h-(.+)$/)
    if (m) { const v = toDimension(m[1]); if (v) maxHeight = best(maxHeight, rank, v); continue }
    m = util.match(/^aspect-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) aspectRatio = best(aspectRatio, rank, v); continue }
    if (util === 'aspect-square') { aspectRatio = best(aspectRatio, rank, '1 / 1'); continue }
    if (util === 'aspect-video') { aspectRatio = best(aspectRatio, rank, '16 / 9'); continue }

    if (util === 'flex-row') { flexDir = best(flexDir, rank, 'row'); continue }
    if (util === 'flex-col') { flexDir = best(flexDir, rank, 'column'); continue }
    if (util === 'flex-wrap') { flexWrap = best(flexWrap, rank, 'wrap'); continue }
    if (util === 'flex-nowrap') { flexWrap = best(flexWrap, rank, 'nowrap'); continue }
    if (util === 'items-start') { alignItems = best(alignItems, rank, 'flex-start'); continue }
    if (util === 'items-center') { alignItems = best(alignItems, rank, 'center'); continue }
    if (util === 'items-end') { alignItems = best(alignItems, rank, 'flex-end'); continue }
    if (util === 'items-stretch') { alignItems = best(alignItems, rank, 'stretch'); continue }
    if (util === 'items-baseline') { alignItems = best(alignItems, rank, 'baseline'); continue }
    if (util === 'justify-items-start') { justifyItems = best(justifyItems, rank, 'start'); continue }
    if (util === 'justify-items-center') { justifyItems = best(justifyItems, rank, 'center'); continue }
    if (util === 'justify-items-end') { justifyItems = best(justifyItems, rank, 'end'); continue }
    if (util === 'justify-items-stretch') { justifyItems = best(justifyItems, rank, 'stretch'); continue }
    if (util === 'justify-start') { justifyContent = best(justifyContent, rank, 'flex-start'); continue }
    if (util === 'justify-center') { justifyContent = best(justifyContent, rank, 'center'); continue }
    if (util === 'justify-end') { justifyContent = best(justifyContent, rank, 'flex-end'); continue }
    if (util === 'justify-between') { justifyContent = best(justifyContent, rank, 'space-between'); continue }
    if (util === 'justify-around') { justifyContent = best(justifyContent, rank, 'space-around'); continue }
    if (util === 'justify-evenly') { justifyContent = best(justifyContent, rank, 'space-evenly'); continue }
    if (util === 'content-start') { alignContent = best(alignContent, rank, 'flex-start'); continue }
    if (util === 'content-center') { alignContent = best(alignContent, rank, 'center'); continue }
    if (util === 'content-end') { alignContent = best(alignContent, rank, 'flex-end'); continue }
    if (util === 'content-between') { alignContent = best(alignContent, rank, 'space-between'); continue }
    if (util === 'content-around') { alignContent = best(alignContent, rank, 'space-around'); continue }
    if (util === 'content-evenly') { alignContent = best(alignContent, rank, 'space-evenly'); continue }

    if (util === 'grid-flow-row') { gridAutoFlow = best(gridAutoFlow, rank, 'row'); continue }
    if (util === 'grid-flow-col') { gridAutoFlow = best(gridAutoFlow, rank, 'column'); continue }
    if (util === 'grid-flow-row-dense') { gridAutoFlow = best(gridAutoFlow, rank, 'row dense'); continue }
    if (util === 'grid-flow-col-dense') { gridAutoFlow = best(gridAutoFlow, rank, 'column dense'); continue }
    m = util.match(/^auto-rows-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) gridAutoRowsArb = best(gridAutoRowsArb, rank, v); continue }
    m = util.match(/^auto-cols-\[(.+)\]$/)
    if (m) { const v = unbracket(`[${m[1]}]`); if (v) gridAutoColsArb = best(gridAutoColsArb, rank, v); continue }
    if (util === 'auto-rows-auto') { gridAutoRows = best(gridAutoRows, rank, 'auto'); continue }
    if (util === 'auto-rows-min') { gridAutoRows = best(gridAutoRows, rank, 'min-content'); continue }
    if (util === 'auto-rows-max') { gridAutoRows = best(gridAutoRows, rank, 'max-content'); continue }
    if (util === 'auto-rows-fr') { gridAutoRows = best(gridAutoRows, rank, 'minmax(0,1fr)'); continue }
    if (util === 'auto-cols-auto') { gridAutoCols = best(gridAutoCols, rank, 'auto'); continue }
    if (util === 'auto-cols-min') { gridAutoCols = best(gridAutoCols, rank, 'min-content'); continue }
    if (util === 'auto-cols-max') { gridAutoCols = best(gridAutoCols, rank, 'max-content'); continue }
    if (util === 'auto-cols-fr') { gridAutoCols = best(gridAutoCols, rank, 'minmax(0,1fr)'); continue }

    m = util.match(/^col-span-(\d+)$/)
    if (m) { const v = toSpanValue(m[1]); if (v != null) colSpan = best(colSpan, rank, v); continue }
    if (util === 'col-span-full') { colSpanFull = best(colSpanFull, rank, true); continue }
    m = util.match(/^row-span-(\d+)$/)
    if (m) { const v = toSpanValue(m[1]); if (v != null) rowSpan = best(rowSpan, rank, v); continue }
    if (util === 'row-span-full') { rowSpanFull = best(rowSpanFull, rank, true); continue }
    m = util.match(/^col-start-(\d+)$/)
    if (m) { const v = toIndexValue(m[1]); if (v != null) colStart = best(colStart, rank, v); continue }
    m = util.match(/^col-end-(\d+)$/)
    if (m) { const v = toIndexValue(m[1]); if (v != null) colEnd = best(colEnd, rank, v); continue }
    m = util.match(/^row-start-(\d+)$/)
    if (m) { const v = toIndexValue(m[1]); if (v != null) rowStart = best(rowStart, rank, v); continue }
    m = util.match(/^row-end-(\d+)$/)
    if (m) { const v = toIndexValue(m[1]); if (v != null) rowEnd = best(rowEnd, rank, v); continue }

    if (util === 'flex-1') { flex = best(flex, rank, '1 1 0%'); continue }
    if (util === 'flex-auto') { flex = best(flex, rank, '1 1 auto'); continue }
    if (util === 'flex-initial') { flex = best(flex, rank, '0 1 auto'); continue }
    if (util === 'flex-none') { flex = best(flex, rank, 'none'); continue }

    m = util.match(/^(p|px|py|pt|pr|pb|pl)-(\d{1,2})$/)
    if (m) {
      const r = toSpacingRem(m[2])
      if (r == null) continue
      const v = `${r}rem`
      const kind = m[1]
      if (kind === 'p' || kind === 'pt') padT = best(padT, rank, v)
      if (kind === 'p' || kind === 'pr') padR = best(padR, rank, v)
      if (kind === 'p' || kind === 'pb') padB = best(padB, rank, v)
      if (kind === 'p' || kind === 'pl') padL = best(padL, rank, v)
      if (kind === 'px') { padL = best(padL, rank, v); padR = best(padR, rank, v) }
      if (kind === 'py') { padT = best(padT, rank, v); padB = best(padB, rank, v) }
      continue
    }
    m = util.match(/^(m|mx|my|mt|mr|mb|ml)-(\d{1,2})$/)
    if (m) {
      const r = toSpacingRem(m[2])
      if (r == null) continue
      const v = `${r}rem`
      const kind = m[1]
      if (kind === 'm' || kind === 'mt') marT = best(marT, rank, v)
      if (kind === 'm' || kind === 'mr') marR = best(marR, rank, v)
      if (kind === 'm' || kind === 'mb') marB = best(marB, rank, v)
      if (kind === 'm' || kind === 'ml') marL = best(marL, rank, v)
      if (kind === 'mx') { marL = best(marL, rank, v); marR = best(marR, rank, v) }
      if (kind === 'my') { marT = best(marT, rank, v); marB = best(marB, rank, v) }
      continue
    }

    if (util === 'border') { borderWidth = best(borderWidth, rank, '1px'); continue }
    m = util.match(/^border-(\d)$/)
    if (m) {
      const n = Number.parseInt(m[1], 10)
      if (n >= 0 && n <= 8) borderWidth = best(borderWidth, rank, `${n}px`)
      continue
    }
    m = util.match(/^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/)
    if (m) {
      const kind = m[1] || 'md'
      const map: Record<string, string> = {
        none: '0px',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      }
      borderRadius = best(borderRadius, rank, map[kind] || map.md)
      continue
    }
    if (/^border-(transparent|black|white)$/.test(util)) {
      const color = util.replace(/^border-/, '')
      borderColor = best(borderColor, rank, color)
      continue
    }
    if (/^shadow(?:-(sm|md|lg|xl|2xl|none))?$/.test(util)) {
      const kind = (util.match(/^shadow(?:-(sm|md|lg|xl|2xl|none))?$/)?.[1]) || 'md'
      const map: Record<string, string> = {
        none: 'none',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      }
      boxShadow = best(boxShadow, rank, map[kind] || map.md)
      continue
    }
    if (util === 'overflow-hidden') { overflow = best(overflow, rank, 'hidden'); continue }
    if (util === 'overflow-auto') { overflow = best(overflow, rank, 'auto'); continue }
    if (util === 'overflow-scroll') { overflow = best(overflow, rank, 'scroll'); continue }
    if (util === 'overflow-visible') { overflow = best(overflow, rank, 'visible'); continue }
    if (util === 'overflow-x-hidden') { overflowX = best(overflowX, rank, 'hidden'); continue }
    if (util === 'overflow-x-auto') { overflowX = best(overflowX, rank, 'auto'); continue }
    if (util === 'overflow-x-scroll') { overflowX = best(overflowX, rank, 'scroll'); continue }
    if (util === 'overflow-x-visible') { overflowX = best(overflowX, rank, 'visible'); continue }
    if (util === 'overflow-y-hidden') { overflowY = best(overflowY, rank, 'hidden'); continue }
    if (util === 'overflow-y-auto') { overflowY = best(overflowY, rank, 'auto'); continue }
    if (util === 'overflow-y-scroll') { overflowY = best(overflowY, rank, 'scroll'); continue }
    if (util === 'overflow-y-visible') { overflowY = best(overflowY, rank, 'visible'); continue }
  }

  const out: React.CSSProperties = {}
  if (display) out.display = display.value as React.CSSProperties['display']
  if (tableLayout) out.tableLayout = tableLayout.value as React.CSSProperties['tableLayout']
  if (borderCollapse) out.borderCollapse = borderCollapse.value as React.CSSProperties['borderCollapse']
  if (gridCols) out.gridTemplateColumns = `repeat(${gridCols.value}, minmax(0, 1fr))`
  if (gridRows) out.gridTemplateRows = `repeat(${gridRows.value}, minmax(0, 1fr))`
  if (gridColsArb) out.gridTemplateColumns = gridColsArb.value
  if (gridRowsArb) out.gridTemplateRows = gridRowsArb.value
  if (gridAutoFlow) out.gridAutoFlow = gridAutoFlow.value as React.CSSProperties['gridAutoFlow']
  if (gridAutoRows) out.gridAutoRows = gridAutoRows.value as React.CSSProperties['gridAutoRows']
  if (gridAutoCols) out.gridAutoColumns = gridAutoCols.value as React.CSSProperties['gridAutoColumns']
  if (gridAutoRowsArb) out.gridAutoRows = gridAutoRowsArb.value as React.CSSProperties['gridAutoRows']
  if (gridAutoColsArb) out.gridAutoColumns = gridAutoColsArb.value as React.CSSProperties['gridAutoColumns']
  if (flexDir) out.flexDirection = flexDir.value as React.CSSProperties['flexDirection']
  if (flexWrap) out.flexWrap = flexWrap.value as React.CSSProperties['flexWrap']
  if (alignItems) out.alignItems = alignItems.value as React.CSSProperties['alignItems']
  if (justifyItems) out.justifyItems = justifyItems.value as React.CSSProperties['justifyItems']
  if (justifyContent) out.justifyContent = justifyContent.value as React.CSSProperties['justifyContent']
  if (alignContent) out.alignContent = alignContent.value as React.CSSProperties['alignContent']
  if (width) out.width = width.value as React.CSSProperties['width']
  if (height) out.height = height.value as React.CSSProperties['height']
  if (minWidth) out.minWidth = minWidth.value as React.CSSProperties['minWidth']
  if (minHeight) out.minHeight = minHeight.value as React.CSSProperties['minHeight']
  if (maxWidth) out.maxWidth = maxWidth.value as React.CSSProperties['maxWidth']
  if (maxHeight) out.maxHeight = maxHeight.value as React.CSSProperties['maxHeight']
  if (aspectRatio) (out as unknown as { aspectRatio?: string }).aspectRatio = aspectRatio.value
  if (gap) out.gap = `${gap.value}rem`
  if (gapArb) out.gap = gapArb.value
  if (gapX) out.columnGap = `${gapX.value}rem`
  if (gapXArb) out.columnGap = gapXArb.value
  if (gapY) out.rowGap = `${gapY.value}rem`
  if (gapYArb) out.rowGap = gapYArb.value
  if (columns) out.columnCount = columns.value
  if (flex) out.flex = flex.value as React.CSSProperties['flex']
  if (padT) out.paddingTop = padT.value as React.CSSProperties['paddingTop']
  if (padR) out.paddingRight = padR.value as React.CSSProperties['paddingRight']
  if (padB) out.paddingBottom = padB.value as React.CSSProperties['paddingBottom']
  if (padL) out.paddingLeft = padL.value as React.CSSProperties['paddingLeft']
  if (marT) out.marginTop = marT.value as React.CSSProperties['marginTop']
  if (marR) out.marginRight = marR.value as React.CSSProperties['marginRight']
  if (marB) out.marginBottom = marB.value as React.CSSProperties['marginBottom']
  if (marL) out.marginLeft = marL.value as React.CSSProperties['marginLeft']
  if (borderWidth) {
    out.borderWidth = borderWidth.value as React.CSSProperties['borderWidth']
    out.borderStyle = 'solid'
  }
  if (borderColor) out.borderColor = borderColor.value as React.CSSProperties['borderColor']
  if (borderRadius) out.borderRadius = borderRadius.value as React.CSSProperties['borderRadius']
  if (boxShadow) out.boxShadow = boxShadow.value as React.CSSProperties['boxShadow']
  if (overflow) out.overflow = overflow.value as React.CSSProperties['overflow']
  if (overflowX) out.overflowX = overflowX.value as React.CSSProperties['overflowX']
  if (overflowY) out.overflowY = overflowY.value as React.CSSProperties['overflowY']
  if (colSpanFull) {
    out.gridColumn = '1 / -1'
  } else if (colStart || colEnd) {
    const start = colStart?.value
    const end = colEnd?.value
    if (start != null && end != null) out.gridColumn = `${start} / ${end}`
    else if (start != null && colSpan) out.gridColumn = `${start} / span ${colSpan.value}`
    else if (start != null) out.gridColumn = `${start}`
    else if (end != null) out.gridColumn = `auto / ${end}`
  } else if (colSpan) {
    out.gridColumn = `span ${colSpan.value} / span ${colSpan.value}`
  }
  if (rowSpanFull) {
    out.gridRow = '1 / -1'
  } else if (rowStart || rowEnd) {
    const start = rowStart?.value
    const end = rowEnd?.value
    if (start != null && end != null) out.gridRow = `${start} / ${end}`
    else if (start != null && rowSpan) out.gridRow = `${start} / span ${rowSpan.value}`
    else if (start != null) out.gridRow = `${start}`
    else if (end != null) out.gridRow = `auto / ${end}`
  } else if (rowSpan) {
    out.gridRow = `span ${rowSpan.value} / span ${rowSpan.value}`
  }
  return Object.keys(out).length ? out : undefined
}
