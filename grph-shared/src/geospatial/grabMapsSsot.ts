export const GRABMAPS_HOST = 'maps.grab.com'

export const GRABMAPS_BASE_URL = 'https://maps.grab.com'

export const GRABMAPS_PROXY_PATH = '/__grabmaps_proxy'

export const GRABMAPS_DEFAULT_STYLE_URL = `${GRABMAPS_BASE_URL}/api/style.json?theme=light`

export const GRABMAPS_DEFAULT_DIRECTIONS_URL = `${GRABMAPS_BASE_URL}/api/v1/maps/eta/v1/direction`

export const GRABMAPS_DEFAULT_MCP_URL = `${GRABMAPS_BASE_URL}/api/v1/mcp`

export const GRABMAPS_DEFAULT_MCP_SERVER_KEY = 'grab-maps-playground'

export const GRABMAPS_DEFAULT_MCP_COMMAND = 'npx'

export const GRABMAPS_DEFAULT_MCP_PACKAGE = 'mcp-remote@latest'

export const GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ENV_KEY = 'AUTH_HEADER'

export const GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ARG = `Authorization:\${${GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ENV_KEY}}`

export const GRABMAPS_DEFAULT_MCP_ARGS = [
  '-y',
  GRABMAPS_DEFAULT_MCP_PACKAGE,
  GRABMAPS_DEFAULT_MCP_URL,
  '--header',
  GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ARG,
  '--transport',
  'http-only',
] as const

export const GRABMAPS_DEFAULT_MCP_ENV = {
  [GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ENV_KEY]: 'Bearer mcp_{TOKEN}',
} as const

export const GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS = 60000

export const GRABMAPS_DEFAULT_MCP_ARGS_JSON = JSON.stringify(GRABMAPS_DEFAULT_MCP_ARGS, null, 2)

export const GRABMAPS_DEFAULT_MCP_ENV_JSON = JSON.stringify(GRABMAPS_DEFAULT_MCP_ENV, null, 2)

export const GRABMAPS_LIBRARY_ESM_URL = `${GRABMAPS_BASE_URL}/developer/assets/js/grabmaps.es.js`
