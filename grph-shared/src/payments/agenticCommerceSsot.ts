import { hashSignatureParts } from '../hash/signature.js'

type SignaturePrimitive = string | number | boolean | null | undefined

export const AGENTIC_COMMERCE_API_VERSION = '2026-01-30'

export const AGENTIC_COMMERCE_ROUTE_PATHS = {
  acpConfig: '/.well-known/acp-config',
  checkoutSessions: '/checkout/sessions',
  commerceWebhook: '/api/payments/commerce/webhook',
} as const

export const AGENTIC_COMMERCE_ENV_KEYS = {
  sellerId: 'SELLER_ID',
  checkoutBaseUrl: 'CHECKOUT_BASE_URL',
  web3Enabled: 'WEB3_ENABLED',
  web3DepositAddress: 'WEB3_DEPOSIT_ADDRESS',
  openboxApiUrl: 'OPENBOX_API_URL',
  openboxApiKey: 'OPENBOX_API_KEY',
} as const

export type AgenticCommerceEnvLike = Record<string, unknown>

const readEnvString = (env: AgenticCommerceEnvLike, key: string): string => (
  String(env[key] || '').trim()
)

export const readAgenticCommerceSellerId = (
  env: AgenticCommerceEnvLike,
  requestUrl: string,
): string => {
  const configured = readEnvString(env, AGENTIC_COMMERCE_ENV_KEYS.sellerId)
  if (configured) return configured
  try {
    return new URL(requestUrl).host
  } catch {
    return 'knowgrph-seller'
  }
}

export const readAgenticCommerceCheckoutBaseUrl = (
  env: AgenticCommerceEnvLike,
  requestUrl: string,
): string => {
  const configured = readEnvString(env, AGENTIC_COMMERCE_ENV_KEYS.checkoutBaseUrl).replace(/\/+$/g, '')
  if (configured) return configured
  try {
    return new URL(requestUrl).origin
  } catch {
    return ''
  }
}

export const isAgenticCommerceWeb3Enabled = (env: AgenticCommerceEnvLike): boolean => {
  const raw = readEnvString(env, AGENTIC_COMMERCE_ENV_KEYS.web3Enabled).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export const normalizeAgenticCommerceCurrency = (value: unknown): string => {
  const currency = String(value || '').trim().toLowerCase()
  return /^[a-z][a-z0-9]{1,11}$/.test(currency) ? currency : ''
}

export const normalizeAgenticCommerceAmount = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0
}

export const buildAgenticCommerceSemanticKey = (
  scope: string,
  parts: SignaturePrimitive[],
): string => hashSignatureParts(['agentic-commerce', scope, ...parts])

export const buildAgenticCommerceDepositAddress = (
  env: AgenticCommerceEnvLike,
  sessionId: string,
): string => {
  const configured = readEnvString(env, AGENTIC_COMMERCE_ENV_KEYS.web3DepositAddress)
  if (/^0x[0-9a-fA-F]{40}$/.test(configured)) return configured
  const first = buildAgenticCommerceSemanticKey('deposit-address', [sessionId, '0'])
  const second = buildAgenticCommerceSemanticKey('deposit-address', [sessionId, '1'])
  const third = buildAgenticCommerceSemanticKey('deposit-address', [sessionId, '2'])
  const fourth = buildAgenticCommerceSemanticKey('deposit-address', [sessionId, '3'])
  const fifth = buildAgenticCommerceSemanticKey('deposit-address', [sessionId, '4'])
  return `0x${first}${second}${third}${fourth}${fifth}`.slice(0, 42)
}

export const buildAgenticCommerceAcpConfig = (args: {
  sellerId: string
  checkoutBaseUrl: string
  web3Enabled: boolean
}) => {
  const base = args.checkoutBaseUrl.replace(/\/+$/g, '')
  const paymentMethods = args.web3Enabled
    ? ['stripe_delegate_token', 'erc20']
    : ['stripe_delegate_token']
  return {
    protocol: 'acp',
    api_version: AGENTIC_COMMERCE_API_VERSION,
    seller: {
      id: args.sellerId,
    },
    endpoints: {
      create_session: `${base}${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}`,
      retrieve_session: `${base}${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/{id}`,
      complete_session: `${base}${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/{id}/complete`,
      cancel_session: `${base}${AGENTIC_COMMERCE_ROUTE_PATHS.checkoutSessions}/{id}/cancel`,
    },
    payment_methods: paymentMethods,
    capabilities: {
      idempotency: true,
      risk_signals: true,
      web3: args.web3Enabled,
    },
    extensions: args.web3Enabled ? ['x-web3'] : [],
  }
}
