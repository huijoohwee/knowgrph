import paymentWorkerModule from '../../../cloudflare/workers/knowgrph-payment/index.ts'
import { createFakeKnowgrphStorageWorkerEnv } from '@/__tests__/helpers/fakeKnowgrphStorageD1'
import { STRIPE_PAYMENT_ROUTE_PATHS } from 'grph-shared/payments/stripePaymentSsot'

const worker = (
  typeof (paymentWorkerModule as { fetch?: unknown }).fetch === 'function'
    ? paymentWorkerModule
    : (paymentWorkerModule as unknown as { default: typeof paymentWorkerModule }).default
) as typeof paymentWorkerModule

const textEncoder = new TextEncoder()

const buildStripeSignatureHeader = async (payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestamp}.${payload}`))
  const hex = Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}

const createPaymentsEnv = () => {
  const env = createFakeKnowgrphStorageWorkerEnv() as ReturnType<typeof createFakeKnowgrphStorageWorkerEnv> & Record<string, unknown>
  env.STRIPE_RESTRICTED_KEY = 'rk_'
  env.STRIPE_CHECKOUT_PRICE_ID = 'price_accept_payment'
  env.STRIPE_WEBHOOK_SECRET = 'whsec_'
  return env
}

export async function testKnowgrphPaymentWorkerCreatesStripeCheckoutSessionThroughServerRoute() {
  const env = createPaymentsEnv()
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init })
      return new Response(JSON.stringify({
        id: 'cs_accept_payment_1',
        url: 'https://checkout.stripe.com/c/pay/accept_payment_1',
        status: 'open',
        payment_status: 'unpaid',
        mode: 'payment',
        amount_total: 1200,
        currency: 'usd',
        client_reference_id: 'workspace-payment',
        metadata: { workspace_id: 'workspace-payment' },
        created: 1_777_500_000,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const response = await worker.fetch(
      new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession}`, {
        method: 'POST',
        headers: {
          origin: 'https://example.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          successUrl: 'https://example.com/knowgrph?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: 'https://example.com/knowgrph?stripeCheckout=cancel',
          workspaceId: 'workspace-payment',
        }),
      }),
      env as never,
    )

    if (!response.ok) throw new Error(`expected checkout create response ok, received ${response.status}: ${await response.text()}`)
    const body = await response.json() as { id?: string; url?: string; paymentStatus?: string }
    if (body.id !== 'cs_accept_payment_1' || !String(body.url || '').includes('checkout.stripe.com')) {
      throw new Error(`expected hosted Checkout Session response, got ${JSON.stringify(body)}`)
    }
    if (fetchCalls.length !== 1) throw new Error(`expected one Stripe API call, got ${fetchCalls.length}`)
    if (fetchCalls[0]?.url !== 'https://api.stripe.com/v1/checkout/sessions') {
      throw new Error(`expected Stripe Checkout Sessions endpoint, got ${JSON.stringify(fetchCalls[0]?.url)}`)
    }
    const headers = new Headers(fetchCalls[0]?.init?.headers)
    if (headers.get('authorization') !== 'Bearer rk_') {
      throw new Error('expected Worker to attach the server-managed Stripe key')
    }
    const params = new URLSearchParams(String(fetchCalls[0]?.init?.body || ''))
    if (params.get('line_items[0][price]') !== 'price_accept_payment') {
      throw new Error(`expected server-owned Stripe Price id, got ${params.toString()}`)
    }
    if (params.get('metadata[workspace_id]') !== 'workspace-payment') {
      throw new Error('expected checkout request to preserve workspace payment metadata')
    }
    const stored = env.DB.stripeCheckoutSessions.get('cs_accept_payment_1')
    if (!stored || stored.payment_status !== 'unpaid') {
      throw new Error(`expected checkout session to be stored server-side, got ${JSON.stringify(stored)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testKnowgrphPaymentWorkerRejectsStripeCheckoutWithoutServerPriceAuthority() {
  const env = createFakeKnowgrphStorageWorkerEnv() as ReturnType<typeof createFakeKnowgrphStorageWorkerEnv> & Record<string, unknown>
  env.STRIPE_RESTRICTED_KEY = 'rk_'
  const response = await worker.fetch(
    new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession}`, {
      method: 'POST',
      headers: {
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        successUrl: 'https://example.com/knowgrph?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/knowgrph?stripeCheckout=cancel',
      }),
    }),
    env as never,
  )
  if (response.status !== 500) {
    throw new Error(`expected missing server price authority to fail closed, received ${response.status}`)
  }
}

export async function testKnowgrphPaymentWorkerExplainsMissingStripeWorkerSecretScope() {
  const env = createFakeKnowgrphStorageWorkerEnv() as ReturnType<typeof createFakeKnowgrphStorageWorkerEnv> & Record<string, unknown>
  env.STRIPE_CHECKOUT_PRICE_ID = 'price_accept_payment'
  const response = await worker.fetch(
    new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession}`, {
      method: 'POST',
      headers: {
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        successUrl: 'https://example.com/knowgrph?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/knowgrph?stripeCheckout=cancel',
      }),
    }),
    env as never,
  )
  if (response.status !== 500) {
    throw new Error(`expected missing server Stripe key to fail closed, received ${response.status}`)
  }
  const body = await response.json() as { error?: string }
  const error = String(body.error || '')
  if (!error.includes('STRIPE_SECRET_KEY') || !error.includes('Pages project variables')) {
    throw new Error(`expected missing key error to identify Worker-vs-Pages secret scope, got ${JSON.stringify(body)}`)
  }
}

export async function testKnowgrphPaymentWorkerAcceptsStripeWebhookAndStoresCompletedSession() {
  const env = createPaymentsEnv()
  const payload = JSON.stringify({
    id: 'evt_accept_payment_1',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_accept_payment_webhook',
        status: 'complete',
        payment_status: 'paid',
        mode: 'payment',
        amount_total: 1200,
        currency: 'usd',
        customer: 'cus_accept_payment',
        customer_details: { email: 'paid@example.com' },
        metadata: { workspace_id: 'workspace-webhook' },
        created: 1_777_500_100,
      },
    },
  })
  const response = await worker.fetch(
    new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.webhook}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': await buildStripeSignatureHeader(payload, 'whsec_'),
      },
      body: payload,
    }),
    env as never,
  )
  if (!response.ok) throw new Error(`expected webhook response ok, received ${response.status}: ${await response.text()}`)
  const eventRow = env.DB.stripeWebhookEvents.get('evt_accept_payment_1')
  if (!eventRow || eventRow.event_type !== 'checkout.session.completed') {
    throw new Error(`expected verified webhook event to be stored, got ${JSON.stringify(eventRow)}`)
  }
  const sessionRow = env.DB.stripeCheckoutSessions.get('cs_accept_payment_webhook')
  if (!sessionRow || sessionRow.payment_status !== 'paid' || !sessionRow.completed_at) {
    throw new Error(`expected paid checkout session to be stored, got ${JSON.stringify(sessionRow)}`)
  }

  const statusResponse = await worker.fetch(
    new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession}?session_id=cs_accept_payment_webhook`),
    env as never,
  )
  if (!statusResponse.ok) throw new Error(`expected checkout status response ok, received ${statusResponse.status}`)
  const statusJson = await statusResponse.json() as { session?: { paymentStatus?: string; workspaceId?: string | null } }
  if (statusJson.session?.paymentStatus !== 'paid' || statusJson.session?.workspaceId !== 'workspace-webhook') {
    throw new Error(`expected paid stored checkout status, got ${JSON.stringify(statusJson)}`)
  }
}

export async function testKnowgrphPaymentWorkerRejectsStripeWebhookWithBadSignature() {
  const env = createPaymentsEnv()
  const payload = JSON.stringify({
    id: 'evt_accept_payment_bad_sig',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_bad_sig', payment_status: 'paid' } },
  })
  const response = await worker.fetch(
    new Request(`https://example.com${STRIPE_PAYMENT_ROUTE_PATHS.webhook}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1777500000,v1=bad',
      },
      body: payload,
    }),
    env as never,
  )
  if (response.status !== 400) {
    throw new Error(`expected bad webhook signature to fail closed, received ${response.status}`)
  }
  if (env.DB.stripeWebhookEvents.size !== 0 || env.DB.stripeCheckoutSessions.size !== 0) {
    throw new Error('expected bad webhook signature to avoid payment writes')
  }
}
