import {
  STRIPE_CHECKOUT_METADATA_AGENTIC_COMMERCE_SESSION_ID,
  STRIPE_CHECKOUT_METADATA_WORKSPACE_ID,
  STRIPE_CHECKOUT_SESSION_ID_PARAM,
  STRIPE_PAYMENT_MISSING_SERVER_KEY_ERROR,
  STRIPE_PAYMENT_API_VERSION,
  STRIPE_PAYMENT_ROUTE_PATHS,
  buildStripeCheckoutSessionCreateForm,
  isStripeCheckoutReturnUrlAllowed,
  readStripeCheckoutRequestUrlOrigin,
  readStripeCheckoutReturnOrigin,
  readStripeCheckoutExpectedSessionTotal,
  readStripeCheckoutReadinessSmoke,
  readStripeCheckoutStripeIdempotencyKey,
  readStripePaymentServerKey,
  readStripeWebhookSigningSecret,
  resolveStripeCheckoutServerConfig,
  validateStripeCheckoutExpectedTotalForConfig,
  validateStripeCheckoutSessionCreatePayload,
  type StripeCheckoutSessionCreatePayload,
} from '../../../grph-shared/src/payments/stripePaymentSsot'
import {
  cancelAgenticCommerceSessionFromExpiredStripeSession,
  failAgenticCommerceSessionFromStripeSession,
  settleAgenticCommerceSessionFromStripeSession,
} from './agenticCommerceSettlement'
import { execute, normalizeNumber, normalizeString, queryFirst, type D1DatabaseLike } from '../shared/d1'

type HeadersRecord = Record<string, string>

type StripePaymentEnv = Record<string, unknown>

type StripeSessionWrite = {
  id: string
  workspaceId: string | null
  status: string
  paymentStatus: string
  mode: string
  amountTotal: number | null
  currency: string | null
  customerId: string | null
  customerEmail: string | null
  url: string | null
  metadataJson: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

type StripeCheckoutSessionRow = {
  id: string
  workspace_id: string | null
  status: string
  payment_status: string
  mode: string
  amount_total: number | null
  currency: string | null
  customer_id: string | null
  customer_email: string | null
  url: string | null
  metadata_json: string
  created_at: string
  updated_at: string
  completed_at: string | null
}

type StripeWebhookEventProcessingStatus = 'processing' | 'processed' | 'failed'

type StripeWebhookEventProcessingRow = {
  id: string
  payload_hash: string
  received_at: string | null
  processed_at: string | null
  processing_status: StripeWebhookEventProcessingStatus | string | null
}

export type StripeHostedCheckoutSessionCreateSuccess = {
  ok: true
  session: StripeSessionWrite
  body: {
    id: string
    url: string
    status: string
    paymentStatus: string
  }
}

export type StripeHostedCheckoutSessionCreateFailure = {
  ok: false
  status: number
  error: string
}

const STRIPE_CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions'
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 5 * 60
const STRIPE_WEBHOOK_PROCESSING_RETRY_AFTER_SECONDS = 10 * 60

const textEncoder = new TextEncoder()

const paymentJson = (status: number, body: unknown, corsHeaders: HeadersRecord): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders,
    },
  })

const paymentError = (status: number, error: string, corsHeaders: HeadersRecord): Response =>
  paymentJson(status, { ok: false, apiVersion: STRIPE_PAYMENT_API_VERSION, error }, corsHeaders)

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null

const readRecordString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

const readSessionCustomerId = (session: Record<string, unknown>): string | null => {
  const customer = session.customer
  if (typeof customer === 'string' && customer.trim()) return customer.trim()
  const customerRecord = asRecord(customer)
  return customerRecord ? readRecordString(customerRecord, 'id') || null : null
}

const readSessionCustomerEmail = (session: Record<string, unknown>): string | null => {
  const customerDetails = asRecord(session.customer_details)
  const fromDetails = customerDetails ? readRecordString(customerDetails, 'email') : ''
  if (fromDetails) return fromDetails
  const customerEmail = readRecordString(session, 'customer_email')
  return customerEmail || null
}

const readSessionWorkspaceId = (session: Record<string, unknown>): string | null => {
  const metadata = asRecord(session.metadata)
  const fromMetadata = metadata ? readRecordString(metadata, STRIPE_CHECKOUT_METADATA_WORKSPACE_ID) : ''
  const agenticCommerceSessionId = metadata ? readRecordString(metadata, STRIPE_CHECKOUT_METADATA_AGENTIC_COMMERCE_SESSION_ID) : ''
  const clientReference = readRecordString(session, 'client_reference_id')
  if (fromMetadata) return fromMetadata
  if (agenticCommerceSessionId && clientReference === agenticCommerceSessionId) return null
  return clientReference || null
}

const jsonStable = (value: unknown): string => {
  try {
    return JSON.stringify(value && typeof value === 'object' ? value : {})
  } catch {
    return '{}'
  }
}

const isoFromStripeCreated = (value: unknown, fallbackIso: string): string => {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackIso
  try {
    return new Date(Math.floor(seconds) * 1000).toISOString()
  } catch {
    return fallbackIso
  }
}

const mapStripeSession = (raw: unknown, nowIso: string, completedAt: string | null): StripeSessionWrite | null => {
  const session = asRecord(raw)
  if (!session) return null
  const id = readRecordString(session, 'id')
  if (!id) return null
  const metadata = asRecord(session.metadata) || {}
  return {
    id,
    workspaceId: readSessionWorkspaceId(session),
    status: readRecordString(session, 'status') || 'unknown',
    paymentStatus: readRecordString(session, 'payment_status') || 'unknown',
    mode: readRecordString(session, 'mode') || 'payment',
    amountTotal: session.amount_total == null ? null : normalizeNumber(session.amount_total),
    currency: readRecordString(session, 'currency') || null,
    customerId: readSessionCustomerId(session),
    customerEmail: readSessionCustomerEmail(session),
    url: readRecordString(session, 'url') || null,
    metadataJson: jsonStable(metadata),
    createdAt: isoFromStripeCreated(session.created, nowIso),
    updatedAt: nowIso,
    completedAt,
  }
}

const isStripeCheckoutSessionPaymentResolved = (
  session: Pick<StripeSessionWrite, 'paymentStatus'> | null | undefined,
): boolean => {
  const paymentStatus = String(session?.paymentStatus || '').toLowerCase()
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required'
}

const isStripeCheckoutSessionExpired = (
  session: Pick<StripeSessionWrite, 'status'> | null | undefined,
): boolean =>
  String(session?.status || '').toLowerCase() === 'expired'

const writeStripeCheckoutSession = async (db: D1DatabaseLike, session: StripeSessionWrite): Promise<void> => {
  await execute(
    db,
    `INSERT INTO stripe_checkout_sessions (
       id, workspace_id, status, payment_status, mode, amount_total, currency,
       customer_id, customer_email, url, metadata_json, created_at, updated_at, completed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       status = excluded.status,
       payment_status = excluded.payment_status,
       mode = excluded.mode,
       amount_total = excluded.amount_total,
       currency = excluded.currency,
       customer_id = excluded.customer_id,
       customer_email = excluded.customer_email,
       url = COALESCE(excluded.url, stripe_checkout_sessions.url),
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at,
       completed_at = COALESCE(excluded.completed_at, stripe_checkout_sessions.completed_at)`,
    [
      session.id,
      session.workspaceId,
      session.status,
      session.paymentStatus,
      session.mode,
      session.amountTotal,
      session.currency,
      session.customerId,
      session.customerEmail,
      session.url,
      session.metadataJson,
      session.createdAt,
      session.updatedAt,
      session.completedAt,
    ],
  )
}

const mapStripeCheckoutSessionRow = (row: StripeCheckoutSessionRow) => ({
  id: row.id,
  status: row.status,
  paymentStatus: row.payment_status,
  mode: row.mode,
  amountTotal: row.amount_total,
  currency: row.currency,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
})

const mapStripeCheckoutSessionWrite = (session: StripeSessionWrite) => ({
  id: session.id,
  status: session.status,
  paymentStatus: session.paymentStatus,
  mode: session.mode,
  amountTotal: session.amountTotal,
  currency: session.currency,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
})

const readRequestJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const isCheckoutCreatePayload = (value: unknown): value is StripeCheckoutSessionCreatePayload => {
  const record = asRecord(value)
  return Boolean(
    record
    && typeof record.successUrl === 'string'
    && typeof record.cancelUrl === 'string',
  )
}

const readCheckoutServerOrigin = (request: Request): string => {
  return readStripeCheckoutRequestUrlOrigin(request.url)
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

const hmacSha256Hex = async (secret: string, value: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value))
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

const timingSafeHexEqual = (left: string, right: string): boolean => {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

const verifyStripeSignature = async (
  payload: string,
  header: string,
  secret: string,
  nowMs: number,
): Promise<boolean> => {
  const parts = header.split(',').map(part => part.trim()).filter(Boolean)
  const timestamp = Number(parts.find(part => part.startsWith('t='))?.slice(2))
  const signatures = parts
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3).trim())
    .filter(Boolean)
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - Math.floor(timestamp))
  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false
  const expected = await hmacSha256Hex(secret, `${Math.floor(timestamp)}.${payload}`)
  return signatures.some(signature => timingSafeHexEqual(signature, expected))
}

const normalizeStripeWebhookEventProcessingStatus = (
  row: StripeWebhookEventProcessingRow | null,
): StripeWebhookEventProcessingStatus | '' => {
  const status = String(row?.processing_status || '').trim()
  if (status === 'processing' || status === 'processed' || status === 'failed') return status
  return row?.processed_at ? 'processed' : ''
}

const isStripeWebhookEventProcessingStale = (
  row: StripeWebhookEventProcessingRow,
  nowIso: string,
): boolean => {
  const receivedAtMs = Date.parse(String(row.received_at || ''))
  const nowMs = Date.parse(nowIso)
  if (!Number.isFinite(nowMs)) return false
  if (!Number.isFinite(receivedAtMs)) return true
  return Math.floor((nowMs - receivedAtMs) / 1000) >= STRIPE_WEBHOOK_PROCESSING_RETRY_AFTER_SECONDS
}

const trimStripeWebhookProcessingError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || 'Stripe webhook processing failed.')
  return message.trim().slice(0, 500)
}

const claimStripeWebhookEventProcessing = async (
  db: D1DatabaseLike,
  event: Record<string, unknown>,
  payload: string,
  nowIso: string,
): Promise<{ ok: true; shouldProcess: boolean; duplicate: boolean; eventId: string } | { ok: false; status: number; error: string }> => {
  const eventId = readRecordString(event, 'id')
  if (!eventId) return { ok: false, status: 400, error: 'Stripe webhook event is missing an id.' }
  const payloadHash = await sha256Hex(payload)
  const existing = await queryFirst<StripeWebhookEventProcessingRow>(
    db,
    'SELECT id, payload_hash, received_at, processed_at, processing_status FROM stripe_webhook_events WHERE id = ?',
    [eventId],
  )
  if (existing?.payload_hash && existing.payload_hash !== payloadHash) {
    return { ok: false, status: 409, error: 'Stripe webhook event id was previously recorded with a different payload.' }
  }
  const existingStatus = normalizeStripeWebhookEventProcessingStatus(existing)
  if (existing && existingStatus === 'processed') {
    return { ok: true, shouldProcess: false, duplicate: true, eventId }
  }
  if (existing && existingStatus === 'processing' && !isStripeWebhookEventProcessingStale(existing, nowIso)) {
    return { ok: true, shouldProcess: false, duplicate: true, eventId }
  }
  if (existing) {
    await execute(
      db,
      `UPDATE stripe_webhook_events
         SET event_type = ?,
             livemode = ?,
             payload_hash = ?,
             received_at = ?,
             processing_status = ?,
             processing_error = NULL
       WHERE id = ?`,
      [
        readRecordString(event, 'type') || 'unknown',
        event.livemode === true ? 1 : 0,
        payloadHash,
        nowIso,
        'processing',
        eventId,
      ],
    )
    return { ok: true, shouldProcess: true, duplicate: false, eventId }
  }
  await execute(
    db,
    `INSERT INTO stripe_webhook_events (
       id, event_type, livemode, payload_hash, received_at, processed_at, processing_status, processing_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      readRecordString(event, 'type') || 'unknown',
      event.livemode === true ? 1 : 0,
      payloadHash,
      nowIso,
      null,
      'processing',
      null,
    ],
  )
  return { ok: true, shouldProcess: true, duplicate: false, eventId }
}

const markStripeWebhookEventProcessed = async (
  db: D1DatabaseLike,
  eventId: string,
  processedAt: string,
): Promise<void> => {
  await execute(
    db,
    `UPDATE stripe_webhook_events
       SET processed_at = ?,
           processing_status = ?,
           processing_error = NULL
     WHERE id = ?`,
    [
      processedAt,
      'processed',
      eventId,
    ],
  )
}

const markStripeWebhookEventFailed = async (
  db: D1DatabaseLike,
  eventId: string,
  error: unknown,
): Promise<void> => {
  await execute(
    db,
    `UPDATE stripe_webhook_events
       SET processing_status = ?,
           processing_error = ?
     WHERE id = ?`,
    [
      'failed',
      trimStripeWebhookProcessingError(error),
      eventId,
    ],
  )
}

const checkoutSessionCompletedAt = (
  eventType: string,
  session: Record<string, unknown>,
  nowIso: string,
): string | null => {
  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return null
  }
  const mappedPaymentStatus = readRecordString(session, 'payment_status').toLowerCase()
  return mappedPaymentStatus === 'paid' || mappedPaymentStatus === 'no_payment_required' ? nowIso : null
}

const retrieveStripeCheckoutSessionForWorker = async (
  env: StripePaymentEnv,
  sessionId: string,
): Promise<{
  ok: true
  raw: Record<string, unknown>
  session: StripeSessionWrite
} | {
  ok: false
  status: number
  error: string
}> => {
  const apiKey = readStripePaymentServerKey(env)
  if (!apiKey) return { ok: false, status: 404, error: 'Stripe Checkout Session status not found.' }
  const response = await fetch(`${STRIPE_CHECKOUT_SESSIONS_URL}/${encodeURIComponent(sessionId)}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  })
  const jsonBody = await response.json().catch(() => null)
  if (!response.ok) {
    const stripeError = asRecord(asRecord(jsonBody)?.error)
    const message = stripeError ? readRecordString(stripeError, 'message') : ''
    return {
      ok: false,
      status: response.status >= 500 ? 502 : response.status,
      error: message || `Stripe Checkout Session retrieve failed with HTTP ${response.status}.`,
    }
  }
  const raw = asRecord(jsonBody)
  if (!raw) return { ok: false, status: 502, error: 'Stripe response missing Checkout Session status.' }
  const nowIso = new Date().toISOString()
  const paymentStatus = readRecordString(raw, 'payment_status').toLowerCase()
  const completedAt = paymentStatus === 'paid' || paymentStatus === 'no_payment_required' ? nowIso : null
  const mapped = mapStripeSession(raw, nowIso, completedAt)
  if (!mapped) return { ok: false, status: 502, error: 'Stripe response missing Checkout Session id.' }
  return { ok: true, raw, session: mapped }
}

const expireStripeCheckoutSessionForWorker = async (
  apiKey: string,
  sessionId: string,
): Promise<{ ok: true; raw: Record<string, unknown> | null } | { ok: false; error: string }> => {
  const normalizedSessionId = readRecordString({ sessionId }, 'sessionId')
  if (!normalizedSessionId) return { ok: false, error: 'Stripe Checkout Session id missing.' }
  const response = await fetch(`${STRIPE_CHECKOUT_SESSIONS_URL}/${encodeURIComponent(normalizedSessionId)}/expire`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  })
  const jsonBody = await response.json().catch(() => null)
  if (response.ok) return { ok: true, raw: asRecord(jsonBody) }
  const stripeError = asRecord(asRecord(jsonBody)?.error)
  const message = stripeError ? readRecordString(stripeError, 'message') : ''
  return { ok: false, error: message || `Stripe Checkout Session expire failed with HTTP ${response.status}.` }
}

export const expireStripeHostedCheckoutSessionForWorker = async (
  args: {
    env: StripePaymentEnv,
    db?: D1DatabaseLike | null,
    sessionId: string,
  },
): Promise<{ ok: true; session?: StripeSessionWrite } | { ok: false; error: string }> => {
  const apiKey = readStripePaymentServerKey(args.env)
  if (!apiKey) return { ok: false, error: STRIPE_PAYMENT_MISSING_SERVER_KEY_ERROR }
  const expired = await expireStripeCheckoutSessionForWorker(apiKey, args.sessionId)
  if (expired.ok !== true) return expired
  if (args.db && expired.raw) {
    const nowIso = new Date().toISOString()
    const mapped = mapStripeSession(expired.raw, nowIso, null)
    if (mapped) {
      await writeStripeCheckoutSession(args.db, mapped)
      return { ok: true, session: mapped }
    }
  }
  return { ok: true }
}

const validateStripeCheckoutCreatedTotal = (
  payload: StripeCheckoutSessionCreatePayload,
  session: StripeSessionWrite,
): string | null => {
  const expected = readStripeCheckoutExpectedSessionTotal(payload)
  if (!expected) return null
  const actualAmount = session.amountTotal == null ? null : Math.floor(session.amountTotal)
  const actualCurrency = String(session.currency || '').trim().toLowerCase()
  if (actualAmount === expected.amountTotal && actualCurrency === expected.currency) return null
  return 'Stripe Checkout Session amount/currency does not match the ACP checkout session.'
}

export const createStripeHostedCheckoutSessionForWorker = async (args: {
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  payload: StripeCheckoutSessionCreatePayload,
}): Promise<StripeHostedCheckoutSessionCreateSuccess | StripeHostedCheckoutSessionCreateFailure> => {
  const apiKey = readStripePaymentServerKey(args.env)
  if (!apiKey) return { ok: false, status: 500, error: STRIPE_PAYMENT_MISSING_SERVER_KEY_ERROR }
  const config = resolveStripeCheckoutServerConfig(args.env)
  if (config.ok !== true) return { ok: false, status: 500, error: config.error }

  const payload = args.payload
  const payloadError = validateStripeCheckoutSessionCreatePayload(payload)
  if (payloadError) return { ok: false, status: 400, error: payloadError }
  const expectedTotalError = validateStripeCheckoutExpectedTotalForConfig(payload, config)
  if (expectedTotalError) return { ok: false, status: 422, error: expectedTotalError }
  const serverOrigin = readCheckoutServerOrigin(args.request)
  const configuredOrigin = readStripeCheckoutReturnOrigin(args.env)
  if (
    !isStripeCheckoutReturnUrlAllowed(payload.successUrl, serverOrigin, configuredOrigin)
    || !isStripeCheckoutReturnUrlAllowed(payload.cancelUrl, serverOrigin, configuredOrigin)
  ) {
    return { ok: false, status: 400, error: 'Checkout return URLs must stay on the configured server return origin.' }
  }

  const body = buildStripeCheckoutSessionCreateForm(payload, config)
  const stripeIdempotencyKey = readStripeCheckoutStripeIdempotencyKey(payload)
  const headers: HeadersRecord = {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (stripeIdempotencyKey) headers['Idempotency-Key'] = stripeIdempotencyKey
  const response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
    method: 'POST',
    headers,
    body,
  })
  const jsonBody = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const stripeError = asRecord(jsonBody?.error)
    const message = stripeError ? readRecordString(stripeError, 'message') : ''
    return {
      ok: false,
      status: response.status >= 500 ? 502 : 400,
      error: message || `Stripe Checkout Session create failed with HTTP ${response.status}.`,
    }
  }
  const nowIso = new Date().toISOString()
  const session = mapStripeSession(jsonBody, nowIso, null)
  if (!session || !session.url) {
    return { ok: false, status: 502, error: 'Stripe response missing Checkout Session id or url.' }
  }
  const totalError = validateStripeCheckoutCreatedTotal(payload, session)
  if (totalError) {
    const expired = await expireStripeCheckoutSessionForWorker(apiKey, session.id)
    const expireDetails = expired.ok === true
      ? 'The mismatched Stripe Session was expired.'
      : expired.error
    return {
      ok: false,
      status: 409,
      error: `${totalError} ${expireDetails}`,
    }
  }
  try {
    await writeStripeCheckoutSession(args.db, session)
  } catch {
    const expired = await expireStripeCheckoutSessionForWorker(apiKey, session.id)
    const expireDetails = expired.ok === true
      ? 'The hosted Stripe Session was expired.'
      : `Stripe Checkout Session expiry failed: ${expired.error}`
    return {
      ok: false,
      status: 500,
      error: `Failed to persist Stripe Checkout Session after Stripe creation. ${expireDetails}`,
    }
  }
  return {
    ok: true,
    session,
    body: {
      id: session.id,
      url: session.url,
      status: session.status,
      paymentStatus: session.paymentStatus,
    },
  }
}

const handleStripeCheckoutCreate = async (
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const payload = await readRequestJson(request)
  if (!isCheckoutCreatePayload(payload)) {
    return paymentError(400, 'Missing Checkout Session successUrl or cancelUrl.', corsHeaders)
  }
  const created = await createStripeHostedCheckoutSessionForWorker({ request, env, db, payload })
  if (created.ok !== true) return paymentError(created.status, created.error, corsHeaders)
  if (readStripeCheckoutReadinessSmoke(payload)) {
    const expired = await expireStripeHostedCheckoutSessionForWorker({
      env,
      db,
      sessionId: created.session.id,
    })
    if (expired.ok !== true) {
      return paymentError(500, `Stripe readiness smoke created a Checkout Session but could not expire it: ${expired.error}`, corsHeaders)
    }
    const expiredSession = expired.session || created.session
    return paymentJson(200, {
      ok: true,
      apiVersion: STRIPE_PAYMENT_API_VERSION,
      id: created.session.id,
      status: 'expired',
      paymentStatus: expiredSession.paymentStatus,
      readinessSmoke: true,
    }, corsHeaders)
  }
  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
    ...created.body,
  }, corsHeaders)
}

const handleStripeCheckoutStatus = async (
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const url = new URL(request.url)
  const sessionId = normalizeString(url.searchParams.get(STRIPE_CHECKOUT_SESSION_ID_PARAM))
  if (!sessionId) return paymentError(400, `${STRIPE_CHECKOUT_SESSION_ID_PARAM} is required.`, corsHeaders)
  const row = await queryFirst<StripeCheckoutSessionRow>(
    db,
    'SELECT * FROM stripe_checkout_sessions WHERE id = ?',
    [sessionId],
  )
  if (!row) return paymentError(404, 'Stripe Checkout Session status not found.', corsHeaders)
  const storedSession = row ? mapStripeCheckoutSessionRow(row) : null
  if (storedSession && isStripeCheckoutSessionPaymentResolved(storedSession)) {
    return paymentJson(200, {
      ok: true,
      apiVersion: STRIPE_PAYMENT_API_VERSION,
      liveVerified: false,
      session: storedSession,
    }, corsHeaders)
  }

  const retrieved = await retrieveStripeCheckoutSessionForWorker(env, sessionId)
  if (retrieved.ok === true) {
    await writeStripeCheckoutSession(db, retrieved.session)
    if (isStripeCheckoutSessionPaymentResolved(retrieved.session)) {
      await settleAgenticCommerceSessionFromStripeSession(db, env, retrieved.raw)
    }
    if (isStripeCheckoutSessionExpired(retrieved.session)) {
      await cancelAgenticCommerceSessionFromExpiredStripeSession(db, retrieved.raw)
    }
    return paymentJson(200, {
      ok: true,
      apiVersion: STRIPE_PAYMENT_API_VERSION,
      liveVerified: true,
      session: mapStripeCheckoutSessionWrite(retrieved.session),
    }, corsHeaders)
  }

  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
    liveVerified: false,
    session: mapStripeCheckoutSessionRow(row),
  }, corsHeaders)
}

const handleStripeWebhook = async (
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const signingSecret = readStripeWebhookSigningSecret(env)
  if (!signingSecret) return paymentError(500, 'Missing server-managed Stripe webhook signing secret.', corsHeaders)
  const signature = request.headers.get('stripe-signature') || ''
  const payload = await request.text()
  const verified = await verifyStripeSignature(payload, signature, signingSecret, Date.now())
  if (!verified) return paymentError(400, 'Invalid Stripe webhook signature.', corsHeaders)
  let parsedEvent: unknown
  try {
    parsedEvent = JSON.parse(payload)
  } catch {
    return paymentError(400, 'Invalid Stripe webhook payload.', corsHeaders)
  }
  const event = asRecord(parsedEvent)
  if (!event) return paymentError(400, 'Invalid Stripe webhook payload.', corsHeaders)
  const nowIso = new Date().toISOString()
  const eventType = readRecordString(event, 'type')
  const claim = await claimStripeWebhookEventProcessing(db, event, payload, nowIso)
  if (claim.ok !== true) return paymentError(claim.status, claim.error, corsHeaders)
  if (!claim.shouldProcess) {
    return paymentJson(200, {
      ok: true,
      apiVersion: STRIPE_PAYMENT_API_VERSION,
      received: true,
      duplicate: claim.duplicate,
      eventType,
    }, corsHeaders)
  }
  try {
    const session = asRecord(asRecord(event.data)?.object)
    if (session && eventType.startsWith('checkout.session.')) {
      const mapped = mapStripeSession(session, nowIso, checkoutSessionCompletedAt(eventType, session, nowIso))
      if (mapped) await writeStripeCheckoutSession(db, mapped)
      if (mapped && mapped.completedAt) await settleAgenticCommerceSessionFromStripeSession(db, env, session)
      if (mapped && eventType === 'checkout.session.async_payment_failed') {
        await failAgenticCommerceSessionFromStripeSession(db, session)
      }
      if (mapped && eventType === 'checkout.session.expired') {
        await cancelAgenticCommerceSessionFromExpiredStripeSession(db, session)
      }
    }
    await markStripeWebhookEventProcessed(db, claim.eventId, new Date().toISOString())
  } catch (error) {
    await markStripeWebhookEventFailed(db, claim.eventId, error)
    return paymentError(500, 'Stripe webhook processing failed; Stripe can retry this event.', corsHeaders)
  }
  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
    received: true,
    duplicate: false,
    eventType,
  }, corsHeaders)
}

export const isStripePaymentRoute = (pathname: string): boolean =>
  pathname === STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession || pathname === STRIPE_PAYMENT_ROUTE_PATHS.webhook

export const handleStripePaymentRoute = async (
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname
  if (pathname === STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession && request.method === 'POST') {
    return handleStripeCheckoutCreate(request, env, db, corsHeaders)
  }
  if (pathname === STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession && request.method === 'GET') {
    return handleStripeCheckoutStatus(request, env, db, corsHeaders)
  }
  if (pathname === STRIPE_PAYMENT_ROUTE_PATHS.webhook && request.method === 'POST') {
    return handleStripeWebhook(request, env, db, corsHeaders)
  }
  if (isStripePaymentRoute(pathname)) {
    return paymentError(404, 'Stripe payment route not found.', corsHeaders)
  }
  return null
}
