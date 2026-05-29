import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import paymentWorkerModule from '../../../cloudflare/workers/knowgrph-payment/index.ts'
import { createFakeKnowgrphStorageWorkerEnv } from '@/__tests__/helpers/fakeKnowgrphStorageD1'
import { AGENTIC_COMMERCE_ROUTE_PATHS } from 'grph-shared/payments/agenticCommerceSsot'

const worker = (
  typeof (paymentWorkerModule as { fetch?: unknown }).fetch === 'function'
    ? paymentWorkerModule
    : (paymentWorkerModule as unknown as { default: typeof paymentWorkerModule }).default
) as typeof paymentWorkerModule

const createCommerceEnv = () => {
  const env = createFakeKnowgrphStorageWorkerEnv() as ReturnType<typeof createFakeKnowgrphStorageWorkerEnv> & Record<string, unknown>
  env.SELLER_ID = 'seller-neutral'
  env.CHECKOUT_BASE_URL = 'https://commerce.example'
  env.WEB3_ENABLED = 'true'
  env.OPENBOX_API_URL = 'https://openbox.example/risk'
  env.OPENBOX_API_KEY = 'openbox_test_key'
  return env
}

const createCheckoutSession = async (env: ReturnType<typeof createCommerceEnv>, overrides: Record<string, unknown> = {}) => {
  const response = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': String(overrides.idempotencyKey || 'checkout-idempotency-1'),
      },
      body: JSON.stringify({
        amount_total: 2500,
        currency: 'usd',
        buyer: { email: 'buyer@example.com' },
        ...overrides,
      }),
    }),
    env as never,
  )
  if (!response.ok) throw new Error(`expected session create ok, received ${response.status}: ${await response.text()}`)
  return await response.json() as { session: { id: string; status: string; idempotency_key: string; deposit_address?: string | null } }
}

export async function testAgenticCommerceAcpConfigExposesNeutralRoutes() {
  const env = createCommerceEnv()
  const response = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig}`),
    env as never,
  )
  if (!response.ok) throw new Error(`expected acp config response ok, received ${response.status}`)
  const body = await response.json() as {
    api_version?: string
    seller?: { id?: string }
    endpoints?: { create_session?: string; complete_session?: string }
    payment_methods?: string[]
    capabilities?: { web3?: boolean; risk_signals?: boolean }
    extensions?: string[]
  }
  if (body.api_version !== '2026-01-30' || body.seller?.id !== 'seller-neutral') {
    throw new Error(`expected configured ACP seller and version, got ${JSON.stringify(body)}`)
  }
  if (body.endpoints?.create_session !== 'https://commerce.example/checkout/sessions') {
    throw new Error(`expected neutral checkout endpoint, got ${JSON.stringify(body.endpoints)}`)
  }
  if (!body.payment_methods?.includes('stripe_delegate_token') || !body.payment_methods.includes('erc20')) {
    throw new Error(`expected fiat and web3 payment methods, got ${JSON.stringify(body.payment_methods)}`)
  }
  if (body.capabilities?.web3 !== true || body.capabilities?.risk_signals !== true || !body.extensions?.includes('x-web3')) {
    throw new Error(`expected ACP commerce capabilities, got ${JSON.stringify(body)}`)
  }
}

export async function testAgenticCommerceCheckoutLifecyclePersistsProofAndTrace() {
  const env = createCommerceEnv()
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) !== 'https://openbox.example/risk') throw new Error(`unexpected fetch target ${String(url)}`)
      const headers = new Headers(init?.headers)
      if (headers.get('authorization') !== 'Bearer openbox_test_key') throw new Error('expected OpenBOX bearer token')
      const requestBody = JSON.parse(String(init?.body || '{}')) as { session_id?: string; action?: string }
      return new Response(JSON.stringify({
        score: 0.18,
        action: 'authorized',
        session_id: requestBody.session_id,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const created = await createCheckoutSession(env)
    if (created.session.status !== 'open' || created.session.idempotency_key !== 'checkout-idempotency-1') {
      throw new Error(`expected open idempotent session, got ${JSON.stringify(created)}`)
    }
    const storedBefore = env.DB.agenticCommerceSessions.get(created.session.id)
    if (!storedBefore || String(storedBefore.request_json).includes('vault_token')) {
      throw new Error(`expected create payload to be stored without payment token, got ${JSON.stringify(storedBefore)}`)
    }

    const completeResponse = await worker.fetch(
      new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/${created.session.id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vault_token: 'vlt_never_persist' }),
      }),
      env as never,
    )
    if (!completeResponse.ok) throw new Error(`expected complete response ok, received ${completeResponse.status}: ${await completeResponse.text()}`)
    const completed = await completeResponse.json() as {
      session?: { status?: string; risk_signals?: Array<{ source?: string; score?: number; action?: string }> }
      proof?: { session_id?: string; openbox_risk?: { score?: number; action?: string; session_id?: string } }
    }
    if (completed.session?.status !== 'complete' || completed.proof?.session_id !== created.session.id) {
      throw new Error(`expected completed session and proof, got ${JSON.stringify(completed)}`)
    }
    if (completed.proof?.openbox_risk?.score !== 0.18 || completed.proof.openbox_risk.action !== 'authorized') {
      throw new Error(`expected OpenBOX risk proof block, got ${JSON.stringify(completed.proof)}`)
    }
    const storedAfter = env.DB.agenticCommerceSessions.get(created.session.id)
    if (String(storedAfter?.request_json || '').includes('vlt_never_persist') || String(storedAfter?.response_json || '').includes('vlt_never_persist')) {
      throw new Error('expected delegate payment token to avoid D1 persistence')
    }
    const proofRows = Array.from(env.DB.agenticCommerceProofs.values())
    if (proofRows.length !== 1 || !String(proofRows[0].proof_json || '').includes('openbox_risk')) {
      throw new Error(`expected one commerce proof with OpenBOX risk, got ${JSON.stringify(proofRows)}`)
    }
    const traceRows = Array.from(env.DB.agenticCommerceTraceEvents.values())
    if (traceRows.length !== 1 || traceRows[0].event_type !== 'knowgrph.commerce.settle') {
      throw new Error(`expected settle trace event, got ${JSON.stringify(traceRows)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testAgenticCommerceWeb3CheckoutReturnsDeterministicDepositAddress() {
  const env = createCommerceEnv()
  const created = await createCheckoutSession(env, {
    idempotencyKey: 'web3-idempotency-1',
    currency: 'usdc',
    'x-web3': {
      payment_method: 'erc20',
      payer_did: 'did:debox:0xabc',
    },
  })
  if (created.session.status !== 'pending_onchain') {
    throw new Error(`expected pending_onchain web3 session, got ${JSON.stringify(created)}`)
  }
  if (!/^0x[0-9a-f]{40}$/i.test(String(created.session.deposit_address || ''))) {
    throw new Error(`expected deterministic L2 deposit address, got ${JSON.stringify(created.session)}`)
  }
  const repeated = await createCheckoutSession(env, {
    idempotencyKey: 'web3-idempotency-1',
    currency: 'usdc',
    'x-web3': {
      payment_method: 'erc20',
      payer_did: 'did:debox:0xabc',
    },
  })
  if (repeated.session.id !== created.session.id || repeated.session.deposit_address !== created.session.deposit_address) {
    throw new Error(`expected idempotent web3 session reuse, got ${JSON.stringify({ created, repeated })}`)
  }
}

export async function testAgenticCommerceWeb3SettlementWritesProofNode() {
  const env = createCommerceEnv()
  delete env.OPENBOX_API_URL
  const created = await createCheckoutSession(env, {
    idempotencyKey: 'web3-settle-idempotency-1',
    currency: 'usdc',
    'x-web3': {
      payment_method: 'erc20',
      payer_did: 'did:debox:0xdef',
    },
  })
  const completeResponse = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/${created.session.id}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tx_hash: '0xabc123',
        attestation_uid: 'eas_attestation_123',
      }),
    }),
    env as never,
  )
  if (!completeResponse.ok) throw new Error(`expected web3 complete response ok, received ${completeResponse.status}: ${await completeResponse.text()}`)
  const body = await completeResponse.json() as {
    session?: { status?: string }
    proof?: { attestation_uid?: string; canvas_node?: { type?: string; tx_hash?: string; attestation_uid?: string } }
  }
  if (body.session?.status !== 'complete' || body.proof?.attestation_uid !== 'eas_attestation_123') {
    throw new Error(`expected web3 session to complete with attestation UID, got ${JSON.stringify(body)}`)
  }
  if (
    body.proof?.canvas_node?.type !== '@node:proof'
    || body.proof.canvas_node.tx_hash !== '0xabc123'
    || body.proof.canvas_node.attestation_uid !== 'eas_attestation_123'
  ) {
    throw new Error(`expected @node:proof canvas payload, got ${JSON.stringify(body.proof)}`)
  }
  const proofRows = Array.from(env.DB.agenticCommerceProofs.values())
  if (proofRows.length !== 1 || !String(proofRows[0].proof_json || '').includes('@node:proof')) {
    throw new Error(`expected stored proof node payload, got ${JSON.stringify(proofRows)}`)
  }
}

export async function testAgenticCommerceStripeWebhookSettlesAcpSession() {
  const env = createCommerceEnv()
  env.STRIPE_RESTRICTED_KEY = 'rk_'
  env.STRIPE_CHECKOUT_PRICE_ID = 'price_accept_payment'
  env.STRIPE_WEBHOOK_SECRET = 'whsec_'
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      openbox_risk: { score: 0.31, action: 'manual_review' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    const created = await createCheckoutSession(env, { idempotencyKey: 'webhook-idempotency-1' })
    const payload = JSON.stringify({
      id: 'evt_agentic_commerce_1',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_agentic_commerce_1',
          status: 'complete',
          payment_status: 'paid',
          mode: 'payment',
          amount_total: 2500,
          currency: 'usd',
          metadata: {
            acp_session_id: created.session.id,
          },
          created: 1_777_500_200,
        },
      },
    })
    const header = await buildStripeSignatureHeader(payload, 'whsec_')
    const response = await worker.fetch(
      new Request('https://commerce.example/api/payments/stripe/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': header,
        },
        body: payload,
      }),
      env as never,
    )
    if (!response.ok) throw new Error(`expected Stripe webhook to settle ACP session, received ${response.status}: ${await response.text()}`)
    const sessionRow = env.DB.agenticCommerceSessions.get(created.session.id)
    if (sessionRow?.status !== 'complete' || !String(sessionRow.risk_signals_json || '').includes('manual_review')) {
      throw new Error(`expected completed ACP session from Stripe webhook, got ${JSON.stringify(sessionRow)}`)
    }
    const proofRows = Array.from(env.DB.agenticCommerceProofs.values())
    if (proofRows.length !== 1 || !String(proofRows[0].proof_json || '').includes('openbox_risk')) {
      throw new Error(`expected commerce proof from Stripe webhook, got ${JSON.stringify(proofRows)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export function testAgenticCommerceWorkerUsesSharedSemanticKeyHelper() {
  const workerText = readFileSync(resolve(process.cwd(), '../cloudflare/workers/knowgrph-payment/agenticCommerce.ts'), 'utf8')
  const sharedText = readFileSync(resolve(process.cwd(), '../grph-shared/src/payments/agenticCommerceSsot.ts'), 'utf8')
  if (!workerText.includes('buildAgenticCommerceSemanticKey')) {
    throw new Error('expected commerce worker to use the shared agentic commerce semantic-key helper')
  }
  if (!sharedText.includes("hashSignatureParts(['agentic-commerce'")) {
    throw new Error('expected commerce semantic-key helper to be rooted in the shared hash signature helper')
  }
}

const buildStripeSignatureHeader = async (payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  const hex = Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}
