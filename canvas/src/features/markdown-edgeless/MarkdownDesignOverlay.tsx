import React from 'react'
import * as d3 from 'd3'
import { Expand } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lexMarkdown, buildMarkdownTokensKey } from '@/features/markdown/ui/markdownPreviewLex'
import {
  PANEL_FRAME_BODY_STYLE,
  PANEL_FRAME_HEADER_ACTION_STYLE,
  PANEL_FRAME_HEADER_STYLE,
  PANEL_FRAME_HEADER_TITLE_STYLE,
  PANEL_FRAME_ROOT_STYLE,
} from '@/lib/ui/panelFrame'
import {
  deriveMarkdownDesignLayout,
  patchMarkdownDesignLayoutPositions,
  MARKDOWN_DESIGN_LAYOUT,
  type MarkdownDesignBlock,
} from './markdownDesignLayout'
import { startMarkdownPanelOverlayLoop2d } from './markdownPanelOverlayLoop2d'

type MarkdownDesignOverlayProps = {
  enabled: boolean
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  onPreviewClick?: (line: number) => void
  allowedKinds?: ReadonlyArray<'table' | 'code' | 'blockquote'> | null
}

export const MarkdownDesignOverlay = React.memo(function MarkdownDesignOverlay(props: MarkdownDesignOverlayProps) {
  const { enabled, svgRef, markdownDocumentName, markdownDocumentText, onPreviewClick } = props

  const activeDocumentPath = String(markdownDocumentName || '').trim() || 'markdown'
  const markdownText = String(markdownDocumentText || '')

  const markdownTokensKey = React.useMemo(() => (markdownText ? buildMarkdownTokensKey(markdownText) : null), [markdownText])
  const lexed = React.useMemo(() => (markdownText ? lexMarkdown(markdownText) : { tokens: [] as any[] }), [markdownText])
  const layout = React.useMemo(
    () =>
      markdownText
        ? deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
        : null,
    [activeDocumentPath, lexed.tokens, markdownText, markdownTokensKey],
  )

  const [blocks, setBlocks] = React.useState<MarkdownDesignBlock[]>(layout?.blocks || [])
  React.useEffect(() => {
    setBlocks(layout?.blocks || [])
  }, [layout?.blocks])

  const blocksRef = React.useRef<MarkdownDesignBlock[]>(blocks)
  React.useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  const overlayElsRef = React.useRef<Map<string, HTMLElement>>(new Map())

  const allowedKindsSet = React.useMemo(() => {
    const raw = Array.isArray(props.allowedKinds) ? props.allowedKinds : null
    if (!raw || raw.length === 0) return null
    return new Set(raw)
  }, [props.allowedKinds])

  const allowedKindsRef = React.useRef<Set<string> | null>(allowedKindsSet)
  React.useEffect(() => {
    allowedKindsRef.current = allowedKindsSet
  }, [allowedKindsSet])

  const visibleBlocks = React.useMemo(() => {
    if (!allowedKindsSet) return blocks
    return blocks.filter(b => allowedKindsSet.has(b.type as never))
  }, [allowedKindsSet, blocks])

  const blockIdsKey = React.useMemo(() => visibleBlocks.map(b => b.id).join('|'), [visibleBlocks])
  React.useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const b of visibleBlocks) {
      const existing = overlayElsRef.current.get(b.id)
      if (existing) next.set(b.id, existing)
    }
    overlayElsRef.current = next
  }, [blockIdsKey, visibleBlocks])

  const [drag, setDrag] = React.useState<null | { pointerId: number; blockId: string; startX: number; startY: number; startK: number; startClientX: number; startClientY: number }>(null)
  const dragging = drag != null

  const viewportRef = React.useRef<{ w: number; h: number }>({ w: 1, h: 1 })
  React.useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const rect = svgEl.getBoundingClientRect()
      const w = Number.isFinite(rect.width) ? Math.max(1, Math.floor(rect.width)) : 1
      const h = Number.isFinite(rect.height) ? Math.max(1, Math.floor(rect.height)) : 1
      viewportRef.current = { w, h }
    })
    ro.observe(svgEl)
    return () => ro.disconnect()
  }, [svgRef])

  React.useEffect(() => {
    if (!enabled) return
    if (!layout) return
    const svgEl = svgRef.current
    if (!svgEl) return

    const getDensity = () => {
      const st = useGraphStore.getState()
      return st.mediaPanelDensity === 'compact' ? 'compact' : 'default'
    }

    const getSizingConfig = () => {
      const st = useGraphStore.getState()
      const density = st.mediaPanelDensity === 'compact' ? 'compact' : 'default'
      const widthRatioRaw = density === 'compact' ? st.threeIframeOverlayBaseWidthRatioCompact : st.threeIframeOverlayBaseWidthRatioDefault
      const widthMinRaw = density === 'compact' ? st.threeIframeOverlayBaseWidthMinPxCompact : st.threeIframeOverlayBaseWidthMinPxDefault
      const widthMaxRaw = density === 'compact' ? st.threeIframeOverlayBaseWidthMaxPxCompact : st.threeIframeOverlayBaseWidthMaxPxDefault
      return {
        widthRatio: Number.isFinite(widthRatioRaw) ? Math.max(0.001, Number(widthRatioRaw)) : 0.2,
        widthMinPx: Number.isFinite(widthMinRaw) ? Math.max(1, Math.floor(widthMinRaw)) : 210,
        widthMaxPx: Number.isFinite(widthMaxRaw) ? Math.max(1, Math.floor(widthMaxRaw)) : 360,
      }
    }

    const loop = startMarkdownPanelOverlayLoop2d({
      enabled: true,
      loop: 'always',
      getItems: () => {
        const src = blocksRef.current
        const allow = allowedKindsRef.current
        if (!allow) {
          return src.map(b => ({ id: b.id, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }))
        }
        return src
          .filter(b => allow.has(b.type as never))
          .map(b => ({ id: b.id, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }))
      },
      getViewport: () => viewportRef.current,
      readTransform: () => (svgRef.current ? d3.zoomTransform(svgRef.current) : null),
      getElementForId: id => overlayElsRef.current.get(id) || null,
      getDensity,
      getSizingConfig,
      clampToViewport: { margin: 10 },
    })

    return () => loop.stop()
  }, [enabled, layout, svgRef])

  React.useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (!drag) return
      if (e.pointerId !== drag.pointerId) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const t = d3.zoomTransform(svgEl)
      const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : drag.startK || 1
      const dx = (e.clientX - drag.startClientX) / k
      const dy = (e.clientY - drag.startClientY) / k
      setBlocks(prev => prev.map(b => (b.id === drag.blockId ? { ...b, x: drag.startX + dx, y: drag.startY + dy } : b)))
    }

    const onUp = (e: PointerEvent) => {
      if (!drag) return
      if (e.pointerId !== drag.pointerId) return
      const moved = blocks.find(b => b.id === drag.blockId)
      if (moved && layout) {
        patchMarkdownDesignLayoutPositions({ layoutKey: layout.key, updates: [{ id: moved.id, x: moved.x, y: moved.y }] })
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove, { capture: true })
    window.addEventListener('pointerup', onUp, { capture: true })
    window.addEventListener('pointercancel', onUp, { capture: true })
    return () => {
      window.removeEventListener('pointermove', onMove, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointerup', onUp, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', onUp, { capture: true } as AddEventListenerOptions)
    }
  }, [blocks, drag, dragging, layout, svgRef])

  if (!enabled || !layout || visibleBlocks.length === 0) return null

  const onHeaderActionPointerDownCapture = (e: React.PointerEvent<HTMLElement>) => {
    try {
      e.stopPropagation()
    } catch {
      void 0
    }
  }

  const renderBlockBody = (b: MarkdownDesignBlock) => {
    const p = b.preview
    if (p.kind === 'heading') {
      const depth = typeof p.headingDepth === 'number' ? p.headingDepth : 1
      const sizeClass = depth <= 1 ? 'text-base' : depth === 2 ? 'text-sm' : 'text-xs'
      return <p className={[sizeClass, 'font-semibold', UI_THEME_TOKENS.text.primary].join(' ')}>{b.title}</p>
    }
    if (p.kind === 'list') {
      const items = Array.isArray(p.listItems) ? p.listItems.filter(it => String(it.text || '').trim()) : []
      const ListTag = p.ordered ? 'ol' : 'ul'
      return (
        <ListTag className="m-0 pl-4 space-y-1" aria-label="List preview">
          {items.slice(0, 6).map((it, idx) => (
            <li key={idx} className={UI_THEME_TOKENS.text.primary}>
              {it.task ? (
                <span className={['mr-1', UI_THEME_TOKENS.text.secondary].join(' ')}>{it.checked ? '☑' : '☐'}</span>
              ) : null}
              {it.text}
            </li>
          ))}
          {items.length === 0 ? <li className={UI_THEME_TOKENS.text.tertiary}>—</li> : null}
        </ListTag>
      )
    }
    if (p.kind === 'table') {
      const t = p.table
      if (!t) return null
      const cols = t.columns || []
      const rows = t.rows || []
      return (
        <table className="w-full text-[11px] border-collapse" aria-label="Table preview">
          <caption className={['mb-1 text-[10px] text-left', UI_THEME_TOKENS.text.secondary].join(' ')}>
            {t.rowCount ? `${t.rowCount} row${t.rowCount === 1 ? '' : 's'}` : 'Table'}
          </caption>
          {cols.length ? (
            <thead>
              <tr>
                {cols.map(c => (
                  <th
                    key={c}
                    className={['text-left font-semibold px-2 py-1 border-b', UI_THEME_TOKENS.panel.divider, UI_THEME_TOKENS.text.primary].join(' ')}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.slice(0, 4).map((r, i) => (
              <tr key={i}>
                {r.slice(0, cols.length || 6).map((cell, j) => (
                  <td key={j} className={['px-2 py-1 border-b align-top', UI_THEME_TOKENS.panel.divider, UI_THEME_TOKENS.text.secondary].join(' ')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    if (p.kind === 'code') {
      const c = p.code
      const lang = c?.lang || ''
      const code = (c?.lines || []).join('\n')
      return (
        <pre
          className={['m-0 text-[11px] overflow-hidden rounded border p-2', UI_THEME_TOKENS.code.bg, UI_THEME_TOKENS.code.border].join(' ')}
          aria-label="Code preview"
        >
          <code className={UI_THEME_TOKENS.code.text}>
            {lang ? `// ${lang}\n${code}` : code}
          </code>
        </pre>
      )
    }
    if (p.kind === 'callout') {
      const c = p.callout
      const label = String(c?.calloutType || 'callout').toUpperCase()
      const title = String(c?.title || b.title)
      return (
        <section aria-label="Callout preview">
          <div className="flex items-center gap-2">
            <span className={['text-[10px] px-1.5 py-0.5 rounded', UI_THEME_TOKENS.badge.chip, UI_THEME_TOKENS.text.secondary].join(' ')}>{label}</span>
            <span className={['text-xs font-semibold truncate', UI_THEME_TOKENS.text.primary].join(' ')}>{title}</span>
          </div>
          {b.summary ? <p className={['mt-2 text-xs', UI_THEME_TOKENS.text.secondary].join(' ')}>{b.summary}</p> : null}
        </section>
      )
    }
    if (p.kind === 'blockquote') {
      const lines = p.blockquote?.lines || []
      return (
        <blockquote
          className={['m-0 border-l-2 pl-3 py-1', UI_THEME_TOKENS.panel.divider].join(' ')}
          aria-label="Blockquote preview"
        >
          {lines.length ? (
            lines.slice(0, 4).map((line, idx) => (
              <p key={idx} className={['m-0 text-xs italic', UI_THEME_TOKENS.text.primary].join(' ')}>
                {line}
              </p>
            ))
          ) : (
            <p className={['m-0 text-xs italic', UI_THEME_TOKENS.text.tertiary].join(' ')}>—</p>
          )}
        </blockquote>
      )
    }
    if (b.summary) return <p className={UI_THEME_TOKENS.text.primary}>{b.summary}</p>
    return <p className={UI_THEME_TOKENS.text.tertiary}>—</p>
  }

  const maskBorderRadiusPx = (() => {
    const svgEl = svgRef.current
    if (!svgEl) return MARKDOWN_DESIGN_LAYOUT.block.cornerPx
    const t = d3.zoomTransform(svgEl)
    const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    return Math.max(1, MARKDOWN_DESIGN_LAYOUT.block.cornerPx / k)
  })()

  return (
    <section aria-label="Design markdown overlay" className="absolute inset-0 z-[70] pointer-events-none">
      {dragging ? (
        <aside
          className="affine-note-mask"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'auto',
            borderRadius: `${maskBorderRadiusPx}px`,
          }}
          aria-hidden="true"
        />
      ) : null}

      {visibleBlocks.map(b => {
        return (
          <article
            key={b.id}
            ref={el => {
              if (!el) {
                overlayElsRef.current.delete(b.id)
                return
              }
              overlayElsRef.current.set(b.id, el)
            }}
            className={['absolute left-0 top-0 pointer-events-auto select-none', UI_THEME_TOKENS.panel.border].join(' ')}
            role="group"
            aria-label={`Block ${b.title}`}
            style={{
              ...PANEL_FRAME_ROOT_STYLE,
              transform: 'translate(-99999px, -99999px)',
              width: 1,
              height: 1,
            }}
            onDoubleClick={() => void 0}
          >
            <header
              data-kg-media-panel-header="1"
              className={['border-b', UI_THEME_TOKENS.panel.divider].join(' ')}
              style={{
                ...PANEL_FRAME_HEADER_STYLE,
                cursor: 'grab',
                pointerEvents: 'auto',
              }}
              onPointerDown={e => {
                if (e.button !== 0) return
                const svgEl = svgRef.current
                if (!svgEl) return
                e.stopPropagation()
                const t = d3.zoomTransform(svgEl)
                const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
                setDrag({
                  pointerId: e.pointerId,
                  blockId: b.id,
                  startX: b.x,
                  startY: b.y,
                  startK: k,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                })
              }}
              onDoubleClick={() => {
                onPreviewClick?.(b.startLine)
              }}
            >
              <h3 style={PANEL_FRAME_HEADER_TITLE_STYLE}>{b.title}</h3>
              {onPreviewClick ? (
                <menu className="m-0 p-0 list-none flex items-center gap-1" aria-label="Block actions">
                  <li className="list-none">
                    <button
                      type="button"
                      data-kg-panel-action="1"
                      aria-label="Reveal block in editor"
                      style={PANEL_FRAME_HEADER_ACTION_STYLE}
                      onPointerDownCapture={onHeaderActionPointerDownCapture}
                      onClick={e => {
                        try {
                          e.preventDefault()
                        } catch {
                          void 0
                        }
                        try {
                          e.stopPropagation()
                        } catch {
                          void 0
                        }
                        onPreviewClick(b.startLine)
                      }}
                    >
                      <Expand size={14} aria-hidden="true" />
                    </button>
                  </li>
                </menu>
              ) : null}
            </header>
            <section
              className="text-xs overflow-hidden"
              aria-label="Block content"
              style={{
                ...PANEL_FRAME_BODY_STYLE,
              }}
            >
              {renderBlockBody(b)}
              <footer className={['mt-2 text-[10px]', UI_THEME_TOKENS.text.secondary].join(' ')} aria-label="Block metadata">
                {`Lines ${b.startLine}-${b.endLine}`}
              </footer>
            </section>
          </article>
        )
      })}
    </section>
  )
})
