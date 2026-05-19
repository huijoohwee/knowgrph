export const STRIPE_MCP_DOC_AREA = 'Stripe MCP Configuration'

export const STRIPE_MCP_DOCS_URL = 'https://docs.stripe.com/mcp'

export const STRIPE_MCP_REGISTRY_URL = 'https://github.com/mcp/com.stripe/mcp'

export const STRIPE_MCP_REMOTE_URL = 'https://mcp.stripe.com'

export const STRIPE_MCP_DEFAULT_SERVER_KEY = 'stripe'

export const STRIPE_MCP_CONNECTION_MODES = ['oauth', 'bearer'] as const

export const STRIPE_MCP_DEFAULT_CONNECTION_MODE = 'oauth'

export const STRIPE_MCP_DEFAULT_LOCAL_COMMAND = 'npx'

export const STRIPE_MCP_DEFAULT_LOCAL_PACKAGE = '@stripe/mcp@latest'

export const STRIPE_MCP_DEFAULT_LOCAL_ARGS = [
  '-y',
  STRIPE_MCP_DEFAULT_LOCAL_PACKAGE,
] as const

export const STRIPE_MCP_SECRET_ENV_KEY = 'STRIPE_SECRET_KEY'

export const STRIPE_MCP_RESTRICTED_KEY_ENV_REF = '${STRIPE_RESTRICTED_KEY}'

export const STRIPE_MCP_DEFAULT_LOCAL_ENV_TEMPLATE = {
  [STRIPE_MCP_SECRET_ENV_KEY]: STRIPE_MCP_RESTRICTED_KEY_ENV_REF,
} as const

export const STRIPE_MCP_DEFAULT_STARTUP_TIMEOUT_MS = 60000

export const STRIPE_MCP_DEFAULT_REQUIRE_CONFIRMATION = true

export const STRIPE_MCP_PAYMENT_TOOL_NAMES = [
  'create_payment_link',
  'create_product',
  'create_price',
  'create_customer',
  'create_invoice',
  'create_invoice_item',
  'finalize_invoice',
  'list_payment_intents',
  'create_refund',
] as const

export const STRIPE_MCP_DEFAULT_LOCAL_ARGS_JSON = JSON.stringify(STRIPE_MCP_DEFAULT_LOCAL_ARGS, null, 2)

export const STRIPE_MCP_DEFAULT_LOCAL_ENV_TEMPLATE_JSON = JSON.stringify(STRIPE_MCP_DEFAULT_LOCAL_ENV_TEMPLATE, null, 2)
