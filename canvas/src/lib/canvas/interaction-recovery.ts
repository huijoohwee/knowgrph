import { useGraphStore } from '@/hooks/useGraphStore'
import { getGlobalUserSelectLockCountForTests, resetGlobalUserSelectLock } from '@/lib/canvas/interaction-user-select'

let installed = false

export function runGlobalInteractionCleanup(args?: { resetViewportControllers?: boolean }): void {
  const resetViewportControllers = args?.resetViewportControllers === true
  const clearDraggingFlags = () => {
    try {
      const st = useGraphStore.getState()
      if (st.flowWidgetDraggingNodeId) st.setFlowWidgetDraggingNodeId(null)
    } catch {
      void 0
    }
  }

  const resetViewportControllersInDom = () => {
    try {
      if (typeof document === 'undefined') return
      const els = Array.from(
        document.querySelectorAll('[data-kg-canvas-interactive="1"],svg[data-kg-canvas-interactive="1"]'),
      ) as unknown as Array<{ __kgViewportControllerDestroy?: (() => void) | null }>
      for (let i = 0; i < els.length; i += 1) {
        const el = els[i]
        const fn = el?.__kgViewportControllerDestroy
        if (typeof fn !== 'function') continue
        try {
          fn()
        } catch {
          void 0
        }
      }
    } catch {
      void 0
    }
  }

  const clearUserSelectIfLocked = () => {
    try {
      if (getGlobalUserSelectLockCountForTests() > 0) resetGlobalUserSelectLock()
    } catch {
      void 0
    }
  }

  const normalizeInlineDragStylesIfStuck = () => {
    try {
      if (typeof document === 'undefined') return false
      const body = document.body
      const docEl = document.documentElement
      if (!body || !docEl) return false
      const stuck = body.style.userSelect === 'none' || docEl.style.userSelect === 'none' || body.style.cursor !== '' || docEl.style.cursor !== ''
      if (!stuck) return false
      body.style.userSelect = ''
      body.style.cursor = ''
      docEl.style.userSelect = ''
      docEl.style.cursor = ''
      return true
    } catch {
      return false
    }
  }

  clearDraggingFlags()
  clearUserSelectIfLocked()
  const normalized = normalizeInlineDragStylesIfStuck()
  if (resetViewportControllers || normalized) resetViewportControllersInDom()
}

export function installGlobalInteractionRecovery(): void {
  if (installed) return
  installed = true
  if (typeof window === 'undefined') return

  const onPointerEnd = () => {
    // Destroying the viewport controller only clears transient drag/wheel state;
    // listeners stay bound and future interactions recreate state normally.
    runGlobalInteractionCleanup({ resetViewportControllers: true })
  }

  const onBlur = () => {
    runGlobalInteractionCleanup({ resetViewportControllers: true })
  }

  const onVisibility = () => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') onBlur()
    } catch {
      void 0
    }
  }

  const onPointerDownCapture = () => {
    runGlobalInteractionCleanup({ resetViewportControllers: false })
  }

  window.addEventListener('pointerup', onPointerEnd, { capture: true })
  window.addEventListener('pointercancel', onPointerEnd, { capture: true })
  window.addEventListener('blur', onBlur)
  window.addEventListener('pointerdown', onPointerDownCapture, { capture: true })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
}
