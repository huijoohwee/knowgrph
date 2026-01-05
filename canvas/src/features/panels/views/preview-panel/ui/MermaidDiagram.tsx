import React from 'react'
import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { LS_KEYS } from '@/lib/config'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useGraphStore } from '@/hooks/useGraphStore'

type MermaidRenderResult = {
  svg: string
  bindFunctions?: (element: Element) => void
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<MermaidRenderResult>
}

const isMermaidApi = (val: unknown): val is MermaidApi => {
  if (!val || typeof val !== 'object') return false
  const v = val as Record<string, unknown>
  return typeof v.initialize === 'function' && typeof v.render === 'function'
}


let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null
let lastMermaidInitKey = ''

const loadMermaidModule = async (): Promise<MermaidApi> => {
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

const buildMermaidConfig = (opts: {
  rootThemeMode: 'light' | 'dark'
  frontmatterConfig: MermaidInitConfig | null
}): MermaidInitConfig => {
  const themeFromUi = opts.rootThemeMode === 'dark' ? 'dark' : 'default'
  const fm = opts.frontmatterConfig || {}
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
    securityLevel: 'strict',
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
}: {
  code: string
  highlightClass: string
  frontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  overlayScope?: 'viewport' | 'container'
  overlayPortalTarget?: HTMLElement | null
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '_')
  const [error, setError] = React.useState<string | null>(null)
  const [svg, setSvg] = React.useState('')
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)

  const config = React.useMemo(
    () => buildMermaidConfig({ rootThemeMode, frontmatterConfig }),
    [frontmatterConfig, rootThemeMode],
  )

  React.useEffect(() => {
    let cancelled = false
    const host = containerRef.current
    if (!host) return
    host.innerHTML = ''
    setError(null)
    setSvg('')
    void (async () => {
      try {
        const mermaid = await initMermaid(config)
        if (cancelled) return
        const out = await mermaid.render(`m_${id}`, String(code || ''))
        if (cancelled) return
        const nextSvg = String(out.svg || '')
        host.innerHTML = nextSvg
        setSvg(nextSvg)
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
    }
  }, [code, config, id])

  const getSvgSize = React.useCallback((raw: string): { w: number; h: number } => {
    try {
      const doc = new DOMParser().parseFromString(String(raw || ''), 'image/svg+xml')
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
  }, [])

  if (error) {
    return (
      <pre
        className={[
          'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
          highlightClass,
        ].filter(Boolean).join(' ')}
      >
        <code className="font-mono text-xs whitespace-pre">{code}</code>
      </pre>
    )
  }

  return (
    <>
      <div
        className={[
          'mt-3 mb-3 p-3 rounded border border-gray-200 bg-white overflow-auto',
          highlightClass,
        ].filter(Boolean).join(' ')}
        onClick={() => {
          if (!svg) return
          if (overlayScope === 'container') {
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
        }}
      >
        <div ref={containerRef} />
      </div>
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
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </ZoomPanViewport>
        </PreviewOverlay>
      )}
    </>
  )
}
