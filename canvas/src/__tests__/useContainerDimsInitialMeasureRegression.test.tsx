import React from 'react'
import { createRoot } from 'react-dom/client'

import { useContainerDims } from '@/hooks/useContainerDims'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

function DimsProbe() {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const dims = useContainerDims(ref)
  return (
    <section ref={ref} data-testid="probe">
      {`${Math.floor(dims.width)}x${Math.floor(dims.height)}@${Math.floor(dims.left)},${Math.floor(dims.top)}`}
    </section>
  )
}

function DimsProbeWithViewportSource() {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const dims = useContainerDims(ref, {
    resolveMeasureElement: self => {
      if (!self) return null
      const viewportRoot = self.closest('[data-kg-canvas-viewport-root="1"]')
      return viewportRoot instanceof HTMLElement ? viewportRoot : self
    },
  })
  return (
    <section data-kg-canvas-viewport-root="1" data-testid="viewport-root">
      <div ref={ref} data-testid="probe-inner">
        {`${Math.floor(dims.width)}x${Math.floor(dims.height)}@${Math.floor(dims.left)},${Math.floor(dims.top)}`}
      </div>
    </section>
  )
}

function DimsProbeWithStableResolverWrappedByFreshOptions() {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [tick, setTick] = React.useState(0)
  const resolveViewportMeasureElement = React.useCallback((self: HTMLElement | null) => {
    if (!self) return null
    const viewportRoot = self.closest('[data-kg-canvas-viewport-root="1"]')
    return viewportRoot instanceof HTMLElement ? viewportRoot : self
  }, [])
  const dims = useContainerDims(ref, {
    resolveMeasureElement: resolveViewportMeasureElement,
  })

  React.useEffect(() => {
    if (tick >= 1) return
    setTick(1)
  }, [tick])

  return (
    <section data-kg-canvas-viewport-root="1" data-testid="viewport-root-stable-options">
      <div ref={ref} data-testid="probe-inner-stable-options">
        {`${tick}:${Math.floor(dims.width)}x${Math.floor(dims.height)}@${Math.floor(dims.left)},${Math.floor(dims.top)}`}
      </div>
    </section>
  )
}

export async function testUseContainerDimsMeasuresMountedRectBeforeResizeObserverTicks() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
    ;(dom.window as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub

    const proto = dom.window.HTMLElement.prototype as HTMLElement
    const originalGetBoundingClientRect = proto.getBoundingClientRect
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      const el = this as HTMLElement
      if (el.dataset.testid === 'probe') {
        return {
          left: 540,
          top: 24,
          width: 260,
          height: 600,
          right: 800,
          bottom: 624,
          x: 540,
          y: 24,
          toJSON: () => ({}),
        } as DOMRect
      }
      return originalGetBoundingClientRect.call(this)
    }

    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(<DimsProbe />)

    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      const text = container.textContent || ''
      if (text.includes('260x600@540,24')) return
      await new Promise<void>(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`expected initial measured rect, got ${container.textContent || '<empty>'}`)
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testUseContainerDimsCanResolveCanonicalViewportSource() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
    ;(dom.window as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub

    const proto = dom.window.HTMLElement.prototype as HTMLElement
    const originalGetBoundingClientRect = proto.getBoundingClientRect
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      const el = this as HTMLElement
      if (el.dataset.testid === 'viewport-root') {
        return {
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          right: 1920,
          bottom: 1080,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect
      }
      if (el.dataset.testid === 'probe-inner') {
        return {
          left: 540,
          top: 24,
          width: 260,
          height: 600,
          right: 800,
          bottom: 624,
          x: 540,
          y: 24,
          toJSON: () => ({}),
        } as DOMRect
      }
      return originalGetBoundingClientRect.call(this)
    }

    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(<DimsProbeWithViewportSource />)

    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      const text = container.textContent || ''
      if (text.includes('1920x1080@0,0')) return
      await new Promise<void>(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`expected canonical viewport rect, got ${container.textContent || '<empty>'}`)
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testUseContainerDimsIgnoresFreshOptionsWrapperWhenResolverIsStable() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
    ;(dom.window as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub

    const proto = dom.window.HTMLElement.prototype as HTMLElement
    const originalGetBoundingClientRect = proto.getBoundingClientRect
    dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
      const el = this as HTMLElement
      if (el.dataset.testid === 'viewport-root-stable-options') {
        return {
          left: 12,
          top: 18,
          width: 1440,
          height: 900,
          right: 1452,
          bottom: 918,
          x: 12,
          y: 18,
          toJSON: () => ({}),
        } as DOMRect
      }
      if (el.dataset.testid === 'probe-inner-stable-options') {
        return {
          left: 100,
          top: 120,
          width: 260,
          height: 600,
          right: 360,
          bottom: 720,
          x: 100,
          y: 120,
          toJSON: () => ({}),
        } as DOMRect
      }
      return originalGetBoundingClientRect.call(this)
    }

    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(<DimsProbeWithStableResolverWrappedByFreshOptions />)

    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      const text = container.textContent || ''
      if (text.includes('1:1440x900@12,18')) return
      await new Promise<void>(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`expected stable inline options wrapper not to disrupt viewport measurement, got ${container.textContent || '<empty>'}`)
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
