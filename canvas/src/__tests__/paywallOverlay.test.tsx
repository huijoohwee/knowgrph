import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PaywallOverlay } from '@/features/payments/PaywallOverlay'

const waitForFrames = async (raf: ((cb: (ts: number) => void) => number) | undefined, count = 3) => {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      if (typeof raf === 'function') raf(() => resolve())
      else setTimeout(() => resolve(), 0)
    })
  }
}

export async function testPaywallOverlayOpensFromPaymentsStripeToggle() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setPaymentsStripePaywallEnabled(false)
    useGraphStore.getState().setFloatingPanelOpen(false)
    useGraphStore.getState().setFloatingPanelView('propsPanel')
    useGraphStore.getState().setPaymentsStripeCheckoutUrl('')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    await act(async () => {
      root?.render(React.createElement(PaywallOverlay, { portalTarget: container } as never))
      await waitForFrames(anyWindow.requestAnimationFrame, 2)
    })

    const before = container.textContent || ''
    if (before.includes('Paywall')) {
      throw new Error(`expected paywall overlay to be closed by default, got ${JSON.stringify(before)}`)
    }

    await act(async () => {
      useGraphStore.getState().setPaymentsStripePaywallEnabled(true)
      await waitForFrames(anyWindow.requestAnimationFrame, 3)
    })

    const enabledButClosed = container.textContent || ''
    if (enabledButClosed.includes('Paywall')) {
      throw new Error(`expected paywall overlay to stay hidden when floating panel is closed, got ${JSON.stringify(enabledButClosed)}`)
    }

    await act(async () => {
      useGraphStore.getState().setFloatingPanelOpen(true)
      useGraphStore.getState().setFloatingPanelView('chat')
      await waitForFrames(anyWindow.requestAnimationFrame, 3)
    })

    const after = container.textContent || ''
    if (!after.includes('Paywall')) {
      throw new Error(`expected paywall overlay to render when enabled and chat panel is open, got ${JSON.stringify(after)}`)
    }
    if (!after.includes('Open Checkout')) {
      throw new Error(`expected paywall overlay to include Stripe Checkout controls, got ${JSON.stringify(after)}`)
    }
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
