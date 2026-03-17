import React from 'react'
import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { LS_KEYS } from '@/lib/config'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ErrorFeedback } from '@/components/ui/ErrorFeedback'

type MermaidRenderResult = {
  svg: string
  bindFunctions?: (element: Element) => void
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<MermaidRenderResult>
  registerLayoutLoaders?: (loaders: unknown) => void
}

const isMermaidApi = (val: unknown): val is MermaidApi => {
  if (!val || typeof val !== 'object') return false
  const v = val as Record<string, unknown>
  return typeof v.initialize === 'function' && typeof v.render === 'function'
}

const getTestMermaidApi = (): MermaidApi | null => {
  const anyGlobal = globalThis as unknown as { __KG_TEST_MERMAID_API__?: unknown }
  const candidate = anyGlobal.__KG_TEST_MERMAID_API__
  return isMermaidApi(candidate) ? candidate : null
}


let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null
let lastMermaidInitKey = ''
let elkLayoutRegistered = false
let elkLayoutsPromise: Promise<unknown> | null = null

const ensureElkLayoutRegistered = async (mermaid: MermaidApi): Promise<void> => {
  if (elkLayoutRegistered) return
  if (typeof mermaid.registerLayoutLoaders !== 'function') {
    elkLayoutRegistered = true
    return
  }
  try {
    if (!elkLayoutsPromise) elkLayoutsPromise = import('@mermaid-js/layout-elk').then(m => (m as any).default ?? m)
    const loaders = await elkLayoutsPromise
    mermaid.registerLayoutLoaders(loaders)
  } catch {
    void 0
  } finally {
    elkLayoutRegistered = true
  }
}

const loadMermaidModule = async (): Promise<MermaidApi> => {
  const stub = getTestMermaidApi()
  if (stub) return stub
  if (!mermaidModulePromise) mermaidModulePromise = import('mermaid')
  const mod = await mermaidModulePromise
  const candidate: unknown = (mod as unknown as { default?: unknown }).default ?? mod
  if (!isMermaidApi(candidate)) {
    throw new Error('Mermaid module did not match expected API')
  }
  return candidate
}

const initMermaid = async (config: MermaidInitConfig): Promise<MermaidApi> => {
  const mermaid = await loadMermaidModule()
  await ensureElkLayoutRegistered(mermaid)
  const key = JSON.stringify(config || {})
  if (key !== lastMermaidInitKey) {
    try {
      mermaid.initialize({ startOnLoad: false, ...config })
      lastMermaidInitKey = key
    } catch {
      lastMermaidInitKey = key
    }
  }
  return mermaid
}

const sanitizeMermaidSvg = (raw: string): string => {
  const input = String(raw || '').trim()
  if (!input) return ''
  try {
    const doc = new window.DOMParser().parseFromString(input, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || root.nodeName.toLowerCase() !== 'svg') return input

    const all = root.querySelectorAll('*')
    for (const el of Array.from(all)) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'script') {
        el.remove()
        continue
      }
      const names = el.getAttributeNames()
      for (const name of names) {
        if (name.toLowerCase().startsWith('on')) {
          el.removeAttribute(name)
        }
      }
      if (tag === 'a') {
        const href = String(el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim()
        if (href && href.startsWith('#')) continue
        el.removeAttribute('href')
        el.removeAttribute('xlink:href')
        el.removeAttribute('target')
        el.removeAttribute('rel')
      }
    }

    return new window.XMLSerializer().serializeToString(root)
  } catch {
    return input
  }
}

const buildMermaidConfig = (opts: {
  rootThemeMode: 'light' | 'dark'
  frontmatterConfig: MermaidInitConfig | null
}): MermaidInitConfig => {
  const themeFromUi = opts.rootThemeMode === 'dark' ? 'dark' : 'default'
  const fmRaw = opts.frontmatterConfig || {}
  const fm = { ...fmRaw } as Record<string, unknown>
  if ('securityLevel' in fm) delete fm.securityLevel
  const themeVariables =
    fm && typeof fm.themeVariables === 'object' && fm.themeVariables != null && !Array.isArray(fm.themeVariables)
      ? (fm.themeVariables as Record<string, unknown>)
      : null
  const requestedTheme = typeof fm.theme === 'string' ? (fm.theme as string) : ''
  const theme = themeVariables ? 'base' : (requestedTheme || themeFromUi)
  const mergedThemeVariables = themeVariables
    ? { darkMode: opts.rootThemeMode === 'dark', ...themeVariables }
    : { darkMode: opts.rootThemeMode === 'dark' }
  return {
    securityLevel: 'loose',
    theme,
    ...(Object.keys(fm).length ? fm : {}),
    ...(themeVariables ? { themeVariables: mergedThemeVariables } : {}),
  }
}

export function MermaidDiagram({
  code,
  highlightClass,
  frontmatterConfig,
  rootThemeMode,
  overlayScope = 'viewport',
  overlayPortalTarget,
  variant = 'default',
  enablePanZoom = false,
  wheelZoomRequiresModifier,
  wheelZoomBehavior,
}: {
  code: string
  highlightClass: string
  frontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  overlayScope?: 'viewport' | 'container'
  overlayPortalTarget?: HTMLElement | null
  variant?: 'default' | 'codeblock'
  enablePanZoom?: boolean
  wheelZoomRequiresModifier?: boolean
  wheelZoomBehavior?: 'modifier' | 'always' | 'active'
}) {
  const figureRef = React.useRef<HTMLElement | null>(null)
  const containerRef = React.useRef<HTMLElement | null>(null)
  const codeblockSvgRef = React.useRef<SVGSVGElement | null>(null)
  const codeblockViewBoxRef = React.useRef<{ x: number; y: number; w: number; h: number; baseW: number; baseH: number } | null>(null)
  const codeblockPointerRef = React.useRef<{ active: boolean; pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const codeblockWheelActiveRef = React.useRef(false)
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '_')
  const [error, setError] = React.useState<string | null>(null)
  const [svg, setSvg] = React.useState('')
  const [svgTightSize, setSvgTightSize] = React.useState<{ w: number; h: number } | null>(null)
  const [codeblockFrameWidthPx, setCodeblockFrameWidthPx] = React.useState<number>(0)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const dragRef = React.useRef<{ x: number; y: number } | null>(null)
  const didDragRef = React.useRef(false)

  const config = React.useMemo(
    () => buildMermaidConfig({ rootThemeMode, frontmatterConfig }),
    [frontmatterConfig, rootThemeMode],
  )

  React.useEffect(() => {
    if (variant !== 'codeblock') return
    const el = figureRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      try {
        const rect = el.getBoundingClientRect()
        const w = Number.isFinite(rect.width) ? rect.width : 0
        setCodeblockFrameWidthPx(prev => (Math.abs(prev - w) < 1 ? prev : w))
      } catch {
        void 0
      }
    })
    try {
      ro.observe(el)
    } catch {
      void 0
    }
    return () => {
      try {
        ro.disconnect()
      } catch {
        void 0
      }
    }
  }, [variant])

  const codeblockFrameHeightPx = React.useMemo(() => {
    if (variant !== 'codeblock') return null
    const content = svgTightSize
    const w = Number.isFinite(codeblockFrameWidthPx) ? codeblockFrameWidthPx : 0
    const maxH = 480
    const minH = 160
    if (!content || content.w <= 0 || content.h <= 0 || w <= 0) return maxH
    const ideal = Math.round((content.h / content.w) * w)
    return Math.max(minH, Math.min(maxH, ideal))
  }, [codeblockFrameWidthPx, svgTightSize, variant])

  const applyCodeblockViewBox = React.useCallback((vb: { x: number; y: number; w: number; h: number }) => {
    const svgEl = codeblockSvgRef.current
    if (!svgEl) return
    svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
    const prev = codeblockViewBoxRef.current
    if (!prev) return
    codeblockViewBoxRef.current = { ...prev, x: vb.x, y: vb.y, w: vb.w, h: vb.h }
  }, [])

  const getCodeblockRect = React.useCallback(() => {
    const svgEl = codeblockSvgRef.current
    if (!svgEl) return null
    const rect = svgEl.getBoundingClientRect()
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return null
    return rect
  }, [])

  const handleCodeblockWheel = React.useCallback(
    (event: React.WheelEvent) => {
      if (!(enablePanZoom && variant === 'codeblock')) return
      const vb = codeblockViewBoxRef.current
      if (!vb) return

      const isModifierZoom = event.altKey
      const behavior = wheelZoomBehavior || (wheelZoomRequiresModifier ? 'modifier' : 'always')
      const allowZoom =
        behavior === 'always'
          ? true
          : behavior === 'modifier'
          ? isModifierZoom
          : codeblockWheelActiveRef.current || isModifierZoom
      if (!allowZoom) return

      event.preventDefault()
      try {
        event.stopPropagation()
      } catch {
        void 0
      }

      const rect = getCodeblockRect()
      if (!rect) return
      const sx = (event.clientX - rect.left) / rect.width
      const sy = (event.clientY - rect.top) / rect.height
      const focusX = vb.x + sx * vb.w
      const focusY = vb.y + sy * vb.h

      const wheelSpeed = 0.002
      const rawFactor = Math.exp(-event.deltaY * wheelSpeed)
      const nextZoom = Math.max(0.25, Math.min(8, vb.baseW / (vb.w / rawFactor)))
      const nextW = vb.baseW / nextZoom
      const nextH = vb.baseH / nextZoom
      const nextX = focusX - sx * nextW
      const nextY = focusY - sy * nextH
      applyCodeblockViewBox({ x: nextX, y: nextY, w: nextW, h: nextH })
    },
    [applyCodeblockViewBox, enablePanZoom, getCodeblockRect, variant, wheelZoomBehavior, wheelZoomRequiresModifier],
  )

  const handleCodeblockPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      if (!(enablePanZoom && variant === 'codeblock')) return
      if (event.button !== 0) return
      const vb = codeblockViewBoxRef.current
      if (!vb) return
      codeblockWheelActiveRef.current = true
      codeblockPointerRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: vb.x,
        baseY: vb.y,
      }
      try {
        ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      } catch {
        void 0
      }
    },
    [enablePanZoom, variant],
  )

  const handleCodeblockPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      if (!(enablePanZoom && variant === 'codeblock')) return
      const st = codeblockPointerRef.current
      const vb = codeblockViewBoxRef.current
      if (!st || !st.active || st.pointerId !== event.pointerId || !vb) return
      const rect = getCodeblockRect()
      if (!rect) return
      const dx = event.clientX - st.startX
      const dy = event.clientY - st.startY
      if (Math.abs(dx) + Math.abs(dy) >= 3) didDragRef.current = true
      const unitsPerPxX = vb.w / rect.width
      const unitsPerPxY = vb.h / rect.height
      const nextX = st.baseX - dx * unitsPerPxX
      const nextY = st.baseY - dy * unitsPerPxY
      applyCodeblockViewBox({ x: nextX, y: nextY, w: vb.w, h: vb.h })
    },
    [applyCodeblockViewBox, enablePanZoom, getCodeblockRect, variant],
  )

  const handleCodeblockPointerUp = React.useCallback(
    (event: React.PointerEvent) => {
      if (!(enablePanZoom && variant === 'codeblock')) return
      const st = codeblockPointerRef.current
      if (st && st.pointerId === event.pointerId) {
        codeblockPointerRef.current = null
      }
      codeblockWheelActiveRef.current = false
      try {
        ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
      } catch {
        void 0
      }
    },
    [enablePanZoom, variant],
  )

  React.useEffect(() => {
    let cancelled = false
    const host = containerRef.current
    if (!host) return
    host.innerHTML = ''
    setError(null)
    setSvg('')
    setSvgTightSize(null)
    codeblockSvgRef.current = null
    codeblockViewBoxRef.current = null
    const captureClick = (event: MouseEvent) => {
      try {
        const target = event.target as Element | null
        const anchor = target ? target.closest('a') : null
        if (!anchor) return
        const href = String(anchor.getAttribute('href') || anchor.getAttribute('xlink:href') || '').trim()
        if (!href) return
        if (href.startsWith('#') && typeof window !== 'undefined') {
          const rawId = href.slice(1)
          const id = (() => {
            try {
              return decodeURIComponent(rawId)
            } catch {
              return rawId
            }
          })()
          const nextHash = `#${encodeURIComponent(id)}`
          const shouldDispatchHashChange = String(window.location.hash || '') === nextHash
          event.preventDefault()
          event.stopPropagation()
          ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
          try {
            window.location.hash = nextHash
          } catch {
            void 0
          }
          if (shouldDispatchHashChange) {
            try {
              window.dispatchEvent(new Event('hashchange'))
            } catch {
              void 0
            }
          }
          return
        }
        event.preventDefault()
        event.stopPropagation()
        ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
    }
    host.addEventListener('click', captureClick, true)
    void (async () => {
      try {
        const trimmedCode = String(code || '').trim()
        if (!trimmedCode) {
          setError('Mermaid diagram code is empty')
          return
        }
        if (/^<\s*(svg|div|span)\b/i.test(trimmedCode)) {
          setError('Mermaid diagram code is not a Mermaid definition')
          return
        }
        const mermaid = await initMermaid(config)
        if (cancelled) return
        const out = await mermaid.render(`m_${id}`, trimmedCode)
        if (cancelled) return
        const nextSvg = sanitizeMermaidSvg(out.svg)
        host.innerHTML = nextSvg
        setSvg(nextSvg)
        try {
          const svgEl = host.querySelector('svg') as SVGSVGElement | null
          if (svgEl) {
            codeblockSvgRef.current = svgEl
            try {
              svgEl.style.maxWidth = 'none'
              svgEl.style.maxHeight = 'none'
              ;(svgEl.style as unknown as { shapeRendering?: string }).shapeRendering = 'geometricPrecision'
              ;(svgEl.style as unknown as { textRendering?: string }).textRendering = 'geometricPrecision'
              svgEl.setAttribute('width', '100%')
              svgEl.setAttribute('height', '100%')
              svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
            } catch {
              void 0
            }
            requestAnimationFrame(() => {
              try {
                const bbox = svgEl.getBBox()
                const bw = Number.isFinite(bbox.width) ? bbox.width : 0
                const bh = Number.isFinite(bbox.height) ? bbox.height : 0
                const bx = Number.isFinite(bbox.x) ? bbox.x : 0
                const by = Number.isFinite(bbox.y) ? bbox.y : 0

                const fallbackVb = (() => {
                  const vb = svgEl.viewBox?.baseVal
                  if (vb && vb.width > 0 && vb.height > 0) return { x: vb.x, y: vb.y, w: vb.width, h: vb.height }
                  return null
                })()

                const raw =
                  bw > 0 && bh > 0
                    ? { x: bx, y: by, w: bw, h: bh }
                    : fallbackVb
                if (!raw) return

                const pad = Math.max(24, Math.round(Math.max(raw.w, raw.h) * 0.08))
                let vw = raw.w + pad * 2
                let vh = raw.h + pad * 2
                const minW = 360
                const minH = 240
                if (vw < minW) vw = minW
                if (vh < minH) vh = minH
                const vx = raw.x - (vw - raw.w) / 2
                const vy = raw.y - (vh - raw.h) / 2

                svgEl.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`)
                codeblockViewBoxRef.current = { x: vx, y: vy, w: vw, h: vh, baseW: vw, baseH: vh }
                setSvgTightSize({ w: vw, h: vh })
              } catch {
                void 0
              }
            })
          }
        } catch {
          void 0
        }
        if (typeof out.bindFunctions === 'function') {
          try {
            out.bindFunctions(host)
          } catch {
            void 0
          }
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg || 'Mermaid render failed')
      }
    })()
    return () => {
      cancelled = true
      try {
        host.removeEventListener('click', captureClick, true)
      } catch {
        void 0
      }
    }
  }, [code, config, id])

  const getSvgSize = React.useCallback((raw: string): { w: number; h: number } => {
    if (svgTightSize) return svgTightSize
    try {
      const doc = new window.DOMParser().parseFromString(String(raw || ''), 'image/svg+xml')
      const el = doc.querySelector('svg')
      if (!el) return { w: 800, h: 600 }
      const vb = el.getAttribute('viewBox')
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/g).map(x => Number.parseFloat(x))
        const w = parts.length === 4 ? parts[2] : NaN
        const h = parts.length === 4 ? parts[3] : NaN
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h }
      }
      const parseDim = (v: string | null): number => {
        if (!v) return NaN
        const n = Number.parseFloat(v)
        return Number.isFinite(n) ? n : NaN
      }
      const w = parseDim(el.getAttribute('width'))
      const h = parseDim(el.getAttribute('height'))
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h }
      return { w: 800, h: 600 }
    } catch {
      return { w: 800, h: 600 }
    }
  }, [svgTightSize])

  if (error) {
    return <ErrorFeedback error={error} code={code} className={highlightClass} />
  }

  const handleClick = (event: React.MouseEvent) => {
    try {
      const target = event.target as Element | null
      if (target) {
        const anchor = target.closest('a')
        const href = anchor?.getAttribute('href') || anchor?.getAttribute('xlink:href') || ''
        if (href.trim().startsWith('#')) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
      }
    } catch {
      void 0
    }
  }

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    try {
      const target = event.target as Element | null
      if (target) {
        const anchor = target.closest('a')
        const href = anchor?.getAttribute('href') || anchor?.getAttribute('xlink:href') || ''
        if (href.trim().startsWith('#')) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
      }
    } catch {
      void 0
    }
    if (overlayScope === 'container') {
      if (!svg) return
      setIsFullscreenOpen(true)
      return
    }
    try {
      setMermaidFocus({
        code: String(code || ''),
        frontmatterConfig: frontmatterConfig,
      })
    } catch {
      void 0
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }),
        )
      }
    } catch {
      void 0
    }
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    dragRef.current = { x: event.clientX, y: event.clientY }
    didDragRef.current = false
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const st = dragRef.current
    if (!st) return
    const dx = event.clientX - st.x
    const dy = event.clientY - st.y
    if (Math.abs(dx) + Math.abs(dy) >= 4) didDragRef.current = true
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  return (
    <>
      <figure
        ref={figureRef}
        className={[
          variant === 'codeblock'
            ? 'm-0 p-0 rounded-none border-0 bg-transparent overflow-hidden w-full shrink-0'
            : 'mt-3 mb-3 p-3 rounded border border-gray-200 bg-white overflow-auto',
          highlightClass,
        ].filter(Boolean).join(' ')}
        style={
          variant === 'codeblock'
            ? ({ height: `${Math.max(120, Math.floor(codeblockFrameHeightPx ?? 480))}px` } as React.CSSProperties)
            : undefined
        }
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="figure"
        aria-label="Mermaid diagram"
      >
        <section
          ref={containerRef}
          className="mermaid-container w-full h-full flex items-center justify-center"
          style={enablePanZoom && variant === 'codeblock' ? ({ touchAction: 'none' } as React.CSSProperties) : undefined}
          onWheel={enablePanZoom && variant === 'codeblock' ? handleCodeblockWheel : undefined}
          onPointerDown={enablePanZoom && variant === 'codeblock' ? handleCodeblockPointerDown : undefined}
          onPointerMove={enablePanZoom && variant === 'codeblock' ? handleCodeblockPointerMove : undefined}
          onPointerUp={enablePanZoom && variant === 'codeblock' ? handleCodeblockPointerUp : undefined}
          onPointerCancel={enablePanZoom && variant === 'codeblock' ? handleCodeblockPointerUp : undefined}
          onPointerLeave={enablePanZoom && variant === 'codeblock' ? (() => { codeblockWheelActiveRef.current = false }) : undefined}
        />
        <figcaption className="sr-only">Mermaid diagram visualization</figcaption>
      </figure>
      {overlayScope === 'container' && (
        <PreviewOverlay
          open={isFullscreenOpen && !!svg}
          onClose={() => setIsFullscreenOpen(false)}
          scope={overlayScope}
          portalTarget={overlayPortalTarget}
        >
          <ZoomPanViewport
            open={isFullscreenOpen && !!svg}
            storageKey={LS_KEYS.previewZoomPanMermaid}
            getContentSize={() => getSvgSize(svg)}
            fitOnOpen
          >
            <section
              onClick={event => {
                try {
                  const target = event.target as Element | null
                  const anchor = target ? target.closest('a') : null
                  const href = String(anchor?.getAttribute('href') || anchor?.getAttribute('xlink:href') || '').trim()
                  if (!href || !href.startsWith('#') || typeof window === 'undefined') return
                  const rawId = href.slice(1)
                  const id = (() => {
                    try {
                      return decodeURIComponent(rawId)
                    } catch {
                      return rawId
                    }
                  })()
                  const nextHash = `#${encodeURIComponent(id)}`
                  const shouldDispatchHashChange = String(window.location.hash || '') === nextHash
                  event.preventDefault()
                  event.stopPropagation()
                  setIsFullscreenOpen(false)
                  try {
                    window.location.hash = nextHash
                  } catch {
                    void 0
                  }
                  if (shouldDispatchHashChange) {
                    try {
                      window.dispatchEvent(new Event('hashchange'))
                    } catch {
                      void 0
                    }
                  }
                } catch {
                  void 0
                }
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </ZoomPanViewport>
        </PreviewOverlay>
      )}
    </>
  )
}
