import React from 'react'

import { FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID } from '@/lib/config'

export function useFlowEditorSurfaceAnchors(args: {
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

  const setCanvasWindowOffsetFromRect = React.useCallback((rect: DOMRect) => {
    const left = Number.isFinite(rect.left) ? rect.left : 0
    const top = Number.isFinite(rect.top) ? rect.top : 0
    const prev = canvasWindowOffsetRef.current
    if (prev.left === left && prev.top === top) return
    setCanvasWindowOffset({ left, top })
  }, [])

  const resolveCanvasWindowAnchorElement = React.useCallback((): HTMLElement | null => {
    const self = args.rootRef.current
    if (!self) return null
    const viewportRoot = self.closest('[data-kg-canvas-viewport-root="1"]')
    return viewportRoot instanceof HTMLElement ? viewportRoot : self
  }, [args.rootRef])

  React.useEffect(() => {
    if (!args.editorRuntimeActive) return
    if (typeof window === 'undefined') return
    const measure = () => {
      const el = resolveCanvasWindowAnchorElement()
      if (!el) return
      const rect = el.getBoundingClientRect()
      const left = Number.isFinite(rect.left) ? rect.left : 0
      const top = Number.isFinite(rect.top) ? rect.top : 0
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
  }, [args.editorRuntimeActive, resolveCanvasWindowAnchorElement])

  const resolveInspectorPortalHost = React.useCallback(() => {
    if (!args.active) return null
    if (typeof document === 'undefined') return null
    try {
      const el = document.getElementById(FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID)
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
