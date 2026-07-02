import React from 'react'

import { STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'
import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'

export function useStoryboardWidgetSurfaceAnchors(args: {
  active: boolean
  editorRuntimeActive: boolean
  rootRef: React.RefObject<HTMLElement | null>
}) {
  const [canvasWindowOffset, setCanvasWindowOffset] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const canvasWindowOffsetRef = React.useRef(canvasWindowOffset)
  const [inspectorPortalHost, setInspectorPortalHost] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    canvasWindowOffsetRef.current = canvasWindowOffset
  }, [canvasWindowOffset])

  const resolveCanvasWindowAnchorElement = React.useCallback((): HTMLElement | null => {
    return resolveCanvasViewportMeasureElement(args.rootRef.current)
  }, [args.rootRef])

  const resolveCanonicalCanvasWindowOffset = React.useCallback((fallbackRect?: Pick<DOMRect, 'left' | 'top'> | null) => {
    const anchorEl = resolveCanvasWindowAnchorElement()
    const anchorRect = anchorEl?.getBoundingClientRect() || fallbackRect || null
    const left = Number.isFinite(anchorRect?.left) ? Number(anchorRect?.left) : 0
    const top = Number.isFinite(anchorRect?.top) ? Number(anchorRect?.top) : 0
    return { left, top }
  }, [resolveCanvasWindowAnchorElement])

  const setCanvasWindowOffsetFromRect = React.useCallback((rect: DOMRect) => {
    const { left, top } = resolveCanonicalCanvasWindowOffset(rect)
    const prev = canvasWindowOffsetRef.current
    if (prev.left === left && prev.top === top) return
    setCanvasWindowOffset({ left, top })
  }, [resolveCanonicalCanvasWindowOffset])

  React.useEffect(() => {
    if (!args.editorRuntimeActive) return
    if (typeof window === 'undefined') return
    const measure = () => {
      const { left, top } = resolveCanonicalCanvasWindowOffset()
      const prev = canvasWindowOffsetRef.current
      if (prev.left === left && prev.top === top) return
      setCanvasWindowOffset({ left, top })
    }
    const onAny = () => {
      requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onAny, true)
    window.addEventListener('resize', onAny)
    return () => {
      window.removeEventListener('scroll', onAny, true)
      window.removeEventListener('resize', onAny)
    }
  }, [args.editorRuntimeActive, resolveCanonicalCanvasWindowOffset])

  const resolveInspectorPortalHost = React.useCallback(() => {
    if (!args.active) return null
    if (typeof document === 'undefined') return null
    try {
      const el = document.getElementById(STORYBOARD_WIDGET_INSPECTOR_PORTAL_SLOT_ID)
      if (!el) return null
      if (!(el instanceof HTMLElement)) return null
      if (!el.isConnected) return null
      return el
    } catch {
      return null
    }
  }, [args.active])

  React.useEffect(() => {
    if (!args.active) {
      setInspectorPortalHost(null)
      return
    }
    const resolved = resolveInspectorPortalHost()
    setInspectorPortalHost(prev => (prev === resolved ? prev : resolved))
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      const nextResolved = resolveInspectorPortalHost()
      setInspectorPortalHost(prev => (prev === nextResolved ? prev : nextResolved))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [args.active, resolveInspectorPortalHost])

  return {
    canvasWindowOffset,
    canvasWindowOffsetRef,
    inspectorPortalHost,
    setCanvasWindowOffsetFromRect,
  }
}
