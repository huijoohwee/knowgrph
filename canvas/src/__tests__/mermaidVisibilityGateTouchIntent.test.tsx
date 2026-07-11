import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MermaidVisibilityGate } from '@/features/markdown/ui/MermaidVisibilityGate'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

type FakeIntersectionObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void

export async function testMermaidVisibilityGateRequiresExplicitTouchActivationOnceVisible() {
  const { dom, restore } = initJsdomHarness()
  const previousMatchMedia = dom.window.matchMedia
  const previousIntersectionObserver = (globalThis as typeof globalThis & {
    IntersectionObserver?: typeof IntersectionObserver
  }).IntersectionObserver
  const previousWindowIntersectionObserver = (dom.window as Window & {
    IntersectionObserver?: typeof IntersectionObserver
  }).IntersectionObserver
  const observerCallbacks: FakeIntersectionObserverCallback[] = []
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    dom.window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 768px), (pointer: coarse)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    })) as Window['matchMedia']

    class FakeIntersectionObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]
      constructor(private readonly callback: FakeIntersectionObserverCallback) {
        observerCallbacks.push(callback)
      }
      disconnect(): void {}
      observe(): void {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      unobserve(): void {}
    }

    ;(globalThis as typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver
    ;(dom.window as Window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver

    await mountReactRoot(root, (
      <MermaidVisibilityGate>
        <section data-kg-test-mermaid-child="true">Mermaid runtime</section>
      </MermaidVisibilityGate>
    ), {
      window: dom.window as unknown as Window,
      frames: 2,
    })

    const gateBeforeVisible = container.querySelector('[data-kg-mermaid-visibility-gate="pending"]') as HTMLElement | null
    if (!gateBeforeVisible) throw new Error('expected Mermaid visibility gate to remain pending before the observer reports visibility')
    if (container.querySelector('[data-kg-test-mermaid-child="true"]')) {
      throw new Error('expected Mermaid child not to mount before visibility or explicit activation')
    }
    if (observerCallbacks.length === 0) {
      throw new Error('expected Mermaid visibility gate to register an IntersectionObserver callback')
    }

    await act(async () => {
      observerCallbacks[0]([
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target: gateBeforeVisible,
        } as unknown as IntersectionObserverEntry,
      ], {} as IntersectionObserver)
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const activationState = container.querySelector('[data-kg-mermaid-visibility-gate="activatable"]') as HTMLElement | null
    if (!activationState) throw new Error('expected touch Mermaid gate to move into activatable state once visible')
    if (container.querySelector('[data-kg-test-mermaid-child="true"]')) {
      throw new Error('expected touch Mermaid gate to keep the heavy child deferred until explicit activation')
    }

    const activateButton = container.querySelector('[data-kg-mermaid-touch-placeholder-activate="true"]') as HTMLButtonElement | null
    if (!activateButton) throw new Error('expected touch Mermaid gate to render the mobile activation control')
    await act(async () => {
      activateButton.click()
      await waitForFrames(dom.window as unknown as Window, 2)
    })

    const readyState = container.querySelector('[data-kg-mermaid-visibility-gate="ready"]') as HTMLElement | null
    if (!readyState) throw new Error('expected touch Mermaid gate to enter ready state after activation')
    if (!container.querySelector('[data-kg-test-mermaid-child="true"]')) {
      throw new Error('expected touch Mermaid gate to mount the deferred child after activation')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    dom.window.matchMedia = previousMatchMedia
    ;(globalThis as typeof globalThis & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
      previousIntersectionObserver
    ;(dom.window as Window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver =
      previousWindowIntersectionObserver
    restore()
  }
}
