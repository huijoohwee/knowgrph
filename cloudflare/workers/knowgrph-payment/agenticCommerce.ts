import {
  AGENTIC_COMMERCE_API_VERSION,
  AGENTIC_COMMERCE_ENV_KEYS,
  AGENTIC_COMMERCE_ROUTE_PATHS,
  buildAgenticCommerceAcpConfig,
  buildAgenticCommerceDepositAddress,
  buildAgenticCommerceSemanticKey,
  isAgenticCommerceWeb3Enabled,
  normalizeAgenticCommerceAmount,
  normalizeAgenticCommerceCurrency,
  readAgenticCommerceCheckoutBaseUrl,
  readAgenticCommerceSellerId,
  type AgenticCommerceEnvLike,
} from '../../../grph-shared/src/payments/agenticCommerceSsot'
import type { D1DatabaseLike } from '../shared/d1'
import {
  asRecord,
  mapSessionRow,
  parseJson,
  readProofForSession,
  readRecordString,
  readSession,
  readSessionByIdempotencyKey,
  stableJson,
  updateSessionState,
  writeProof,
  writeSession,
  writeTraceEvent,
  type AgenticCommercePaymentRail,
  type AgenticCommerceRiskSignal,
  type AgenticCommerceSessionRow,
  type AgenticCommerceSessionStatus,
  type AgenticCommerceSessionWrite,
  type OpenboxAction,
} from './agenticCommercePersistence'

type HeadersRecord = Record<string, string>

type ParsedSessionRoute =
  | { kind: 'collection' }
  | { kind: 'item'; id: string; action: '' | 'complete' | 'cancel' }
  | null

const json = (status: number, body: unknown, corsHeaders: HeadersRecord): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders,
    },
  })

const errorJson = (status: number, error: string, corsHeaders: HeadersRecord): Response =>
  json(status, { ok: false, apiVersion: AGENTIC_COMMERCE_API_VERSION, error }, corsHeaders)

const readRequestJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const readCheckoutBaseUrl = (env: AgenticCommerceEnvLike, request: Request): string =>
  readAgenticCommerceCheckoutBaseUrl(env, request.url)

const readSellerId = (env: AgenticCommerceEnvLike, request: Request): string =>
  readAgenticCommerceSellerId(env, request.url)

const parseSessionRoute = (pathname: string): ParsedSessionRoute => {
  if (pathname === AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions) return { kind: 'collection' }
  const prefix = `${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/`
  if (!pathname.startsWith(prefix)) return null
  const parts = pathname.slice(prefix.length).split('/').filter(Boolean)
  if (parts.length < 1 || parts.length > 2) return null
  const action = parts[1] || ''
  if (action !== '' && action !== 'complete' && action !== 'cancel') return null
  return { kind: 'item', id: decodeURIComponent(parts[0]), action }
}

const readWeb3Extension = (payload: Record<string, unknown>): Record<string, unknown> | null =>
  asRecord(payload['x-web3']) || asRecord(payload.x_web3)

const readPaymentRail = (payload: Record<string, unknown>): AgenticCommercePaymentRail => {
  const web3 = readWeb3Extension(payload)
  const web3Method = web3 ? readRecordString(web3, 'payment_method').toLowerCase() : ''
  const rail = readRecordString(payload, 'payment_rail').toLowerCase()
  return web3Method === 'erc20' || rail === 'erc20' ? 'erc20' : 'fiat'
}

const readCheckoutAmount = (payload: Record<string, unknown>): number => {
  const direct = normalizeAgenticCommerceAmount(payload.amount_total ?? payload.amount)
  if (direct > 0) return direct
  const items = Array.isArray(payload.items) ? payload.items : []
  let total = 0
  for (const item of items) {
    const itemRecord = asRecord(item)
    if (!itemRecord) continue
    const unitAmount = normalizeAgenticCommerceAmount(itemRecord.unit_amount ?? itemRecord.amount_total ?? itemRecord.amount)
    const quantity = Math.max(1, normalizeAgenticCommerceAmount(itemRecord.quantity || 1))
    total += unitAmount * quantity
  }
  return total
}

const readCheckoutCurrency = (payload: Record<string, unknown>): string => {
  const direct = normalizeAgenticCommerceCurrency(payload.currency)
  if (direct) return direct
  const items = Array.isArray(payload.items) ? payload.items : []
  for (const item of items) {
    const itemRecord = asRecord(item)
    const currency = itemRecord ? normalizeAgenticCommerceCurrency(itemRecord.currency) : ''
    if (currency) return currency
  }
  return ''
}

const readOpenboxAction = (value: unknown): OpenboxAction | '' => {
  const action = String(value || '').trim()
  return action === 'authorized' || action === 'manual_review' || action === 'blocked' ? action : ''
}

const readOpenboxRiskSignal = async (
  env: AgenticCommerceEnvLike,
  session: AgenticCommerceSessionRow,
): Promise<AgenticCommerceRiskSignal | null> => {
  const apiUrl = String(env[AGENTIC_COMMERCE_ENV_KEYS.openboxApiUrl] || '').trim()
  if (!apiUrl) return null
  const apiKey = String(env[AGENTIC_COMMERCE_ENV_KEYS.openboxApiKey] || '').trim()
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        session_id: session.id,
        action: 'agentic_checkout_complete',
        payment_rail: session.payment_rail,
        amount_total: session.amount_total,
        currency: session.currency,
      }),
    })
    if (!response.ok) return null
    const body = asRecord(await response.json().catch(() => null))
    if (!body) return null
    const nested = asRecord(body.openbox_risk)
    const scoreValue = nested?.score ?? body.score ?? body.risk_score
    const score = typeof scoreValue === 'number' ? scoreValue : Number(scoreValue)
    const action = readOpenboxAction(nested?.action ?? body.action)
    if (!Number.isFinite(score) || !action) return null
    return {
      source: 'openbox',
      score,
      action,
      session_id: session.id,
    }
  } catch {
    return null
  }
}

const buildProof = (args: {
  session: AgenticCommerceSessionRow
  riskSignal: AgenticCommerceRiskSignal | null
  completedAt: string
  txHash?: string | null
  attestationUid?: string | null
}) => {
  const proofId = `proof_${buildAgenticCommerceSemanticKey('commerce-proof', [
    args.session.id,
    args.completedAt,
    args.riskSignal?.score ?? '',
    args.riskSignal?.action ?? '',
    args.txHash || '',
    args.attestationUid || '',
  ])}`
  const canvasNode = args.session.payment_rail === 'erc20'
    ? {
        type: '@node:proof',
        session_id: args.session.id,
        tx_hash: args.txHash || null,
        attestation_uid: args.attestationUid || null,
      }
    : null
  return {
    proof_id: proofId,
    session_id: args.session.id,
    status: 'complete',
    payment_rail: args.session.payment_rail,
    amount_total: args.session.amount_total,
    currency: args.session.currency,
    ...(args.riskSignal ? { openbox_risk: args.riskSignal } : {}),
    ...(args.attestationUid ? { attestation_uid: args.attestationUid } : {}),
    ...(canvasNode ? { canvas_node: canvasNode } : {}),
    cost_log: {
      model: 'none',
      prompt_tokens: 0,
      completion_tokens: 0,
      cache_hits: 0,
      estimated_cost_usd: 0,
    },
  }
}

const handleAcpConfig = (
  request: Request,
  env: AgenticCommerceEnvLike,
  corsHeaders: HeadersRecord,
): Response => {
  const sellerId = readSellerId(env, request)
  const checkoutBaseUrl = readCheckoutBaseUrl(env, request)
  return json(200, buildAgenticCommerceAcpConfig({
    sellerId,
    checkoutBaseUrl,
    web3Enabled: isAgenticCommerceWeb3Enabled(env),
  }), corsHeaders)
}

const buildSessionCreateWrite = (
  request: Request,
  env: AgenticCommerceEnvLike,
  payload: Record<string, unknown>,
  nowIso: string,
): { ok: true; session: AgenticCommerceSessionWrite } | { ok: false; error: string } => {
  const amountTotal = readCheckoutAmount(payload)
  const currency = readCheckoutCurrency(payload)
  if (amountTotal <= 0) return { ok: false, error: 'amount_total must be a positive integer minor-unit amount.' }
  if (!currency) return { ok: false, error: 'currency must be a currency code or token symbol.' }

  const sellerId = readSellerId(env, request)
  const paymentRail = readPaymentRail(payload)
  const web3 = readWeb3Extension(payload)
  const payerDid = web3 ? readRecordString(web3, 'payer_did') || null : null
  const requestJson = stableJson(payload)
  const payloadHash = buildAgenticCommerceSemanticKey('checkout-payload', [requestJson])
  const headerIdempotencyKey = request.headers.get('idempotency-key') || request.headers.get('Idempotency-Key')
  const idempotencyKey = String(payload.idempotency_key || headerIdempotencyKey || payloadHash).trim()
  const sessionId = `acp_${buildAgenticCommerceSemanticKey('checkout-session', [sellerId, idempotencyKey, payloadHash])}`
  const depositAddress = paymentRail === 'erc20' ? buildAgenticCommerceDepositAddress(env, sessionId) : null
  const status: AgenticCommerceSessionStatus = paymentRail === 'erc20' ? 'pending_onchain' : 'open'
  const baseResponse = {
    id: sessionId,
    seller_id: sellerId,
    idempotency_key: idempotencyKey,
    status,
    payment_rail: paymentRail,
    amount_total: amountTotal,
    currency,
    payer_did: payerDid,
    deposit_address: depositAddress,
    risk_signals: [],
    created_at: nowIso,
    updated_at: nowIso,
    completed_at: null,
    cancelled_at: null,
  }
  return {
    ok: true,
    session: {
      id: sessionId,
      sellerId,
      idempotencyKey,
      payloadHash,
      status,
      paymentRail,
      amountTotal,
      currency,
      payerDid,
      depositAddress,
      requestJson,
      responseJson: stableJson(baseResponse),
      riskSignalsJson: '[]',
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
      cancelledAt: null,
    },
  }
}

const handleCreateSession = async (
  request: Request,
  env: AgenticCommerceEnvLike,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const payload = asRecord(await readRequestJson(request))
  if (!payload) return errorJson(400, 'Checkout session body must be a JSON object.', corsHeaders)
  const nowIso = new Date().toISOString()
  const parsed = buildSessionCreateWrite(request, env, payload, nowIso)
  if (parsed.ok !== true) return errorJson(400, parsed.error, corsHeaders)

  const existing = await readSessionByIdempotencyKey(db, parsed.session.sellerId, parsed.session.idempotencyKey)
  if (existing) {
    if (existing.payload_hash !== parsed.session.payloadHash) {
      return json(409, {
        ok: false,
        apiVersion: AGENTIC_COMMERCE_API_VERSION,
        error: 'idempotency key already owns a different checkout payload',
        session: mapSessionRow(existing),
      }, corsHeaders)
    }
    return json(201, {
      ok: true,
      apiVersion: AGENTIC_COMMERCE_API_VERSION,
      session: mapSessionRow(existing),
    }, corsHeaders)
  }

  await writeSession(db, parsed.session)
  const created = await readSession(db, parsed.session.id)
  return json(201, {
    ok: true,
    apiVersion: AGENTIC_COMMERCE_API_VERSION,
    session: created ? mapSessionRow(created) : parseJson(parsed.session.responseJson, {}),
  }, corsHeaders)
}

const handleGetSession = async (
  db: D1DatabaseLike,
  sessionId: string,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const session = await readSession(db, sessionId)
  if (!session) return errorJson(404, 'ACP checkout session not found.', corsHeaders)
  const proof = await readProofForSession(db, sessionId)
  return json(200, {
    ok: true,
    apiVersion: AGENTIC_COMMERCE_API_VERSION,
    session: mapSessionRow(session),
    ...(proof ? { proof: parseJson(proof.proof_json, null) } : {}),
  }, corsHeaders)
}

export const settleAgenticCommerceSession = async (
  db: D1DatabaseLike,
  env: AgenticCommerceEnvLike,
  sessionId: string,
  options: { txHash?: string | null; attestationUid?: string | null } = {},
): Promise<{ session: ReturnType<typeof mapSessionRow>; proof: unknown } | null> => {
  const session = await readSession(db, sessionId)
  if (!session) return null
  const existingProof = await readProofForSession(db, sessionId)
  if (session.status === 'complete' && existingProof) {
    return {
      session: mapSessionRow(session),
      proof: parseJson(existingProof.proof_json, null),
    }
  }

  const completedAt = session.completed_at || new Date().toISOString()
  const riskSignal = await readOpenboxRiskSignal(env, session)
  const riskSignals = riskSignal ? [riskSignal] : []
  const completedSession: AgenticCommerceSessionRow = {
    ...session,
    status: 'complete',
    updated_at: completedAt,
    completed_at: completedAt,
    risk_signals_json: stableJson(riskSignals),
  }
  const proof = buildProof({
    session: completedSession,
    riskSignal,
    completedAt,
    txHash: options.txHash || null,
    attestationUid: options.attestationUid || null,
  })
  await updateSessionState(db, {
    id: session.id,
    status: 'complete',
    responseJson: stableJson(mapSessionRow(completedSession)),
    riskSignalsJson: stableJson(riskSignals),
    updatedAt: completedAt,
    completedAt,
  })
  await writeProof(db, {
    id: proof.proof_id,
    sessionId: session.id,
    proofJson: stableJson(proof),
    createdAt: completedAt,
  })
  await writeTraceEvent(db, {
    sessionId: session.id,
    eventType: 'knowgrph.commerce.settle',
    payload: {
      tool: 'knowgrph.commerce.settle',
      session_id: session.id,
      proof_id: proof.proof_id,
      risk_signal_source: riskSignal?.source || null,
    },
    createdAt: completedAt,
  })
  const updated = await readSession(db, session.id)
  return {
    session: updated ? mapSessionRow(updated) : mapSessionRow(completedSession),
    proof,
  }
}

export const settleAgenticCommerceSessionFromStripeSession = async (
  db: D1DatabaseLike,
  env: AgenticCommerceEnvLike,
  stripeSession: Record<string, unknown>,
): Promise<void> => {
  const metadata = asRecord(stripeSession.metadata)
  const sessionId = metadata ? readRecordString(metadata, 'acp_session_id') : ''
  if (!sessionId) return
  await settleAgenticCommerceSession(db, env, sessionId)
}

const handleCompleteSession = async (
  request: Request,
  env: AgenticCommerceEnvLike,
  db: D1DatabaseLike,
  sessionId: string,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const session = await readSession(db, sessionId)
  if (!session) return errorJson(404, 'ACP checkout session not found.', corsHeaders)
  const payload = asRecord(await readRequestJson(request)) || {}
  const vaultToken = readRecordString(payload, 'vault_token') || readRecordString(payload, 'payment_token') || readRecordString(payload, 'shared_payment_token')
  if (session.payment_rail === 'fiat' && session.status !== 'complete' && !vaultToken) {
    return errorJson(422, 'vault_token is required to complete a fiat ACP checkout session.', corsHeaders)
  }
  const settled = await settleAgenticCommerceSession(db, env, sessionId, {
    txHash: readRecordString(payload, 'tx_hash') || null,
    attestationUid: readRecordString(payload, 'attestation_uid') || null,
  })
  if (!settled) return errorJson(404, 'ACP checkout session not found.', corsHeaders)
  return json(200, {
    ok: true,
    apiVersion: AGENTIC_COMMERCE_API_VERSION,
    session: settled.session,
    proof: settled.proof,
  }, corsHeaders)
}

const handleCancelSession = async (
  db: D1DatabaseLike,
  sessionId: string,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const session = await readSession(db, sessionId)
  if (!session) return errorJson(404, 'ACP checkout session not found.', corsHeaders)
  if (session.status === 'complete') return errorJson(409, 'completed ACP checkout sessions cannot be cancelled.', corsHeaders)
  const cancelledAt = session.cancelled_at || new Date().toISOString()
  const cancelledSession: AgenticCommerceSessionRow = {
    ...session,
    status: 'cancelled',
    updated_at: cancelledAt,
    cancelled_at: cancelledAt,
  }
  await updateSessionState(db, {
    id: session.id,
    status: 'cancelled',
    responseJson: stableJson(mapSessionRow(cancelledSession)),
    riskSignalsJson: session.risk_signals_json || '[]',
    updatedAt: cancelledAt,
    cancelledAt,
  })
  const updated = await readSession(db, session.id)
  return json(200, {
    ok: true,
    apiVersion: AGENTIC_COMMERCE_API_VERSION,
    session: updated ? mapSessionRow(updated) : mapSessionRow(cancelledSession),
  }, corsHeaders)
}

const handleCommerceWebhook = async (
  request: Request,
  env: AgenticCommerceEnvLike,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const payload = asRecord(await readRequestJson(request))
  const sessionId = payload ? readRecordString(payload, 'session_id') : ''
  if (!sessionId) return errorJson(400, 'session_id is required.', corsHeaders)
  const settled = await settleAgenticCommerceSession(db, env, sessionId, {
    txHash: payload ? readRecordString(payload, 'tx_hash') || null : null,
    attestationUid: payload ? readRecordString(payload, 'attestation_uid') || null : null,
  })
  if (!settled) return errorJson(404, 'ACP checkout session not found.', corsHeaders)
  return json(200, {
    ok: true,
    apiVersion: AGENTIC_COMMERCE_API_VERSION,
    received: true,
    session: settled.session,
    proof: settled.proof,
  }, corsHeaders)
}

export const isAgenticCommerceRoute = (pathname: string): boolean => (
  pathname === AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig
  || pathname === AGENTIC_COMMERCE_ROUTE_PATHS.commerceWebhook
  || parseSessionRoute(pathname) !== null
)

export const isAgenticCommerceRouteDbBacked = (pathname: string): boolean => (
  pathname !== AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig && isAgenticCommerceRoute(pathname)
)

export const handleAgenticCommerceRoute = async (
  request: Request,
  env: AgenticCommerceEnvLike,
  db: D1DatabaseLike | null,
  corsHeaders: HeadersRecord,
): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname
  if (pathname === AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig && request.method === 'GET') {
    return handleAcpConfig(request, env, corsHeaders)
  }
  if (pathname === AGENTIC_COMMERCE_ROUTE_PATHS.acpConfig) {
    return errorJson(404, 'ACP config route not found.', corsHeaders)
  }
  if (!db) return errorJson(500, 'missing Cloudflare D1 binding DB', corsHeaders)
  if (pathname === AGENTIC_COMMERCE_ROUTE_PATHS.commerceWebhook && request.method === 'POST') {
    return handleCommerceWebhook(request, env, db, corsHeaders)
  }
  const sessionRoute = parseSessionRoute(pathname)
  if (!sessionRoute) return null
  if (sessionRoute.kind === 'collection' && request.method === 'POST') {
    return handleCreateSession(request, env, db, corsHeaders)
  }
  if (sessionRoute.kind === 'item' && sessionRoute.action === '' && request.method === 'GET') {
    return handleGetSession(db, sessionRoute.id, corsHeaders)
  }
  if (sessionRoute.kind === 'item' && sessionRoute.action === 'complete' && request.method === 'POST') {
    return handleCompleteSession(request, env, db, sessionRoute.id, corsHeaders)
  }
  if (sessionRoute.kind === 'item' && sessionRoute.action === 'cancel' && request.method === 'POST') {
    return handleCancelSession(db, sessionRoute.id, corsHeaders)
  }
  return errorJson(404, 'ACP checkout route not found.', corsHeaders)
}
