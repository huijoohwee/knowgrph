import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PaywallOverlay } from '@/features/payments/PaywallOverlay'
import { buildStripeCheckoutReturnUrls } from '@/features/payments/stripeCheckout'
import { STRIPE_PAYMENT_ROUTE_PATHS } from 'grph-shared/payments/stripePaymentSsot'

const waitUntil = async (predicate: () => boolean, timeoutMs = 1200): Promise<void> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for paywall checkout state')
}

export function testPaywallOverlayBuildsNeutralStripeCheckoutReturnUrls() {
  const urls = buildStripeCheckoutReturnUrls('https://airvio.co/knowgrph?doc=alpha&stripeCheckout=cancel&session_id=cs_old#chat')
  if (urls.successUrl !== 'https://airvio.co/knowgrph?doc=alpha&stripeCheckout=success#chat') {
    throw new Error(`expected success return URL to remove stale checkout params, got ${JSON.stringify(urls.successUrl)}`)
  }
  if (urls.cancelUrl !== 'https://airvio.co/knowgrph?doc=alpha&stripeCheckout=cancel#chat') {
    throw new Error(`expected cancel return URL to remove stale session id, got ${JSON.stringify(urls.cancelUrl)}`)
  }
}

export async function testPaywallOverlayOpensFromPaymentsStripeToggle() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setPaymentsStripePaywallEnabled(false)
    useGraphStore.getState().setFloatingPanelOpen(false)
    useGraphStore.getState().setFloatingPanelView('propsPanel')
    useGraphStore.getState().setPaymentsStripeCheckoutUrl('')

    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root, React.createElement(PaywallOverlay, { portalTarget: container } as never), {
      window: dom.window,
      frames: 2,
    })

    const before = container.textContent || ''
    if (before.includes('Paywall')) {
      throw new Error(`expected paywall overlay to be closed by default, got ${JSON.stringify(before)}`)
    }

    await act(async () => {
      useGraphStore.getState().setPaymentsStripePaywallEnabled(true)
      await waitForFrames(dom.window, 3)
    })

    const enabledButClosed = container.textContent || ''
    if (enabledButClosed.includes('Paywall')) {
      throw new Error(`expected paywall overlay to stay hidden when floating panel is closed, got ${JSON.stringify(enabledButClosed)}`)
    }

    await act(async () => {
      useGraphStore.getState().setFloatingPanelOpen(true)
      useGraphStore.getState().setFloatingPanelView('chat')
      await waitForFrames(dom.window, 3)
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
      if (root) await unmountReactRoot(root, { window: dom.window })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testPaywallOverlayGeneratesServerManagedCheckout() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  const originalFetch = globalThis.fetch
  let root: ReturnType<typeof createRoot> | null = null
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  const redirectedUrls: string[] = []
  const eventLog: string[] = []
  const originalAnchorClickDescriptor = Object.getOwnPropertyDescriptor(dom.window.HTMLAnchorElement.prototype, 'click')

  try {
    installDeterministicRaf(dom.window)
    dom.window.history.replaceState(null, '', '/knowgrph?doc=payment&stripeCheckout=success&session_id=cs_stale#paywall')
    Object.defineProperty(dom.window, 'open', {
      value: (url: string) => {
        throw new Error(`paywall checkout must use same-window redirect, got popup ${String(url || '')}`)
      },
      configurable: true,
    })
    Object.defineProperty(dom.window.HTMLAnchorElement.prototype, 'click', {
      value(this: HTMLAnchorElement) {
        redirectedUrls.push(this.href)
        eventLog.push(`redirect:${this.href}`)
      },
      configurable: true,
    })
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      eventLog.push('fetch')
      fetchCalls.push({ url: String(url), init })
      return {
        ok: true,
        json: async () => ({ id: 'cs_paywall_generated', url: 'https://checkout.stripe.com/c/pay/cs_paywall_generated' }),
      } as Response
    }) as typeof fetch

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setPaymentsStripePaywallEnabled(true)
    useGraphStore.getState().setFloatingPanelOpen(true)
    useGraphStore.getState().setFloatingPanelView('chat')
    useGraphStore.getState().setPaymentsStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_stale_browser_setting')

    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(root, React.createElement(PaywallOverlay, { portalTarget: container } as never), {
      window: dom.window,
      frames: 2,
    })

    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    const button = buttons.find(candidate => (candidate.textContent || '').includes('Open Checkout'))
    if (!button) {
      throw new Error(`expected paywall overlay to render Open Checkout button, got ${JSON.stringify(container.textContent || '')}`)
    }
    await act(async () => {
      button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 2)
    })
    await waitUntil(() => useGraphStore.getState().paymentsStripeCheckoutUrl.includes('cs_paywall_generated'))
    await waitUntil(() => redirectedUrls.length > 0)

    if (fetchCalls.length !== 1 || fetchCalls[0]?.url !== STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession) {
      throw new Error(`expected paywall checkout generation to call only the Worker route, got ${JSON.stringify(fetchCalls.map(call => call.url))}`)
    }
    const headers = fetchCalls[0]?.init?.headers as Record<string, string> | undefined
    if (headers?.Authorization) {
      throw new Error('expected paywall checkout generation not to send browser Authorization headers')
    }
    const body = JSON.parse(String(fetchCalls[0]?.init?.body || '{}')) as Record<string, unknown>
    if (body.successUrl !== 'http://localhost/knowgrph?doc=payment&stripeCheckout=success#paywall') {
      throw new Error(`expected normalized success return URL, got ${JSON.stringify(body)}`)
    }
    if (body.cancelUrl !== 'http://localhost/knowgrph?doc=payment&stripeCheckout=cancel#paywall') {
      throw new Error(`expected normalized cancel return URL, got ${JSON.stringify(body)}`)
    }
    if (redirectedUrls[0] !== 'https://checkout.stripe.com/c/pay/cs_paywall_generated') {
      throw new Error(`expected paywall to redirect this window to hosted Checkout URL, got ${JSON.stringify(redirectedUrls)}`)
    }
    if (redirectedUrls.includes('https://checkout.stripe.com/c/pay/cs_stale_browser_setting')) {
      throw new Error(`expected paywall to ignore stale browser-stored Checkout URLs, got ${JSON.stringify(redirectedUrls)}`)
    }
    if (eventLog[0] !== 'fetch' || eventLog[1] !== 'redirect:https://checkout.stripe.com/c/pay/cs_paywall_generated') {
      throw new Error(`expected paywall to fetch the Worker session before same-window redirect, got ${JSON.stringify(eventLog)}`)
    }
    if ((container.textContent || '').includes('cs_paywall_generated')) {
      throw new Error(`expected paywall overlay not to render hosted Checkout URLs, got ${JSON.stringify(container.textContent || '')}`)
    }
    if (!useGraphStore.getState().uiToasts.some(toast => toast.kind === 'success' && toast.message.includes('Stripe Checkout Session created'))) {
      throw new Error(`expected checkout generation success toast, got ${JSON.stringify(useGraphStore.getState().uiToasts)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
    if (originalAnchorClickDescriptor) {
      Object.defineProperty(dom.window.HTMLAnchorElement.prototype, 'click', originalAnchorClickDescriptor)
    }
    try {
      if (root) await unmountReactRoot(root, { window: dom.window })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
