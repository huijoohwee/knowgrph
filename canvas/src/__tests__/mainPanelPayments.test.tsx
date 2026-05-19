import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  STRIPE_PAYMENT_ROUTE_PATHS,
  STRIPE_PROJECTS_URL,
} from 'grph-shared/payments/stripePaymentSsot'

export async function testMainPanelPaymentsRendersStripeProviderSurface() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(MainPanel, { requestedTab: 'payments', requestedSearchQuery: '' } as never), {
      window: dom.window,
      frames: 4,
    })

    const text = container.textContent || ''
    const expectedTokens = [
      'Payments',
      'Key',
      'Type',
      'Value',
      'Providers',
      'Stripe Payment API',
      'stripeApi.base_url',
      'stripeApi.auth.secret_key',
      'stripeApi.runtime.env_scope',
      'stripeApi.checkout.server_price_authority',
      'stripeApi.projects.url',
      'Cloudflare Pages project variables',
      STRIPE_PROJECTS_URL,
      'stripeApi.webhooks.signing_secret',
      'stripeApi.checkout.session_url',
      STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession,
      STRIPE_PAYMENT_ROUTE_PATHS.webhook,
      'Generate (secure)',
    ]
    expectedTokens.forEach(token => {
      if (!text.includes(token)) {
        throw new Error(`expected payments tab to include ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
      }
    })
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
