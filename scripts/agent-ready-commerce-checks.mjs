import {
  AGENTIC_COMMERCE_API_VERSION,
  AGENTIC_COMMERCE_ROUTE_PATHS,
} from '../grph-shared/dist/payments/agenticCommerceSsot.js'

const hasPaymentInfo = (openApi) => Object.values(openApi.paths || {}).some((pathItem) =>
  Object.values(pathItem || {}).some((operation) => {
    const paymentInfo = operation?.['x-payment-info']
    return paymentInfo?.intent && paymentInfo?.method && paymentInfo?.amount && paymentInfo?.currency
  }))

const readPaymentRequiredHeader = (response) => {
  const headerValue = response.headers.get('payment-required')
  if (!headerValue) return null
  try {
    return JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export const buildAgentReadyCommerceChecks = ({ originUrl }) => [
  {
    name: 'commerce-acp-discovery',
    url: `${originUrl}${AGENTIC_COMMERCE_ROUTE_PATHS.acpDiscovery}`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.protocol?.name === 'acp'
        && payload.protocol?.version === AGENTIC_COMMERCE_API_VERSION
        && payload.protocol?.supported_versions?.includes(AGENTIC_COMMERCE_API_VERSION)
        && payload.api_base_url === originUrl
        && payload.transports?.includes('rest')
        && Array.isArray(payload.capabilities?.services)
        && payload.capabilities.services.includes('checkout')
    },
  },
  {
    name: 'commerce-ucp-profile',
    url: `${originUrl}${AGENTIC_COMMERCE_ROUTE_PATHS.ucpProfile}`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.ucp?.version
        && payload.protocol_version
        && payload.ucp?.services
        && payload.ucp?.capabilities
        && payload.ucp?.payment_handlers
        && payload.ucp?.endpoints?.x402_payment_required
        && Array.isArray(payload.services)
        && payload.services.length > 0
        && payload.capabilities?.content_payments === true
        && payload.endpoints?.x402_payment_required
    },
  },
  {
    name: 'commerce-mpp-openapi',
    url: `${originUrl}${AGENTIC_COMMERCE_ROUTE_PATHS.mppOpenApi}`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = JSON.parse(body)
      return response.ok
        && payload.openapi === '3.1.0'
        && hasPaymentInfo(payload)
    },
  },
  {
    name: 'commerce-x402-payment-required',
    url: `${originUrl}${AGENTIC_COMMERCE_ROUTE_PATHS.x402PaymentRequired}`,
    accept: 'application/json',
    assert: async (response, body) => {
      const payload = readPaymentRequiredHeader(response) || JSON.parse(body)
      return response.status === 402
        && response.headers.get('content-type')?.includes('application/json')
        && Boolean(response.headers.get('payment-required'))
        && payload.x402Version === 2
        && Array.isArray(payload.accepts)
        && payload.accepts.some((entry) => entry?.scheme === 'exact' && entry?.payTo && entry?.asset && entry?.network)
    },
  },
  {
    name: 'commerce-x402-api-root',
    url: `${originUrl}${AGENTIC_COMMERCE_ROUTE_PATHS.x402ApiRoot}`,
    accept: 'application/json',
    assert: async (response) => {
      const payload = readPaymentRequiredHeader(response)
      return response.status === 402
        && payload?.x402Version === 2
        && payload.accepts?.some((entry) => entry?.scheme === 'exact' && entry?.payTo && entry?.asset && entry?.network)
    },
  },
]
