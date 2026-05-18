import React from 'react'
import { useFrame } from '@react-three/fiber'
import type { WebGLRenderer } from 'three'

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
    isSessionSupported?: (mode: string) => Promise<boolean>
    requestSession?: (mode: string, options?: unknown) => Promise<XrSessionLike>
  }
}

export function CanvasXrEntryPanel({
  active,
  rendererRef,
}: {
  active: boolean
  rendererRef: React.MutableRefObject<WebGLRenderer | null>
}) {
  const [status, setStatus] = React.useState<'checking' | 'supported' | 'unsupported' | 'active' | 'error'>('checking')
  const [sessionMode, setSessionMode] = React.useState<'immersive-vr' | 'immersive-ar'>('immersive-vr')
  const sessionRef = React.useRef<XrSessionLike | null>(null)

  React.useEffect(() => {
    const renderer = rendererRef.current
    if (renderer) renderer.xr.enabled = active
    if (!active) {
      setStatus('checking')
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
        const vrSupported = await xr.isSessionSupported('immersive-vr')
        const arSupported = vrSupported ? false : await xr.isSessionSupported('immersive-ar').catch(() => false)
        if (cancelled) return
        if (vrSupported) {
          setSessionMode('immersive-vr')
          setStatus('supported')
          return
        }
        if (arSupported) {
          setSessionMode('immersive-ar')
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
      const currentRenderer = rendererRef.current
      if (currentRenderer) currentRenderer.xr.enabled = false
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
      const session = await xr.requestSession(sessionMode, {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      })
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
  const canStart = status === 'supported' || status === 'active' || status === 'error'
  const label = status === 'active' ? 'Exit XR' : status === 'supported' ? 'Enter XR' : status === 'error' ? 'Retry XR' : 'XR preview'
  return (
    <section
      aria-label="XR Mode"
      data-kg-canvas-xr-mode="1"
      data-kg-canvas-xr-status={status}
      className="absolute right-3 top-3 z-[90] pointer-events-auto rounded-md border border-[var(--kg-border)] bg-[var(--kg-surface)]/90 p-1 shadow-sm backdrop-blur"
    >
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
