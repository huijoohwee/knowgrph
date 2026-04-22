import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusChatApiDocs'

export const STRIPE_PAYMENT_API_DOC_AREA = 'Stripe Payment API'

export function getStripePaymentApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `stripe-payment-api-row-${normalized || 'entry'}`
}

type StripeApiDocRow = {
  key: string
  typeLabel: string
  value: string
  responsibility: string
  valueKey?: string
  notes?: string
  searchHints?: string[]
}

const STRIPE_DOC_ROWS: ReadonlyArray<StripeApiDocRow> = [
  {
    key: 'stripeApi.docs_url',
    typeLabel: 'url',
    value: 'https://docs.stripe.com/api',
    responsibility: 'Authoritative Stripe API reference for resources, parameters, and errors.',
    searchHints: ['stripe docs api reference view as markdown'],
  },
  {
    key: 'stripeApi.base_url',
    typeLabel: 'url',
    value: 'https://api.stripe.com',
    responsibility: 'Base URL for Stripe API requests.',
    searchHints: ['stripe base url api.stripe.com'],
  },
  {
    key: 'stripeApi.request.auth_header',
    typeLabel: 'header',
    value: 'Authorization: Bearer <STRIPE_SECRET_KEY>',
    responsibility: 'Authorization header for authenticated Stripe API calls.',
    notes: 'Keep secret keys server-side only; never embed in client code or public repos.',
    searchHints: ['authorization bearer header', 'sk_test_', 'sk_live_'],
  },
  {
    key: 'stripeApi.request.content_type',
    typeLabel: 'header',
    value: 'Content-Type: application/x-www-form-urlencoded',
    responsibility: 'Stripe REST API requests accept form-encoded bodies by default.',
    searchHints: ['form-encoded', 'application/x-www-form-urlencoded'],
  },
  {
    key: 'stripeApi.request.idempotency_key',
    typeLabel: 'header',
    value: 'Idempotency-Key: <uuid>',
    responsibility: 'Optional idempotency key to safely retry POST requests without duplicating side effects.',
    searchHints: ['idempotency', 'retry', 'duplicate charge'],
  },
  {
    key: 'stripeApi.auth.secret_key',
    typeLabel: 'secret string',
    value: '—',
    responsibility: 'Server-side secret key used to authenticate Stripe API requests.',
    valueKey: 'payments.stripe.secretKey',
    notes: 'Keep secret keys server-side only; do not expose in client code.',
    searchHints: ['sk_test_', 'sk_live_', 'secret key', 'authentication'],
  },
  {
    key: 'stripeApi.auth.publishable_key',
    typeLabel: 'string',
    value: '—',
    responsibility: 'Optional publishable key (client-side) for Stripe.js flows.',
    valueKey: 'payments.stripe.publishableKey',
    searchHints: ['publishable key', 'pk_test_', 'pk_live_'],
  },
  {
    key: 'stripeApi.mode',
    typeLabel: 'enum',
    value: 'test',
    responsibility: 'Operational mode label for your stored Stripe keys (test vs live).',
    valueKey: 'payments.stripe.mode',
    searchHints: ['test mode', 'live mode', 'sandbox'],
  },
  {
    key: 'stripeApi.webhooks.signing_secret',
    typeLabel: 'secret string',
    value: '—',
    responsibility: 'Webhook signing secret used to verify Stripe webhook signatures.',
    valueKey: 'payments.stripe.webhookSecret',
    searchHints: ['webhook', 'signature', 'whsec_'],
  },
  {
    key: 'stripeApi.account.id',
    typeLabel: 'string',
    value: '—',
    responsibility: 'Optional Stripe account id for multi-account / Connect contexts.',
    valueKey: 'payments.stripe.accountId',
    searchHints: ['connect', 'account', 'acct_'],
  },
  {
    key: 'stripeApi.request.stripe_account_header',
    typeLabel: 'header',
    value: 'Stripe-Account: <acct_...>',
    responsibility: 'Optional header to make calls on behalf of a connected account.',
    searchHints: ['stripe account header', 'connect', 'acct_'],
  },
  {
    key: 'stripeApi.transport',
    typeLabel: 'string',
    value: 'HTTPS only',
    responsibility: 'Stripe API requests must be made over HTTPS.',
    searchHints: ['https', 'tls'],
  },
  {
    key: 'stripeApi.errors.http_status_codes',
    typeLabel: 'map',
    value: '200 OK; 400 Bad Request; 401 Unauthorized; 402 Request Failed; 403 Forbidden; 404 Not Found; 409 Conflict; 429 Too Many Requests; 5xx Server Error.',
    responsibility: 'HTTP status code categories commonly returned by the Stripe API.',
    searchHints: ['stripe http status codes', '402 request failed', '409 conflict', '429 too many requests'],
  },
  {
    key: 'stripeApi.errors.types',
    typeLabel: 'enum',
    value: 'api_error | card_error | idempotency_error | invalid_request_error',
    responsibility: 'Stripe API error.type categories for programmatic handling.',
    searchHints: ['stripe error types', 'card_error', 'idempotency_error'],
  },
  {
    key: 'stripeApi.endpoints.payment_intents.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/payment_intents',
    responsibility: 'Creates a PaymentIntent for collecting a payment.',
    searchHints: ['payment intents', 'create paymentintent'],
  },
  {
    key: 'stripeApi.endpoints.payment_intents.confirm',
    typeLabel: 'endpoint',
    value: 'POST /v1/payment_intents/{id}/confirm',
    responsibility: 'Confirms an existing PaymentIntent (server-driven confirmation flow).',
    searchHints: ['payment intents confirm'],
  },
  {
    key: 'stripeApi.endpoints.payment_intents.retrieve',
    typeLabel: 'endpoint',
    value: 'GET /v1/payment_intents/{id}',
    responsibility: 'Retrieves a PaymentIntent by id.',
    searchHints: ['payment intents retrieve'],
  },
  {
    key: 'stripeApi.endpoints.setup_intents.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/setup_intents',
    responsibility: 'Creates a SetupIntent for saving a payment method for future use.',
    searchHints: ['setup intents create'],
  },
  {
    key: 'stripeApi.endpoints.checkout.sessions.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/checkout/sessions',
    responsibility: 'Creates a Checkout Session for hosted checkout.',
    searchHints: ['checkout sessions create'],
  },
  {
    key: 'stripeApi.endpoints.checkout.sessions.retrieve',
    typeLabel: 'endpoint',
    value: 'GET /v1/checkout/sessions/{id}',
    responsibility: 'Retrieves a Checkout Session by id.',
    searchHints: ['checkout sessions retrieve'],
  },
  {
    key: 'stripeApi.endpoints.customers.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/customers',
    responsibility: 'Creates a Customer record for recurring billing and saved payment methods.',
    searchHints: ['customers create'],
  },
  {
    key: 'stripeApi.endpoints.products.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/products',
    responsibility: 'Creates a Product used for pricing and catalog organization.',
    searchHints: ['products create'],
  },
  {
    key: 'stripeApi.endpoints.prices.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/prices',
    responsibility: 'Creates a Price (amount, currency, interval) attached to a Product.',
    searchHints: ['prices create'],
  },
  {
    key: 'stripeApi.endpoints.subscriptions.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/subscriptions',
    responsibility: 'Creates a Subscription for recurring charges.',
    searchHints: ['subscriptions create'],
  },
  {
    key: 'stripeApi.endpoints.invoices.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/invoices',
    responsibility: 'Creates an Invoice for a customer.',
    searchHints: ['invoices create'],
  },
  {
    key: 'stripeApi.endpoints.refunds.create',
    typeLabel: 'endpoint',
    value: 'POST /v1/refunds',
    responsibility: 'Creates a Refund for a prior charge or payment.',
    searchHints: ['refunds create'],
  },
]

export const STRIPE_PAYMENT_API_REQUEST_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> = STRIPE_DOC_ROWS.map((row) => {
  const meta: SettingMeta = {
    key: row.key,
    type: 'string',
    source: 'backendEnv',
    read: () => row.value,
  }
  const details: FlowDetails = {
    area: STRIPE_PAYMENT_API_DOC_AREA,
    responsibility: row.responsibility,
    notes: row.notes,
  }
  return {
    meta,
    details,
    value: row.value,
    typeLabel: row.typeLabel,
    valueKey: row.valueKey,
    searchHints: row.searchHints,
  }
})
