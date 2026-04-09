import React from 'react'
import * as d3 from 'd3'
import { Expand } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import RichMediaIframe from '@/components/RichMediaIframe'
import { lexMarkdown, buildMarkdownTokensKey } from '@/features/markdown/ui/markdownPreviewLex'
import { extractHtmlAttr, looksLikeSingleTagBlock } from 'grph-shared/markdown/mediaHtml'
import { sanitizeIframeSrcdoc } from '@/lib/render/sanitizeIframeSrcdoc'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { patchById } from 'grph-shared/array/patchArrayItem'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
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
  type MarkdownDesignLayout,
} from '@/features/markdown-edgeless/markdownDesignLayout'
import { startMarkdownPanelOverlayLoop2d } from '@/features/markdown-edgeless/markdownPanelOverlayLoop2d'

type MarkdownDesignOverlayProps = {
  enabled: boolean
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  onPreviewClick?: (line: number) => void
  allowedKinds?: ReadonlyArray<'table' | 'code' | 'blockquote' | 'callout' | 'html'> | null
  layoutOverride?: MarkdownDesignLayout | null
  anchorNodeIdByBlockId?: Record<string, string> | null
  getNodeWorldCenterForId?: (id: string) => { x: number; y: number } | null
  stopEvent?: (e: React.SyntheticEvent) => void
  requestOverlayScheduleRef?: React.MutableRefObject<(() => void) | null>
  onOverlayPanStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onOverlayPan?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onOverlayPanEnd?: (args: { pointerId: number }) => void
  onHeaderDragStart?: (args: { id: string; clientX: number; clientY: number }) => void
  onHeaderDrag?: (args: { dx: number; dy: number }) => void
  onHeaderDragEnd?: () => void
  onVisibleNodeIdsChange?: (nodeIds: string[]) => void
}

export const MarkdownDesignOverlay = React.memo(function MarkdownDesignOverlay(props: MarkdownDesignOverlayProps) {
  const { enabled, svgRef, markdownDocumentName, markdownDocumentText, onPreviewClick } = props
  const allowDrag = !props.layoutOverride
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const allowEmbeddedContentInteraction = infiniteCanvasInteractionMode === 'interactive'

  const activeDocumentPath = String(markdownDocumentName || '').trim() || 'markdown'
  const markdownText = String(markdownDocumentText || '')

  const deferredMarkdownText = React.useDeferredValue(markdownText)
  const markdownTokensKey = React.useMemo(() => (deferredMarkdownText ? buildMarkdownTokensKey(deferredMarkdownText) : null), [deferredMarkdownText])
  const lexed = React.useMemo(() => (deferredMarkdownText ? lexMarkdown(deferredMarkdownText) : { tokens: [] as any[] }), [deferredMarkdownText])
  const layout = React.useMemo(() => {
    if (props.layoutOverride) return props.layoutOverride
    if (!deferredMarkdownText) return null
    return deriveMarkdownDesignLayout({ activeDocumentPath, markdownTokensKey, tokens: lexed.tokens as never })
  }, [activeDocumentPath, lexed.tokens, deferredMarkdownText, markdownTokensKey, props.layoutOverride])

  const lastLayoutRef = React.useRef<MarkdownDesignLayout | null>(layout)
  React.useEffect(() => {
    if (layout) lastLayoutRef.current = layout
  }, [layout])
  const layoutForRender = layout || lastLayoutRef.current

  const [blocks, setBlocks] = React.useState<MarkdownDesignBlock[]>(layoutForRender?.blocks || [])
  const lastStableBlocksRef = React.useRef<MarkdownDesignBlock[]>(layoutForRender?.blocks || [])
  React.useEffect(() => {
    const next = Array.isArray(layoutForRender?.blocks) ? layoutForRender!.blocks : []
    if (next.length > 0) {
      lastStableBlocksRef.current = next
      setBlocks(next)
      return
    }
    if (!enabled) {
      lastStableBlocksRef.current = []
      setBlocks([])
      return
    }
    if (lastStableBlocksRef.current.length > 0) {
      setBlocks(lastStableBlocksRef.current)
      return
    }
    setBlocks([])
  }, [enabled, layoutForRender?.blocks])

  const blocksRef = React.useRef<MarkdownDesignBlock[]>(blocks)
  React.useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  const anchorByBlockIdRef = React.useRef<Record<string, string> | null>(props.anchorNodeIdByBlockId || null)
  React.useEffect(() => {
    anchorByBlockIdRef.current = props.anchorNodeIdByBlockId || null
  }, [props.anchorNodeIdByBlockId])

  const wheelCleanupByIdRef = React.useRef<Map<string, () => void>>(new Map())
  const overlayRefFnByIdRef = React.useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())

  React.useEffect(() => {
    return () => {
      const m = wheelCleanupByIdRef.current
      for (const cleanup of m.values()) {
        try {
          cleanup()
        } catch {
          void 0
        }
      }
      m.clear()
    }
  }, [])

  const getOverlayRefForId = React.useCallback(
    (id: string) => {
      const key = String(id || '').trim()
      const cached = overlayRefFnByIdRef.current.get(key)
      if (cached) return cached
      const fn = (el: HTMLElement | null) => {
        const prevCleanup = wheelCleanupByIdRef.current.get(key)
        if (prevCleanup) {
          wheelCleanupByIdRef.current.delete(key)
          try {
            prevCleanup()
          } catch {
            void 0
          }
        }

        if (!el) {
          overlayElsRef.current.delete(key)
          return
        }

        overlayElsRef.current.set(key, el)
        if (!allowEmbeddedContentInteraction) {
          try {
            const cleanup = installWheelForwardingAndBrowserZoomGuards(el, {
              forwardWheelTo: () => svgRef.current,
              stopPropagationOnForward: true,
              stopPropagationOnPreventZoom: false,
              forwardedFlagKey: '__kgForwarded',
            })
            if (cleanup) wheelCleanupByIdRef.current.set(key, cleanup)
          } catch {
            void 0
          }
        }
      }
      overlayRefFnByIdRef.current.set(key, fn)
      return fn
    },
    [allowEmbeddedContentInteraction, svgRef],
  )

  const shouldStartHeaderDrag = React.useCallback((native: PointerEvent) => {
    if (useGraphStore.getState().canvasPointerMode2d === 'pan') return false
    if (isSpacePanHeld()) return false
    return true
  }, [])

  const startHeaderDrag = React.useCallback(
    (args0: { blockId: string; clientX: number; clientY: number; native: PointerEvent }) => {
      const anchor = anchorByBlockIdRef.current
      const anchorId = String(anchor?.[args0.blockId] || args0.blockId)
      if (!anchorId) return
      try {
        const st = useGraphStore.getState() as unknown as { selectNode?: (id: string | null) => void; selectEdge?: (id: string | null) => void; setSelectionSource?: (src: string) => void }
        st.setSelectionSource?.('canvas')
        st.selectEdge?.(null)
        st.selectNode?.(null)
      } catch {
        void 0
      }
      try {
        props.onHeaderDragStart?.({ id: anchorId, clientX: args0.clientX, clientY: args0.clientY })
      } catch {
        void 0
      }
      const x0 = args0.clientX
      const y0 = args0.clientY
      startPointerDrag({
        ev: args0.native,
        cursor: 'grabbing',
        onMove: ev => {
          try {
            props.onHeaderDrag?.({ dx: ev.clientX - x0, dy: ev.clientY - y0 })
          } catch {
            void 0
          }
        },
        onEnd: () => {
          try {
            props.onHeaderDragEnd?.()
          } catch {
            void 0
          }
        },
        onCancel: () => {
          try {
            props.onHeaderDragEnd?.()
          } catch {
            void 0
          }
        },
      })
    },
    [props.onHeaderDrag, props.onHeaderDragEnd, props.onHeaderDragStart],
  )

  const startOverlayPan = React.useCallback(
    (native: PointerEvent) => {
      if (!props.onOverlayPanStart && !props.onOverlayPan && !props.onOverlayPanEnd) return
      const x0 = native.clientX
      const y0 = native.clientY
      try {
        const st = useGraphStore.getState() as unknown as { selectNode?: (id: string | null) => void; selectEdge?: (id: string | null) => void; setSelectionSource?: (src: string) => void }
        st.setSelectionSource?.('canvas')
        st.selectEdge?.(null)
        st.selectNode?.(null)
      } catch {
        void 0
      }
      try {
        props.onOverlayPanStart?.({ pointerId: native.pointerId, clientX: x0, clientY: y0 })
      } catch {
        void 0
      }
      startPointerDrag({
        ev: native,
        cursor: 'grabbing',
        onMove: ev => {
          try {
            props.onOverlayPan?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY, dx: ev.clientX - x0, dy: ev.clientY - y0 })
          } catch {
            void 0
          }
        },
        onEnd: ev => {
          try {
            props.onOverlayPanEnd?.({ pointerId: ev.pointerId })
          } catch {
            void 0
          }
        },
        onCancel: ev => {
          try {
            props.onOverlayPanEnd?.({ pointerId: ev.pointerId })
          } catch {
            void 0
          }
        },
      })
    },
    [props.onOverlayPan, props.onOverlayPanEnd, props.onOverlayPanStart],
  )

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
    return blocks.filter(b => {
      if (!allowedKindsSet.has(b.type as never)) return false
      if (b.preview.kind !== 'html') return true
      const raw = String(b.preview.html?.raw || '').trim()
      return /<\s*iframe\b/i.test(raw)
    })
  }, [allowedKindsSet, blocks])

  React.useEffect(() => {
    const out = new Set<string>()
    const anchor = anchorByBlockIdRef.current
    for (let i = 0; i < visibleBlocks.length; i += 1) {
      const b = visibleBlocks[i]!
      const id = String(b.id || '').trim()
      if (id) out.add(id)
      const anchorId = String(anchor?.[id] || '').trim()
      if (anchorId) out.add(anchorId)
    }
    try {
      props.onVisibleNodeIdsChange?.(Array.from(out))
    } catch {
      void 0
    }
  }, [props.onVisibleNodeIdsChange, visibleBlocks])

  const blockIdsKey = React.useMemo(() => visibleBlocks.map(b => b.id).join('|'), [visibleBlocks])
  React.useEffect(() => {
    const next = new Map<string, HTMLElement>()
    for (const b of visibleBlocks) {
      const existing = overlayElsRef.current.get(b.id)
      if (existing) next.set(b.id, existing)
    }
    overlayElsRef.current = next
  }, [blockIdsKey, visibleBlocks])

  const [drag, setDrag] = React.useState<null | { pointerId: number; blockId: string }>(null)
  const dragging = drag != null

  const blockDragLatestRef = React.useRef<null | { blockId: string; index: number; x: number; y: number }>(null)
  const blockDragSchedulerRef = React.useRef(
    createRafValueScheduler((latest: { blockId: string; index: number; x: number; y: number }) => {
      setBlocks(prev =>
        patchById(
          prev,
          latest.blockId,
          b => String(b?.id || ''),
          cur => (cur.x === latest.x && cur.y === latest.y ? cur : { ...cur, x: latest.x, y: latest.y }),
          latest.index,
        ),
      )
    }),
  )

  React.useEffect(() => {
    if (!dragging) return
    const end = () => {
      try {
        unlockGlobalUserSelect()
      } catch {
        void 0
      }
      setDrag(null)
    }
    const onVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') end()
      } catch {
        void 0
      }
    }
    window.addEventListener('pointerup', end, { capture: true })
    window.addEventListener('pointercancel', end, { capture: true })
    window.addEventListener('blur', end)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerup', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', end)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dragging])

  const overlayLayoutScheduleRef = React.useRef<null | (() => void)>(null)
  const viewportRef = React.useRef<{ w: number; h: number }>({ w: 1, h: 1 })
  React.useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const rect = svgEl.getBoundingClientRect()
      const w = Number.isFinite(rect.width) ? Math.max(1, Math.floor(rect.width)) : 1
      const h = Number.isFinite(rect.height) ? Math.max(1, Math.floor(rect.height)) : 1
      viewportRef.current = { w, h }
      overlayLayoutScheduleRef.current?.()
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
      loop: 'onDemand',
      getItems: () => {
        const src = blocksRef.current
        const allow = allowedKindsRef.current
        const anchor = anchorByBlockIdRef.current
        const getCenter = typeof props.getNodeWorldCenterForId === 'function' ? props.getNodeWorldCenterForId : null
        const pick = (b: MarkdownDesignBlock) => {
          const anchorId = String(anchor?.[b.id] || b.id)
          const c = getCenter ? getCenter(anchorId) : null
          const x = c ? c.x : b.x + b.w / 2
          const y = c ? c.y : b.y + b.h / 2
          return { id: b.id, cx: x, cy: y }
        }
        if (!allow) return src.map(pick)
        return src.filter(b => allow.has(b.type as never)).map(pick)
      },
      getViewport: () => viewportRef.current,
      readTransform: () => (svgRef.current ? d3.zoomTransform(svgRef.current) : null),
      getElementForId: id => overlayElsRef.current.get(id) || null,
      getDensity,
      getSizingConfig,
      clampToViewport: null,
    })

    overlayLayoutScheduleRef.current = loop.schedule
    if (props.requestOverlayScheduleRef) props.requestOverlayScheduleRef.current = loop.schedule
    loop.schedule()

    const pointerButtonsDownRef = { current: false }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        pointerButtonsDownRef.current = true
        loop.schedule()
        return
      }
      pointerButtonsDownRef.current = typeof e.buttons === 'number' ? e.buttons !== 0 : true
      loop.schedule()
    }
    const onPointerMove = () => {
      if (!pointerButtonsDownRef.current) return
      loop.schedule()
    }
    const onPointerEnd = () => {
      if (!pointerButtonsDownRef.current) return
      pointerButtonsDownRef.current = false
      loop.schedule()
    }
    const onWheel = () => {
      loop.schedule()
    }

    svgEl.addEventListener('pointerdown', onPointerDown, { passive: true })
    svgEl.addEventListener('pointermove', onPointerMove, { passive: true })
    svgEl.addEventListener('pointerup', onPointerEnd, { passive: true })
    svgEl.addEventListener('pointercancel', onPointerEnd, { passive: true })
    svgEl.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      loop.stop()
      svgEl.removeEventListener('pointerdown', onPointerDown)
      svgEl.removeEventListener('pointermove', onPointerMove)
      svgEl.removeEventListener('pointerup', onPointerEnd)
      svgEl.removeEventListener('pointercancel', onPointerEnd)
      svgEl.removeEventListener('wheel', onWheel)
      if (overlayLayoutScheduleRef.current === loop.schedule) {
        overlayLayoutScheduleRef.current = null
      }
      if (props.requestOverlayScheduleRef && props.requestOverlayScheduleRef.current === loop.schedule) {
        props.requestOverlayScheduleRef.current = null
      }
    }
  }, [enabled, layout, svgRef, props.requestOverlayScheduleRef])

  const startBlockDrag = React.useCallback((args0: { blockId: string; native: PointerEvent; clientX: number; clientY: number }) => {
    if (!allowDrag) return
    const svgEl = svgRef.current
    if (!svgEl) return
    const blockId = String(args0.blockId || '').trim()
    if (!blockId) return
    const b0 = blocksRef.current.find(b => String(b?.id || '') === blockId) || null
    if (!b0) return
    lockGlobalUserSelect()
    setDrag({ pointerId: args0.native.pointerId, blockId })
    const startClientX = args0.clientX
    const startClientY = args0.clientY
    const startX = b0.x
    const startY = b0.y
    const startIdx = blocksRef.current.findIndex(b => String(b?.id || '') === blockId)

    const scheduler = blockDragSchedulerRef.current
    startPointerDrag({
      ev: args0.native,
      cursor: 'grabbing',
      onMove: ev => {
        const svgNow = svgRef.current
        if (!svgNow) return
        const t = d3.zoomTransform(svgNow)
        const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
        const dx = (ev.clientX - startClientX) / k
        const dy = (ev.clientY - startClientY) / k
        const latest = { blockId, index: startIdx, x: startX + dx, y: startY + dy }
        blockDragLatestRef.current = latest
        scheduler.schedule(latest)
      },
      onEnd: () => {
        try {
          scheduler.flush()
        } catch {
          void 0
        }
        try {
          const moved = blocksRef.current.find(b => String(b?.id || '') === blockId) || null
          if (moved && layoutForRender && !props.layoutOverride) {
            patchMarkdownDesignLayoutPositions({ layoutKey: layoutForRender.key, updates: [{ id: moved.id, x: moved.x, y: moved.y }] })
          }
        } finally {
          blockDragLatestRef.current = null
          unlockGlobalUserSelect()
          setDrag(null)
        }
      },
      onCancel: () => {
        try {
          scheduler.cancel()
        } catch {
          void 0
        }
        try {
          void 0
        } finally {
          blockDragLatestRef.current = null
          unlockGlobalUserSelect()
          setDrag(null)
        }
      },
    })
  }, [allowDrag, layoutForRender, props.layoutOverride, svgRef])

  if (!enabled || !layoutForRender || visibleBlocks.length === 0) return null

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
    if (p.kind === 'html') {
      const raw = String(p.html?.raw || '').trim()
      const hasIframe = /<\s*iframe\b/i.test(raw)
      if (!hasIframe) return <p className={UI_THEME_TOKENS.text.tertiary}>—</p>
      const safe = looksLikeSingleTagBlock(raw, 'iframe') ? raw : raw
      const title = extractHtmlAttr(safe, 'title') || b.title || 'Iframe'
      const src = extractHtmlAttr(safe, 'src')
      const srcdocRaw = extractHtmlAttr(safe, 'srcdoc')
      const srcDoc = srcdocRaw ? sanitizeIframeSrcdoc(srcdocRaw) : ''
      if (!src && srcDoc) {
        return (
          <iframe
            title={title}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            loading="lazy"
            style={{ width: '100%', height: '100%', border: '0', borderRadius: 8, pointerEvents: 'none', touchAction: 'none' }}
          />
        )
      }
      const url = String(src || '').trim()
      if (!url) return <p className={UI_THEME_TOKENS.text.tertiary}>—</p>
      return (
        <RichMediaIframe
          url={url}
          title={title}
          className="w-full h-full rounded"
          style={{ pointerEvents: allowEmbeddedContentInteraction ? 'auto' : 'none', touchAction: allowEmbeddedContentInteraction ? 'auto' : 'none' }}
        />
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
            pointerEvents: 'none',
            borderRadius: `${maskBorderRadiusPx}px`,
          }}
          aria-hidden="true"
        />
      ) : null}

      {visibleBlocks.map(b => {
        const hideFooter = b.preview.kind === 'html' && /<\s*iframe\b/i.test(String(b.preview.html?.raw || ''))
        return (
          <article
            key={b.id}
            ref={getOverlayRefForId(b.id)}
            className={
              [
                'absolute left-0 top-0 pointer-events-auto',
                allowEmbeddedContentInteraction ? '' : 'select-none',
                UI_THEME_TOKENS.panel.border,
              ]
                .filter(Boolean)
                .join(' ')
            }
            role="group"
            data-kg-canvas-wheel-ignore="true"
            data-kg-canvas-pointer-ignore="true"
            data-kg-markdown-design-block={b.id}
            data-kg-anchor-node-id={String(anchorByBlockIdRef.current?.[b.id] || '') || undefined}
            data-kg-world-x={b.x}
            data-kg-world-y={b.y}
            data-kg-world-w={b.w}
            data-kg-world-h={b.h}
            aria-label={`Block ${b.title}`}
            style={{
              ...PANEL_FRAME_ROOT_STYLE,
              touchAction: allowEmbeddedContentInteraction ? 'auto' : 'none',
              transform: 'translate(-99999px, -99999px)',
              width: 1,
              height: 1,
            }}
            onPointerDownCapture={e => {
              if (allowEmbeddedContentInteraction) return
              const native = e.nativeEvent
              const t = (native as unknown as { target?: unknown }).target
              const isHeaderTarget = t instanceof Element && !!t.closest('[data-kg-media-panel-header="1"]')
              const allowHeaderOverlayPan = (() => {
                if (!isHeaderTarget) return true
                if (!props.onHeaderDragStart && !props.onHeaderDrag && !props.onHeaderDragEnd) return true
                return shouldStartHeaderDrag(native) !== true
              })()
              if (allowHeaderOverlayPan) {
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
                startOverlayPan(native)
              }
            }}
            onWheelCapture={props.stopEvent}
            onClickCapture={props.stopEvent}
            onDoubleClickCapture={props.stopEvent}
            onContextMenuCapture={props.stopEvent}
          >
            <header
              data-kg-media-panel-header="1"
              className={['border-b', UI_THEME_TOKENS.panel.divider].join(' ')}
              style={{
                ...PANEL_FRAME_HEADER_STYLE,
                cursor: 'grab',
                pointerEvents: 'auto',
              }}
              onPointerDownCapture={e => {
                const target = e.target
                if (target instanceof Element && target.closest('[data-kg-panel-action="1"]')) return
                try {
                  e.preventDefault()
                } catch {
                  void 0
                }
              }}
              onPointerDown={e => {
                if (e.button !== 0) return
                const native = e.nativeEvent
                if (props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd) {
                  if (!shouldStartHeaderDrag(native)) return
                  try {
                    e.stopPropagation()
                  } catch {
                    void 0
                  }
                  startHeaderDrag({ blockId: b.id, clientX: e.clientX, clientY: e.clientY, native })
                  return
                }
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
                startBlockDrag({ blockId: b.id, native, clientX: e.clientX, clientY: e.clientY })
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
              {hideFooter ? null : (
                <footer className={['mt-2 text-[10px]', UI_THEME_TOKENS.text.secondary].join(' ')} aria-label="Block metadata">
                  {`Lines ${b.startLine}-${b.endLine}`}
                </footer>
              )}
            </section>
          </article>
        )
      })}
    </section>
  )
})
