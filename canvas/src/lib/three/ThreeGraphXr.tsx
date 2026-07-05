import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'
import {
  readXrPhysicsPlaygroundControls,
  setXrPhysicsPlaygroundMode,
  subscribeXrPhysicsPlaygroundControls,
} from '@/features/three/xrPhysicsPlaygroundControls'
import { XR_PHYSICS_CONTROLLER_MODES, type XrPhysicsControllerMode } from '@/features/three/xrPhysicsPlaygroundModel'
import {
  readSpatialCaptureTool,
  readSpatialCaptureToolLabel,
  subscribeSpatialCaptureTool,
} from '@/features/three/xrSpatialCaptureTools'
import type { SpatialCaptureToolId } from '@/features/three/xrSpatialCaptureTools'
import { MinimapSpatialViewCube } from '@/features/minimap/MinimapSpatialViewCube'
import { UI_RESPONSIVE_CANVAS_FLOATING_ACTION_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import {
  XR_SESSION_MODE_ORDER,
  buildXrSessionInit,
  chooseXrSessionMode,
  resolveXrDomOverlayRoot,
  type XrSessionMode,
  type XrSessionSupport,
} from '@/lib/three/ThreeGraphXrSessionPolicy'

export function OverlayFrameSync({ enabled, scheduleRef }: { enabled: boolean; scheduleRef: React.MutableRefObject<(() => void) | null> }) {
  useFrame(() => {
    if (!enabled) return
    try {
      scheduleRef.current?.()
    } catch {
      void 0
    }
  })
  return null
}

type XrSessionLike = {
  end?: () => Promise<void>
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
}

type ThreeWebXrSession = Parameters<WebGLRenderer['xr']['setSession']>[0]

type NavigatorWithXr = Navigator & {
  xr?: {
    isSessionSupported?: (mode: XrSessionMode) => Promise<boolean>
    requestSession?: (mode: string, options?: unknown) => Promise<XrSessionLike>
  }
}

export function CanvasXrEntryPanel({
  active,
  rendererRef,
  surfaceKind = 'graph',
  spatialRuntimeStatus = 'idle',
}: {
  active: boolean
  rendererRef: React.MutableRefObject<WebGLRenderer | null>
  surfaceKind?: 'graph' | 'spatial-capture'
  spatialRuntimeStatus?: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
}) {
  const [status, setStatus] = React.useState<'checking' | 'supported' | 'unsupported' | 'active' | 'error'>('checking')
  const [sessionMode, setSessionMode] = React.useState<XrSessionMode>('immersive-ar')
  const [sessionSupport, setSessionSupport] = React.useState<XrSessionSupport>({})
  const [physicsMode, setPhysicsMode] = React.useState<XrPhysicsControllerMode>(readXrPhysicsPlaygroundControls().activeMode || 'roll')
  const [spatialTool, setSpatialToolState] = React.useState<SpatialCaptureToolId>(readSpatialCaptureTool())
  const sessionRef = React.useRef<XrSessionLike | null>(null)
  const sessionModeRef = React.useRef<XrSessionMode>(sessionMode)

  React.useEffect(() => {
    sessionModeRef.current = sessionMode
  }, [sessionMode])

  React.useEffect(() => {
    if (!active || surfaceKind !== 'graph') return undefined
    return subscribeXrPhysicsPlaygroundControls(controls => {
      setPhysicsMode(controls.activeMode || 'roll')
    })
  }, [active, surfaceKind])

  React.useEffect(() => {
    if (!active || surfaceKind !== 'spatial-capture') return undefined
    return subscribeSpatialCaptureTool(setSpatialToolState)
  }, [active, surfaceKind])

  React.useEffect(() => {
    const renderer = rendererRef.current
    if (renderer) renderer.xr.enabled = active
    if (!active) {
      setStatus('checking')
      setSessionSupport({})
      return
    }
    let cancelled = false
    const checkSupport = async () => {
      const xr = typeof navigator !== 'undefined' ? (navigator as NavigatorWithXr).xr : undefined
      if (!xr?.isSessionSupported || !xr?.requestSession) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      try {
        const supportEntries = await Promise.all(
          XR_SESSION_MODE_ORDER.map(async mode => {
            const supported = await xr.isSessionSupported?.(mode).catch(() => false)
            return [mode, supported === true] as const
          }),
        )
        if (cancelled) return
        const support = Object.fromEntries(supportEntries) as XrSessionSupport
        setSessionSupport(support)
        const nextMode = chooseXrSessionMode(support, sessionModeRef.current)
        if (nextMode) {
          setSessionMode(nextMode)
          setStatus('supported')
          return
        }
        setStatus('unsupported')
      } catch {
        if (!cancelled) setStatus('unsupported')
      }
    }
    void checkSupport()
    return () => {
      cancelled = true
      const activeSession = sessionRef.current
      sessionRef.current = null
      try {
        void activeSession?.end?.()
      } catch {
        void 0
      }
      if (renderer) renderer.xr.enabled = false
    }
  }, [active, rendererRef])

  const startOrEndSession = React.useCallback(async () => {
    const existing = sessionRef.current
    if (existing) {
      try {
        await existing.end?.()
      } finally {
        sessionRef.current = null
        setStatus('supported')
      }
      return
    }
    const renderer = rendererRef.current
    const xr = typeof navigator !== 'undefined' ? (navigator as NavigatorWithXr).xr : undefined
    if (!renderer || !xr?.requestSession) {
      setStatus('unsupported')
      return
    }
    try {
      const session = await xr.requestSession(sessionMode, buildXrSessionInit(sessionMode, resolveXrDomOverlayRoot(renderer)))
      const handleEnd = () => {
        sessionRef.current = null
        setStatus('supported')
        try {
          session.removeEventListener?.('end', handleEnd)
        } catch {
          void 0
        }
      }
      try {
        session.addEventListener?.('end', handleEnd)
      } catch {
        void 0
      }
      renderer.xr.enabled = true
      await renderer.xr.setSession(session as ThreeWebXrSession)
      sessionRef.current = session
      setStatus('active')
    } catch {
      setStatus('error')
    }
  }, [rendererRef, sessionMode])

  if (!active) return null
  if (surfaceKind === 'spatial-capture') {
    const activeSpatialToolLabel = readSpatialCaptureToolLabel(spatialTool)
    return (
      <>
        <section
          aria-label="XR spatial capture orientation"
          data-kg-canvas-xr-mode="1"
          data-kg-canvas-xr-surface-kind="spatial-capture"
          data-kg-canvas-xr-status={status}
          data-kg-canvas-xr-spatial-runtime={spatialRuntimeStatus}
          className="absolute left-1/2 top-14 z-[90] -translate-x-1/2 rounded-md bg-slate-900/82 px-4 py-1 text-xs font-medium text-slate-100 shadow-sm backdrop-blur"
        >
          <output>{activeSpatialToolLabel}</output>
        </section>
        <aside
          aria-label="XR minimap overlay"
          className="absolute z-[90] pointer-events-auto kg-canvas-minimap-overlay"
          data-kg-canvas-xr-minimap-overlay="1"
          data-kg-minimap-overlay-placement="bottom-left"
        >
          <MinimapSpatialViewCube />
        </aside>
      </>
    )
  }
  const canStart = status === 'supported' || status === 'active' || status === 'error'
  const bothModesSupported = sessionSupport['immersive-ar'] === true && sessionSupport['immersive-vr'] === true
  const label = status === 'active' ? 'Exit XR' : status === 'supported' ? 'Enter XR' : status === 'error' ? 'Retry XR' : status === 'unsupported' ? 'XR unavailable' : 'XR check'
  return (
    <section
      aria-label="XR Mode"
      data-kg-canvas-xr-mode="1"
      data-kg-canvas-xr-status={status}
      data-kg-canvas-xr-session-mode={sessionMode}
      data-kg-canvas-xr-ar-supported={sessionSupport['immersive-ar'] === true ? '1' : '0'}
      data-kg-canvas-xr-vr-supported={sessionSupport['immersive-vr'] === true ? '1' : '0'}
      className={`absolute right-3 top-3 z-[90] pointer-events-auto rounded-md border border-[var(--kg-border)] bg-[var(--kg-surface)]/90 p-1 shadow-sm backdrop-blur ${UI_RESPONSIVE_CANVAS_FLOATING_ACTION_ROW_CLASSNAME}`}
    >
      {bothModesSupported ? (
        <fieldset className="contents" aria-label="XR session type">
          <button
            type="button"
            data-kg-canvas-xr-session-option="immersive-ar"
            aria-pressed={sessionMode === 'immersive-ar'}
            className="rounded px-2 py-1 text-xs font-medium text-[var(--kg-text)] hover:bg-[var(--kg-surface-muted)] aria-pressed:bg-[var(--kg-surface-muted)]"
            onClick={() => setSessionMode('immersive-ar')}
          >
            AR
          </button>
          <button
            type="button"
            data-kg-canvas-xr-session-option="immersive-vr"
            aria-pressed={sessionMode === 'immersive-vr'}
            className="rounded px-2 py-1 text-xs font-medium text-[var(--kg-text)] hover:bg-[var(--kg-surface-muted)] aria-pressed:bg-[var(--kg-surface-muted)]"
            onClick={() => setSessionMode('immersive-vr')}
          >
            VR
          </button>
        </fieldset>
      ) : null}
      <fieldset className="contents" aria-label="XR physics control mode">
        {XR_PHYSICS_CONTROLLER_MODES.map(mode => (
          <button
            key={mode}
            type="button"
            data-kg-canvas-xr-physics-mode-option={mode}
            aria-pressed={physicsMode === mode}
            className="rounded px-2 py-1 text-xs font-medium capitalize text-[var(--kg-text)] hover:bg-[var(--kg-surface-muted)] aria-pressed:bg-[var(--kg-surface-muted)]"
            onClick={() => setXrPhysicsPlaygroundMode(mode)}
          >
            {mode}
          </button>
        ))}
      </fieldset>
      <button
        type="button"
        data-kg-canvas-xr-enter="1"
        className="rounded px-2 py-1 text-xs font-medium text-[var(--kg-text)] hover:bg-[var(--kg-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canStart}
        onClick={() => {
          void startOrEndSession()
        }}
      >
        {label}
      </button>
    </section>
  )
}
