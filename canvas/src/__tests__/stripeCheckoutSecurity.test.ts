import { createStripeHostedCheckoutSessionUrl } from '@/features/payments/stripeCheckout'
import { STRIPE_PAYMENT_ROUTE_PATHS } from 'grph-shared/payments/stripePaymentSsot'

export async function testStripeCheckoutUsesServerManagedRouteOnly() {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init })
      return {
        ok: true,
        json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/test_123' }),
      } as Response
    }) as typeof fetch

    const result = await createStripeHostedCheckoutSessionUrl({
      successUrl: 'http://localhost:5173/?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:5173/?stripeCheckout=cancel',
    })

    if (result.url !== 'https://checkout.stripe.com/c/pay/test_123') {
      throw new Error(`expected hosted Checkout url, got ${JSON.stringify(result.url)}`)
    }
    if (fetchCalls.length !== 1) {
      throw new Error(`expected one fetch call, got ${fetchCalls.length}`)
    }
    if (fetchCalls[0]?.url !== STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession) {
      throw new Error(`expected server-managed checkout route, got ${JSON.stringify(fetchCalls[0]?.url)}`)
    }
    const headers = fetchCalls[0]?.init?.headers as Record<string, string> | undefined
    if (headers?.Authorization) {
      throw new Error('expected no Authorization header from browser checkout helper')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
