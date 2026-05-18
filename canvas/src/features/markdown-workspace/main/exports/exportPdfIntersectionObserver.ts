export const withForcedIntersectingObserver = (): (() => void) => {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
    return () => { void 0 }
  }
  const OriginalIntersectionObserver = window.IntersectionObserver
  class ForcedIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: ReadonlyArray<number> = [0]
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }
    observe(target: Element): void {
      const entry = {
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
      } as IntersectionObserverEntry
      setTimeout(() => {
        try {
          this.callback([entry], this)
        } catch {
          void 0
        }
      }, 0)
    }
    unobserve(): void { void 0 }
    disconnect(): void { void 0 }
    takeRecords(): IntersectionObserverEntry[] { return [] }
  }
  ;(window as Window & { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    ForcedIntersectionObserver as unknown as typeof IntersectionObserver
  return () => {
    ;(window as Window & { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = OriginalIntersectionObserver
  }
}
