import React from 'react'
import * as d3 from 'd3'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import { lexMarkdown, buildMarkdownTokensKey } from '@/features/markdown/ui/markdownPreviewLex'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import { patchById } from 'grph-shared/array/patchArrayItem'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import RichMediaPanel from '@/components/RichMediaPanel'
import {
  deriveMarkdownDesignLayout,
  patchMarkdownDesignLayoutPositions,
  MARKDOWN_DESIGN_LAYOUT,
  type MarkdownDesignBlock,
  type MarkdownDesignLayout,
} from '@/features/markdown-edgeless/markdownDesignLayout'
import { startMarkdownPanelOverlayLoop2d } from '@/features/markdown-edgeless/markdownPanelOverlayLoop2d'
import { readOverlaySizingConfigForDensity } from '@/lib/render/overlaySizing2d'

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

  const markdownSnippetByBlockId = React.useMemo(() => {
    const out = new Map<string, string>()
    const blocks0 = Array.isArray(blocksRef.current) ? blocksRef.current : []
    for (const b of blocks0) {
      const kind = b.preview?.kind
      const snippet = (() => {
        if (kind === 'table' && b.preview.table) {
          const cols = b.preview.table.columns || []
          const rows = b.preview.table.rows || []
          const head = `| ${cols.map(c => String(c || '').replace(/\|/g, '\\|')).join(' | ')} |`
          const sep = `| ${cols.map(() => '---').join(' | ')} |`
          const body = rows.slice(0, 6).map(r => `| ${(r || []).map(c => String(c || '').replace(/\|/g, '\\|')).join(' | ')} |`)
          return [head, sep, ...body].join('\n')
        }
        if (kind === 'code' && b.preview.code) {
          const lang = String(b.preview.code.lang || '').trim()
          const lines = Array.isArray(b.preview.code.lines) ? b.preview.code.lines : []
          return ['```' + lang, ...lines, '```'].join('\n')
        }
        if (kind === 'blockquote' && b.preview.blockquote) {
          const lines = Array.isArray(b.preview.blockquote.lines) ? b.preview.blockquote.lines : []
          return lines.map(l => `> ${String(l || '')}`).join('\n')
        }
        if (kind === 'callout' && b.preview.callout) {
          const t = String(b.preview.callout.title || '').trim()
          const calloutType = String(b.preview.callout.calloutType || '').trim() || 'note'
          const header = `> [!${calloutType.toUpperCase()}]${t ? ` ${t}` : ''}`
          return header
        }
        if (kind === 'list' && Array.isArray(b.preview.listItems)) {
          const ordered = b.preview.ordered === true
          return b.preview.listItems
            .slice(0, 10)
            .map((it, idx) => {
              const base = ordered ? `${idx + 1}.` : '-'
              const text = String(it.text || '').trim()
              if (it.task === true) {
                const mark = it.checked === true ? '[x]' : '[ ]'
                return `${base} ${mark} ${text}`.trim()
              }
              return `${base} ${text}`.trim()
            })
            .join('\n')
        }
        if (kind === 'hr') return '---'
        if (kind === 'html' && b.preview.html) {
          const raw = String(b.preview.html.raw || '').trim()
          return ['```html', raw, '```'].join('\n')
        }
        return String(b.summary || '').trim() || String(b.title || '').trim()
      })()
      out.set(b.id, snippet)
    }
    return out
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
  const blockDragStartRef = React.useRef<null | { blockId: string; index: number; x: number; y: number }>(null)
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
      blockDragLatestRef.current = null
      blockDragStartRef.current = null
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
      return readOverlaySizingConfigForDensity({ density, sizing: st })
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

  if (!enabled || !layoutForRender || visibleBlocks.length === 0) return null

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
        const snippet = markdownSnippetByBlockId.get(b.id) || ''
        const anchorId = String(anchorByBlockIdRef.current?.[b.id] || b.id)
        return (
          <div
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
            data-md-id={b.id}
            data-kg-anchor-node-id={anchorId || undefined}
            data-kg-world-x={b.x}
            data-kg-world-y={b.y}
            data-kg-world-w={b.w}
            data-kg-world-h={b.h}
            aria-label={`Block ${b.title}`}
            style={{
              touchAction: allowEmbeddedContentInteraction ? 'auto' : 'none',
              transform: 'translate(-99999px, -99999px)',
              width: 1,
              height: 1,
            }}
            onWheelCapture={props.stopEvent}
            onClickCapture={props.stopEvent}
            onDoubleClickCapture={props.stopEvent}
            onContextMenuCapture={props.stopEvent}
          >
            <RichMediaPanel
              overlayId={anchorId}
              title={b.title}
              url=""
              kind="iframe"
              interactive={allowEmbeddedContentInteraction}
              showHeader={true}
              resizable={false}
              forwardWheelTo={() => svgRef.current}
              forwardPointerTo={() => svgRef.current}
              shouldForwardPointerDown={() => allowEmbeddedContentInteraction !== true}
              shouldStartHeaderDrag={native => shouldStartHeaderDrag(native)}
              onHeaderDragStart={args0 => {
                if (allowEmbeddedContentInteraction) return
                if (!anchorId) return
                if (props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd) {
                  props.onHeaderDragStart?.({ id: anchorId, clientX: args0.clientX, clientY: args0.clientY })
                  return
                }
                if (!allowDrag) return
                const b0 = blocksRef.current.find(x => String(x?.id || '') === b.id) || null
                if (!b0) return
                lockGlobalUserSelect()
                setDrag({ pointerId: args0.pointerId, blockId: b.id })
                const index = blocksRef.current.findIndex(x => String(x?.id || '') === b.id)
                const start = { blockId: b.id, index, x: b0.x, y: b0.y }
                blockDragStartRef.current = start
                blockDragLatestRef.current = start
              }}
              onHeaderDrag={args0 => {
                if (allowEmbeddedContentInteraction) return
                if (props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd) {
                  props.onHeaderDrag?.({ dx: args0.dx, dy: args0.dy })
                  return
                }
                if (!allowDrag) return
                const start = blockDragStartRef.current
                if (!start || start.blockId !== b.id) return
                const svgNow = svgRef.current
                if (!svgNow) return
                const t = d3.zoomTransform(svgNow)
                const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
                const next = { ...start, x: start.x + args0.dx / k, y: start.y + args0.dy / k }
                blockDragLatestRef.current = next
                blockDragSchedulerRef.current.schedule(next)
              }}
              onHeaderDragEnd={() => {
                if (allowEmbeddedContentInteraction) return
                if (props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd) {
                  props.onHeaderDragEnd?.()
                  return
                }
                if (!allowDrag) return
                try {
                  blockDragSchedulerRef.current.flush()
                } catch {
                  void 0
                }
                try {
                  const moved = blocksRef.current.find(x => String(x?.id || '') === b.id) || null
                  if (moved && layoutForRender && !props.layoutOverride) {
                    patchMarkdownDesignLayoutPositions({ layoutKey: layoutForRender.key, updates: [{ id: moved.id, x: moved.x, y: moved.y }] })
                  }
                } finally {
                  blockDragLatestRef.current = null
                  blockDragStartRef.current = null
                  unlockGlobalUserSelect()
                  setDrag(null)
                }
              }}
              onOverlayPanStart={props.onOverlayPanStart}
              onOverlayPan={props.onOverlayPan}
              onOverlayPanEnd={props.onOverlayPanEnd}
              onDoubleClickCapture={() => {
                onPreviewClick?.(b.startLine)
              }}
              panel={{
                activeTab: 'text',
                freezeConnectedOutput: false,
                hasText: true,
                hasImage: false,
                hasVideo: false,
                hasPoi: false,
                text: snippet,
                connectedText: '',
              }}
              style={{ width: '100%', height: '100%', boxShadow: 'none' }}
            />
          </div>
        )
      })}
    </section>
  )
})
