import {
  GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ARG,
  GRABMAPS_DEFAULT_MCP_COMMAND,
  GRABMAPS_DEFAULT_MCP_PACKAGE,
  GRABMAPS_DEFAULT_MCP_SERVER_KEY,
  GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
  GRABMAPS_DEFAULT_MCP_URL,
} from 'grph-shared/geospatial/grabMapsSsot'

const readRenderedFormValues = (container: Element): string => (
  Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))
    .map(el => el.value)
    .join('\n')
)

export function assertMapsHubOmitsGrabMapsMcpConfig(text: string): void {
  ;[
    'grabmaps.mcp.url',
    'grabmaps.mcp.discovery.chat_model',
    'grabmaps.mcp.search_places.query',
    'grabmapsMcp.server_key',
    GRABMAPS_DEFAULT_MCP_SERVER_KEY,
    GRABMAPS_DEFAULT_MCP_URL,
  ].forEach(token => {
    if (text.includes(token)) {
      throw new Error(`expected maps hub MCP guidance to move out of maps tab ${JSON.stringify(token)}, got ${JSON.stringify(text)}`)
    }
  })
}

export function assertMcpHubSurfacesGrabMapsMcpConfig(container: Element): void {
  const text = container.textContent || ''
  const searchableText = `${text}\n${readRenderedFormValues(container)}`
  ;[
    'maps.grabmaps.mcp.url',
    'grabmaps.mcp.url',
    'grabmapsMcp.server_key',
    'grabmapsMcp.command',
    'grabmapsMcp.args',
    'grabmapsMcp.env',
    'grabmapsMcp.startup_timeout_ms',
    GRABMAPS_DEFAULT_MCP_SERVER_KEY,
    GRABMAPS_DEFAULT_MCP_COMMAND,
    GRABMAPS_DEFAULT_MCP_PACKAGE,
    GRABMAPS_DEFAULT_MCP_URL,
    GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ARG,
    String(GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS),
  ].forEach(token => {
    if (!searchableText.includes(token)) {
      throw new Error(`expected MCP hub to include MCP server guidance/config ${JSON.stringify(token)}, got ${JSON.stringify(searchableText)}`)
    }
  })
  const mcpAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-anchor]'))
    .map(el => String(el.dataset.kgAnchor || ''))
    .filter(Boolean)
  if (!mcpAnchors.some(anchor => anchor.startsWith('mcp-row-'))) {
    throw new Error(`expected MCP hub rows to use MCP-owned anchors, got ${JSON.stringify(mcpAnchors)}`)
  }
  if (mcpAnchors.some(anchor => anchor.startsWith('maps-row-grabmaps-mcp'))) {
    throw new Error(`expected MCP hub to avoid Maps-owned anchors for MCP rows, got ${JSON.stringify(mcpAnchors)}`)
  }
}
