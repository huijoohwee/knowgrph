import React from 'react'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'

const MERMAID_VISIBILITY_ROOT_MARGIN = '200px 0px 200px 0px'
const MERMAID_VISIBILITY_THRESHOLD = [0, 0.01]
const MERMAID_TOUCH_VIEWPORT_QUERY = '(max-width: 768px), (pointer: coarse)'

export function MermaidVisibilityGate({
  children,
}: {
  children: React.ReactNode
}) {
  const rootRef = React.useRef<HTMLElement>(null)
  const isTouchViewport = useMediaQuery(MERMAID_TOUCH_VIEWPORT_QUERY)
  const initialTouchViewport = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia !== 'function') return false
    return window.matchMedia(MERMAID_TOUCH_VIEWPORT_QUERY).matches
  }, [])
  const touchViewportActive = isTouchViewport || initialTouchViewport
  const [shouldRender, setShouldRender] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    if (shouldRender) return
    const element = rootRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setShouldRender(true)
      return
    }
    let cancelled = false
    const observer = new IntersectionObserver(
      entries => {
        if (cancelled) return
        const entry = entries && entries.length > 0 ? entries[0] : null
        if (!entry) return
        if (!entry.isIntersecting && entry.intersectionRatio <= 0) return
        setIsVisible(true)
        if (touchViewportActive) return
        setShouldRender(true)
        try {
          observer.disconnect()
        } catch {
          void 0
        }
      },
      {
        root: null,
        rootMargin: MERMAID_VISIBILITY_ROOT_MARGIN,
        threshold: MERMAID_VISIBILITY_THRESHOLD,
      },
    )
    try {
      observer.observe(element)
    } catch {
      try {
        observer.disconnect()
      } catch {
        void 0
      }
      setShouldRender(true)
      return
    }
    return () => {
      cancelled = true
      try {
        observer.disconnect()
      } catch {
        void 0
      }
    }
  }, [shouldRender, touchViewportActive])

  const gateState = shouldRender
    ? 'ready'
    : touchViewportActive && isVisible
      ? 'activatable'
      : 'pending'

  return (
    <section
      ref={rootRef}
      data-kg-mermaid-visibility-gate={gateState}
      aria-busy={!shouldRender}
      className={shouldRender ? undefined : 'min-h-12'}
    >
      {shouldRender ? children : null}
      {!shouldRender && touchViewportActive && isVisible ? (
        <section
          className="flex min-h-24 flex-col items-start justify-center gap-3 rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-3 text-sm text-[var(--kg-text-secondary)]"
          data-kg-mermaid-touch-placeholder="true"
        >
          <p className="leading-6">
            Mermaid stays deferred on touch viewports until you explicitly load the diagram.
          </p>
          <button
            type="button"
            className="App-toolbar__btn min-h-11 px-4 text-sm font-medium"
            data-kg-mermaid-touch-placeholder-activate="true"
            onClick={() => setShouldRender(true)}
          >
            Load Mermaid diagram
          </button>
        </section>
      ) : null}
    </section>
  )
}

export default MermaidVisibilityGate
