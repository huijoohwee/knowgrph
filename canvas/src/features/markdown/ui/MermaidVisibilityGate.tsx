import React from 'react'

const MERMAID_VISIBILITY_ROOT_MARGIN = '200px 0px 200px 0px'
const MERMAID_VISIBILITY_THRESHOLD = [0, 0.01]

export function MermaidVisibilityGate({
  children,
}: {
  children: React.ReactNode
}) {
  const rootRef = React.useRef<HTMLElement>(null)
  const [shouldRender, setShouldRender] = React.useState(false)

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
  }, [shouldRender])

  return (
    <section
      ref={rootRef}
      data-kg-mermaid-visibility-gate={shouldRender ? 'ready' : 'pending'}
      aria-busy={!shouldRender}
      className={shouldRender ? undefined : 'min-h-12'}
    >
      {shouldRender ? children : null}
    </section>
  )
}

export default MermaidVisibilityGate
