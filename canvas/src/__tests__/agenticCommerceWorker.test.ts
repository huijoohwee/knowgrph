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
    const traceTypes = traceRows.map(row => row.event_type)
    if (!traceTypes.includes('knowgrph.commerce.delegate_payment') || !traceTypes.includes('knowgrph.commerce.settle')) {
      throw new Error(`expected settle trace event, got ${JSON.stringify(traceRows)}`)
    }
    const proofArtifactResponse = await worker.fetch(
      new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.commerceProofArtifact}?session_id=${created.session.id}`),
      env as never,
    )
    if (!proofArtifactResponse.ok) throw new Error(`expected harness-proof artifact ok, received ${proofArtifactResponse.status}`)
    const proofArtifact = await proofArtifactResponse.json() as { commerce?: Array<{ session_id?: string; openbox_risk?: unknown }> }
    if (proofArtifact.commerce?.[0]?.session_id !== created.session.id || !proofArtifact.commerce[0].openbox_risk) {
      throw new Error(`expected harness-proof commerce entry with OpenBOX risk, got ${JSON.stringify(proofArtifact)}`)
    }
    const traceArtifactResponse = await worker.fetch(
      new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.commerceTraceArtifact}?session_id=${created.session.id}`),
      env as never,
    )
    if (!traceArtifactResponse.ok) throw new Error(`expected trace artifact ok, received ${traceArtifactResponse.status}`)
    const traceArtifact = await traceArtifactResponse.text()
    if (!traceArtifact.includes('knowgrph.commerce.settle') || !traceArtifact.includes(created.session.id)) {
      throw new Error(`expected trace.jsonl settle entry, got ${traceArtifact}`)
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

export async function testAgenticCommerceWeb3SettleRouteConfirmsBaseRpcAndAttests() {
  const env = createCommerceEnv()
  delete env.OPENBOX_API_URL
  env.BASE_RPC_URL = 'https://base.example/rpc'
  env.EAS_ATTEST_URL = 'https://eas.example/attest'
  const created = await createCheckoutSession(env, {
    idempotencyKey: 'web3-rpc-settle-idempotency-1',
    currency: 'usdc',
    'x-web3': {
      payment_method: 'erc20',
      payer_did: 'did:debox:0x987',
    },
  })
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const target = url instanceof Request ? url.url : String(url)
      if (target === 'https://base.example/rpc') {
        const requestBody = JSON.parse(String(init?.body || '{}')) as { method?: string }
        if (requestBody.method !== 'eth_getTransactionByHash') throw new Error(`unexpected RPC method ${requestBody.method}`)
        return new Response(JSON.stringify({
          result: {
            to: '0x0000000000000000000000000000000000000001',
            value: '0x0',
            input: encodeErc20TransferInput(String(created.session.deposit_address), 2500),
            blockNumber: '0x10',
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (target === 'https://eas.example/attest') {
        return new Response(JSON.stringify({ attestation_uid: 'eas_rpc_123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch target ${target}`)
    }) as typeof fetch

    const response = await worker.fetch(
      new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.web3Settle}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: created.session.id, tx_hash: '0xabc123' }),
      }),
      env as never,
    )
    if (!response.ok) throw new Error(`expected web3 settle route ok, received ${response.status}: ${await response.text()}`)
    const body = await response.json() as {
      session?: { status?: string }
      proof?: { attestation_uid?: string; canvas_node?: { tx_hash?: string; attestation_uid?: string } }
    }
    if (body.session?.status !== 'complete' || body.proof?.attestation_uid !== 'eas_rpc_123') {
      throw new Error(`expected Base RPC + EAS settlement proof, got ${JSON.stringify(body)}`)
    }
    const canvasNode = body.proof?.canvas_node
    if (canvasNode?.tx_hash !== '0xabc123' || canvasNode.attestation_uid !== 'eas_rpc_123') {
      throw new Error(`expected @node:proof tx and attestation, got ${JSON.stringify(body.proof)}`)
    }
    const traceTypes = Array.from(env.DB.agenticCommerceTraceEvents.values()).map(row => row.event_type)
    if (!traceTypes.includes('knowgrph.commerce.web3_confirm') || !traceTypes.includes('knowgrph.commerce.attest')) {
      throw new Error(`expected Web3 confirmation and attest trace events, got ${JSON.stringify(traceTypes)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testAgenticCommerceOpenboxIngestRoutePostsProofArtifact() {
  const env = createCommerceEnv()
  env.OPENBOX_INGEST_URL = 'https://openbox.example/ingest'
  const created = await createCheckoutSession(env, { idempotencyKey: 'openbox-ingest-idempotency-1' })
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const target = url instanceof Request ? url.url : String(url)
      if (target !== 'https://openbox.example/ingest') throw new Error(`unexpected fetch target ${target}`)
      const headers = new Headers(init?.headers)
      if (headers.get('authorization') !== 'Bearer openbox_test_key') throw new Error('expected OpenBOX ingest bearer token')
      const requestBody = JSON.parse(String(init?.body || '{}')) as { commerce?: Array<{ session_id?: string }> }
      if (requestBody.commerce?.[0]?.session_id !== created.session.id) throw new Error(`expected posted proof artifact, got ${JSON.stringify(requestBody)}`)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const response = await worker.fetch(
      new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.openboxIngest}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'knowgrph-commerce-proof/v1',
          commerce: [{ session_id: created.session.id, proof_id: 'proof_ingest_route' }],
        }),
      }),
      env as never,
    )
    if (!response.ok) throw new Error(`expected OpenBOX ingest route ok, received ${response.status}: ${await response.text()}`)
    const traceTypes = Array.from(env.DB.agenticCommerceTraceEvents.values()).map(row => row.event_type)
    if (!traceTypes.includes('knowgrph.commerce.openbox_ingest')) {
      throw new Error(`expected OpenBOX ingest trace event, got ${JSON.stringify(traceTypes)}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

export async function testAgenticCommerceBearerTokenProtectsDbBackedRoutes() {
  const env = createCommerceEnv()
  env.ACP_BEARER_TOKEN = 'acp_secret'
  const configResponse = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig}`),
    env as never,
  )
  if (!configResponse.ok) throw new Error(`expected public ACP config with bearer configured, received ${configResponse.status}`)
  const blocked = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount_total: 2500, currency: 'usd' }),
    }),
    env as never,
  )
  if (blocked.status !== 401) throw new Error(`expected unauthenticated checkout to be blocked, received ${blocked.status}`)
  const allowed = await worker.fetch(
    new Request(`https://commerce.example${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer acp_secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount_total: 2500, currency: 'usd', idempotency_key: 'bearer-idempotency-1' }),
    }),
    env as never,
  )
  if (!allowed.ok) throw new Error(`expected authenticated checkout to pass, received ${allowed.status}: ${await allowed.text()}`)
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

const encodeErc20TransferInput = (recipient: string, amount: number): string => {
  const address = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  const amountHex = BigInt(amount).toString(16).padStart(64, '0')
  return `0xa9059cbb${address}${amountHex}`
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
