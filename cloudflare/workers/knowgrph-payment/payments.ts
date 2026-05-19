import {
  STRIPE_PAYMENT_MISSING_SERVER_KEY_ERROR,
  STRIPE_PAYMENT_API_VERSION,
  STRIPE_PAYMENT_ROUTE_PATHS,
  buildStripeCheckoutSessionCreateForm,
  isStripeCheckoutReturnUrlAllowed,
  readStripeCheckoutReturnOrigin,
  readStripePaymentServerKey,
  readStripeWebhookSigningSecret,
  resolveStripeCheckoutServerConfig,
  type StripeCheckoutSessionCreatePayload,
} from '../../../grph-shared/src/payments/stripePaymentSsot'
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

const STRIPE_CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions'
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 5 * 60

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
  const fromMetadata = metadata ? readRecordString(metadata, 'workspace_id') : ''
  const clientReference = readRecordString(session, 'client_reference_id')
  return fromMetadata || clientReference || null
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
  workspaceId: row.workspace_id,
  status: row.status,
  paymentStatus: row.payment_status,
  mode: row.mode,
  amountTotal: row.amount_total,
  currency: row.currency,
  customerId: row.customer_id,
  customerEmail: row.customer_email,
  url: row.url,
  metadata: (() => {
    try {
      return JSON.parse(row.metadata_json || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  })(),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at,
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

const readRequestOrigin = (request: Request): string => {
  const origin = request.headers.get('origin')
  if (origin) return origin.trim().replace(/\/+$/g, '')
  return new URL(request.url).origin
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

const recordWebhookEvent = async (
  db: D1DatabaseLike,
  event: Record<string, unknown>,
  payload: string,
  nowIso: string,
): Promise<boolean> => {
  const eventId = readRecordString(event, 'id')
  if (!eventId) return false
  const existing = await queryFirst<{ id: string }>(db, 'SELECT id FROM stripe_webhook_events WHERE id = ?', [eventId])
  if (existing) return false
  await execute(
    db,
    `INSERT INTO stripe_webhook_events (
       id, event_type, livemode, payload_hash, received_at, processed_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      readRecordString(event, 'type') || 'unknown',
      event.livemode === true ? 1 : 0,
      await sha256Hex(payload),
      nowIso,
      nowIso,
    ],
  )
  return true
}

const checkoutSessionCompletedAt = (eventType: string, nowIso: string): string | null => (
  eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded'
    ? nowIso
    : null
)

const handleStripeCheckoutCreate = async (
  request: Request,
  env: StripePaymentEnv,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const apiKey = readStripePaymentServerKey(env)
  if (!apiKey) return paymentError(500, STRIPE_PAYMENT_MISSING_SERVER_KEY_ERROR, corsHeaders)
  const config = resolveStripeCheckoutServerConfig(env)
  if (config.ok !== true) return paymentError(500, config.error, corsHeaders)

  const payload = await readRequestJson(request)
  if (!isCheckoutCreatePayload(payload)) {
    return paymentError(400, 'Missing Checkout Session successUrl or cancelUrl.', corsHeaders)
  }
  const requestOrigin = readRequestOrigin(request)
  const configuredOrigin = readStripeCheckoutReturnOrigin(env)
  if (
    !isStripeCheckoutReturnUrlAllowed(payload.successUrl, requestOrigin, configuredOrigin)
    || !isStripeCheckoutReturnUrlAllowed(payload.cancelUrl, requestOrigin, configuredOrigin)
  ) {
    return paymentError(400, 'Checkout return URLs must stay on the configured request origin.', corsHeaders)
  }

  const body = buildStripeCheckoutSessionCreateForm(payload, config)
  const response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const jsonBody = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const stripeError = asRecord(jsonBody?.error)
    const message = stripeError ? readRecordString(stripeError, 'message') : ''
    return paymentError(response.status >= 500 ? 502 : 400, message || `Stripe Checkout Session create failed with HTTP ${response.status}.`, corsHeaders)
  }
  const nowIso = new Date().toISOString()
  const session = mapStripeSession(jsonBody, nowIso, null)
  if (!session || !session.url) {
    return paymentError(502, 'Stripe response missing Checkout Session id or url.', corsHeaders)
  }
  await writeStripeCheckoutSession(db, session)
  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
    id: session.id,
    url: session.url,
    status: session.status,
    paymentStatus: session.paymentStatus,
  }, corsHeaders)
}

const handleStripeCheckoutStatus = async (
  request: Request,
  db: D1DatabaseLike,
  corsHeaders: HeadersRecord,
): Promise<Response> => {
  const url = new URL(request.url)
  const sessionId = normalizeString(url.searchParams.get('session_id') || url.searchParams.get('id'))
  if (!sessionId) return paymentError(400, 'session_id is required.', corsHeaders)
  const row = await queryFirst<StripeCheckoutSessionRow>(
    db,
    'SELECT * FROM stripe_checkout_sessions WHERE id = ?',
    [sessionId],
  )
  if (!row) return paymentError(404, 'Stripe Checkout Session status not found.', corsHeaders)
  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
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
  const inserted = await recordWebhookEvent(db, event, payload, nowIso)
  const eventType = readRecordString(event, 'type')
  const session = asRecord(asRecord(event.data)?.object)
  if (session && eventType.startsWith('checkout.session.')) {
    const mapped = mapStripeSession(session, nowIso, checkoutSessionCompletedAt(eventType, nowIso))
    if (mapped) await writeStripeCheckoutSession(db, mapped)
  }
  return paymentJson(200, {
    ok: true,
    apiVersion: STRIPE_PAYMENT_API_VERSION,
    received: true,
    duplicate: !inserted,
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
    return handleStripeCheckoutStatus(request, db, corsHeaders)
  }
  if (pathname === STRIPE_PAYMENT_ROUTE_PATHS.webhook && request.method === 'POST') {
    return handleStripeWebhook(request, env, db, corsHeaders)
  }
  if (isStripePaymentRoute(pathname)) {
    return paymentError(404, 'Stripe payment route not found.', corsHeaders)
  }
  return null
}
