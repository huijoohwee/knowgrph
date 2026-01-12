import React from 'react'
import type { LsStorageKey } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { scheduleIdle } from '@/features/panels/utils/idle'

type ContentSize = { w: number; h: number }
type Pan = { x: number; y: number }
type StoredState = { zoom: number; panX: number; panY: number }

const clampZoom = (z: number) => Math.max(0.05, Math.min(8, z))

const parseStoredState = (raw: unknown): StoredState | null => {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const zoom = typeof v.zoom === 'number' ? v.zoom : NaN
  const panX = typeof v.panX === 'number' ? v.panX : NaN
  const panY = typeof v.panY === 'number' ? v.panY : NaN
  if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) return null
  return { zoom: clampZoom(zoom), panX, panY }
}

type ZoomPanViewportProps = {
  open: boolean
  storageKey: LsStorageKey
  getContentSize: () => ContentSize
  children: React.ReactNode
  fitOnOpen?: boolean
  frameAspectRatio?: number | null
  framePaddingPx?: number
  wheelZoomSpeed?: number
  showControls?: boolean
  showZoomIndicator?: boolean
  frameClassName?: string
  disablePan?: boolean
}

export default function ZoomPanViewport({
  open,
  storageKey,
  getContentSize,
  children,
  fitOnOpen,
  frameAspectRatio = 16 / 9,
  framePaddingPx = 16,
  wheelZoomSpeed = 0.002,
  showControls = true,
  showZoomIndicator = false,
  frameClassName,
  disablePan = false,
}: ZoomPanViewportProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const frameRef = React.useRef<HTMLDivElement | null>(null)
  const dragRef = React.useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const pendingRef = React.useRef<{ zoom: number; pan: Pan } | null>(null)
  const zoomRef = React.useRef<number>(1)
  const panRef = React.useRef<Pan>({ x: 0, y: 0 })

  const [viewportSize, setViewportSize] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 })

  const stored = React.useMemo(() => lsJson(storageKey, { zoom: 1, panX: 0, panY: 0 }, parseStoredState), [storageKey])
  const [zoom, setZoom] = React.useState(() => clampZoom(stored.zoom))
  const [pan, setPan] = React.useState<Pan>(() => ({ x: stored.panX, y: stored.panY }))

  React.useEffect(() => {
    zoomRef.current = zoom
    panRef.current = pan
  }, [pan, zoom])

  React.useEffect(() => {
    scheduleIdle(() => {
      lsSetJson(storageKey, { zoom, panX: pan.x, panY: pan.y })
    })
  }, [pan.x, pan.y, storageKey, zoom])

  React.useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      setViewportSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(vp)
    return () => ro.disconnect()
  }, [])

  const frameSize = React.useMemo(() => {
    const pad = Math.max(0, framePaddingPx)
    const vw = Math.max(1, viewportSize.w - pad * 2)
    const vh = Math.max(1, viewportSize.h - pad * 2)
    const ar = typeof frameAspectRatio === 'number' && Number.isFinite(frameAspectRatio) && frameAspectRatio > 0 ? frameAspectRatio : null
    if (!ar) return { w: vw, h: vh, pad }
    const availableAr = vw / vh
    if (availableAr > ar) {
      const h = vh
      const w = h * ar
      return { w, h, pad }
    }
    const w = vw
    const h = w / ar
    return { w, h, pad }
  }, [frameAspectRatio, framePaddingPx, viewportSize.h, viewportSize.w])

  const scheduleApply = React.useCallback((next: { zoom: number; pan: Pan }) => {
    pendingRef.current = next
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const pending = pendingRef.current
      if (!pending) return
      pendingRef.current = null
      setZoom(pending.zoom)
      setPan(pending.pan)
    })
  }, [])

  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      pendingRef.current = null
    }
  }, [])

  const fitToViewport = React.useCallback(() => {
    const vw = Math.max(1, frameSize.w)
    const vh = Math.max(1, frameSize.h)
    const size = getContentSize()
    const safeW = Math.max(1, size.w)
    const safeH = Math.max(1, size.h)
    const nextZoom = clampZoom(Math.min(vw / safeW, vh / safeH))
    scheduleApply({ zoom: nextZoom, pan: { x: 0, y: 0 } })
  }, [frameSize.h, frameSize.w, getContentSize, scheduleApply])

  React.useEffect(() => {
    if (!open) return
    if (!fitOnOpen) return
    fitToViewport()
  }, [fitOnOpen, fitToViewport, open])

  return (
    <div className="w-full h-full flex flex-col">
      {showControls ? (
        <div className="shrink-0 h-10 px-3 flex items-center justify-end gap-2 border-b border-gray-200 text-xs text-gray-700">
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
            onClick={() => scheduleApply({ zoom: clampZoom(zoomRef.current / 1.15), pan: panRef.current })}
          >
            -
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
            onClick={() => scheduleApply({ zoom: clampZoom(zoomRef.current * 1.15), pan: panRef.current })}
          >
            +
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              scheduleApply({ zoom: 1, pan: { x: 0, y: 0 } })
            }}
          >
            100%
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
            onClick={fitToViewport}
          >
            Fit
          </button>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 bg-white overflow-hidden"
        onWheel={(e) => {
          const isModifierZoom = e.ctrlKey || e.metaKey
          if (!isModifierZoom) return
          e.preventDefault()
          const prevZoom = zoomRef.current
          const prevPan = panRef.current
          const rawFactor = Math.exp(-e.deltaY * wheelZoomSpeed)
          const nextZoom = clampZoom(prevZoom * rawFactor)
          if (nextZoom === prevZoom) return
          scheduleApply({ zoom: nextZoom, pan: prevPan })
        }}
        onPointerDown={(e) => {
          if (disablePan) return
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            void 0
          }
          const prevPan = panRef.current
          dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseX: prevPan.x, baseY: prevPan.y }
        }}
        onPointerMove={(e) => {
          if (disablePan) return
          const st = dragRef.current
          if (!st || !st.active) return
          const dx = e.clientX - st.startX
          const dy = e.clientY - st.startY
          scheduleApply({ zoom: zoomRef.current, pan: { x: st.baseX + dx, y: st.baseY + dy } })
        }}
        onPointerUp={(e) => {
          if (disablePan) return
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            void 0
          }
          dragRef.current = null
        }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div style={{ padding: `${frameSize.pad}px` }}>
            <div
              ref={frameRef}
              className={['relative overflow-hidden', frameClassName || ''].filter(Boolean).join(' ')}
              style={{
                width: `${Math.max(1, frameSize.w)}px`,
                height: `${Math.max(1, frameSize.h)}px`,
                touchAction: 'none',
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <div
                  style={{
                    transform: `translate(${disablePan ? 0 : pan.x}px, ${disablePan ? 0 : pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  {children}
                </div>
              </div>
              {showZoomIndicator ? (
                <div className="absolute right-2 bottom-2 rounded bg-black/60 text-white text-[11px] px-1.5 py-0.5 pointer-events-none">
                  {`${Math.round(zoom * 100)}%`}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
