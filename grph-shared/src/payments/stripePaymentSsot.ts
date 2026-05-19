export const STRIPE_PAYMENT_API_VERSION = '2026-05-19'

export const STRIPE_PAYMENT_ROUTE_PATHS = {
  checkoutSession: '/api/payments/stripe/checkout/session',
  webhook: '/api/payments/stripe/webhook',
} as const

export const STRIPE_PAYMENT_ENV_KEYS = {
  restrictedKey: 'STRIPE_RESTRICTED_KEY',
  secretKey: 'STRIPE_SECRET_KEY',
  webhookSecret: 'STRIPE_WEBHOOK_SECRET',
  checkoutPriceId: 'STRIPE_CHECKOUT_PRICE_ID',
  checkoutCurrency: 'STRIPE_CHECKOUT_CURRENCY',
  checkoutUnitAmount: 'STRIPE_CHECKOUT_UNIT_AMOUNT',
  checkoutProductName: 'STRIPE_CHECKOUT_PRODUCT_NAME',
  checkoutReturnOrigin: 'STRIPE_CHECKOUT_RETURN_ORIGIN',
} as const

export const STRIPE_CHECKOUT_MAX_QUANTITY = 99
export const STRIPE_CHECKOUT_METADATA_SOURCE = 'mainpanel-payments'

export type StripePaymentEnvLike = Record<string, unknown>

export type StripeCheckoutSessionCreatePayload = {
  successUrl: string
  cancelUrl: string
  workspaceId?: string | null
  quantity?: number | null
}

export type StripeCheckoutServerConfig =
  | {
      ok: true
      priceId: string
      currency: null
      unitAmount: null
      productName: null
    }
  | {
      ok: true
      priceId: null
      currency: string
      unitAmount: number
      productName: string
    }
  | {
      ok: false
      error: string
    }

const readEnvString = (env: StripePaymentEnvLike, key: string): string =>
  String(env[key] || '').trim()

export const readStripePaymentServerKey = (env: StripePaymentEnvLike): string => {
  const restrictedKey = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.restrictedKey)
  if (restrictedKey.startsWith('rk_')) return restrictedKey
  const secretKey = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.secretKey)
  if (secretKey.startsWith('sk_')) return secretKey
  return ''
}

export const readStripeWebhookSigningSecret = (env: StripePaymentEnvLike): string => {
  const secret = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.webhookSecret)
  return secret.startsWith('whsec_') ? secret : ''
}

export const readStripeCheckoutReturnOrigin = (env: StripePaymentEnvLike): string =>
  readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.checkoutReturnOrigin).replace(/\/+$/g, '')

export function resolveStripeCheckoutServerConfig(env: StripePaymentEnvLike): StripeCheckoutServerConfig {
  const priceId = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.checkoutPriceId)
  if (priceId) {
    if (!priceId.startsWith('price_')) {
      return { ok: false, error: 'STRIPE_CHECKOUT_PRICE_ID must be a Stripe Price id.' }
    }
    return {
      ok: true,
      priceId,
      currency: null,
      unitAmount: null,
      productName: null,
    }
  }

  const currency = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.checkoutCurrency).toLowerCase()
  const rawUnitAmount = Number(readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.checkoutUnitAmount))
  const productName = readEnvString(env, STRIPE_PAYMENT_ENV_KEYS.checkoutProductName)
  if (!currency || !Number.isFinite(rawUnitAmount) || !productName) {
    return {
      ok: false,
      error: 'Set STRIPE_CHECKOUT_PRICE_ID, or set STRIPE_CHECKOUT_CURRENCY, STRIPE_CHECKOUT_UNIT_AMOUNT, and STRIPE_CHECKOUT_PRODUCT_NAME.',
    }
  }
  if (!/^[a-z]{3}$/.test(currency)) {
    return { ok: false, error: 'STRIPE_CHECKOUT_CURRENCY must be a 3-letter lowercase currency code.' }
  }
  const unitAmount = Math.floor(rawUnitAmount)
  if (unitAmount <= 0) {
    return { ok: false, error: 'STRIPE_CHECKOUT_UNIT_AMOUNT must be a positive integer minor-unit amount.' }
  }
  return {
    ok: true,
    priceId: null,
    currency,
    unitAmount,
    productName,
  }
}

export const normalizeStripeCheckoutQuantity = (value: unknown): number => {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.min(STRIPE_CHECKOUT_MAX_QUANTITY, Math.floor(raw)))
}

export function isStripeCheckoutReturnUrlAllowed(
  rawUrl: string,
  requestOrigin: string,
  configuredOrigin?: string | null,
): boolean {
  try {
    const parsed = new URL(String(rawUrl || '').trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const allowedOrigin = String(configuredOrigin || '').trim().replace(/\/+$/g, '')
    if (allowedOrigin) return parsed.origin === allowedOrigin
    const fallbackOrigin = String(requestOrigin || '').trim().replace(/\/+$/g, '')
    return fallbackOrigin ? parsed.origin === fallbackOrigin : false
  } catch {
    return false
  }
}

export function buildStripeCheckoutSessionCreateForm(
  payload: StripeCheckoutSessionCreatePayload,
  config: Exclude<StripeCheckoutServerConfig, { ok: false }>,
): URLSearchParams {
  const workspaceId = String(payload.workspaceId || '').trim()
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', String(payload.successUrl || '').trim())
  form.set('cancel_url', String(payload.cancelUrl || '').trim())
  form.set('line_items[0][quantity]', String(normalizeStripeCheckoutQuantity(payload.quantity)))
  if (config.priceId !== null) {
    form.set('line_items[0][price]', config.priceId)
  } else {
    form.set('line_items[0][price_data][currency]', String(config.currency || ''))
    form.set('line_items[0][price_data][unit_amount]', String(config.unitAmount))
    form.set('line_items[0][price_data][product_data][name]', String(config.productName || ''))
  }
  form.set('metadata[source]', STRIPE_CHECKOUT_METADATA_SOURCE)
  if (workspaceId) {
    form.set('client_reference_id', workspaceId)
    form.set('metadata[workspace_id]', workspaceId)
  }
  return form
}
