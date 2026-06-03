import {
  API_NATIVE_BROWSER_DEFAULT_MCP_COMMAND,
  API_NATIVE_BROWSER_DEFAULT_MCP_PACKAGE,
  API_NATIVE_BROWSER_DEFAULT_MCP_SERVER_KEY,
  API_NATIVE_BROWSER_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
  API_NATIVE_BROWSER_DEFAULT_RUNTIME_URL,
} from 'grph-shared/browser/apiNativeBrowserMcpSsot'
import {
  GRABMAPS_DEFAULT_MCP_AUTH_HEADER_ARG,
  GRABMAPS_DEFAULT_MCP_COMMAND,
  GRABMAPS_DEFAULT_MCP_PACKAGE,
  GRABMAPS_DEFAULT_MCP_SERVER_KEY,
  GRABMAPS_DEFAULT_MCP_STARTUP_TIMEOUT_MS,
  GRABMAPS_DEFAULT_MCP_URL,
} from 'grph-shared/geospatial/grabMapsSsot'
import {
  STRIPE_MCP_DEFAULT_LOCAL_COMMAND,
  STRIPE_MCP_DEFAULT_LOCAL_PACKAGE,
  STRIPE_MCP_DEFAULT_SERVER_KEY,
  STRIPE_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
  STRIPE_MCP_REGISTRY_URL,
  STRIPE_MCP_REMOTE_URL,
  STRIPE_MCP_RESTRICTED_KEY_ENV_REF,
  STRIPE_MCP_SECRET_ENV_KEY,
} from 'grph-shared/payments/stripeMcpSsot'
import {
  EXA_MCP_API_KEY_HEADER,
  EXA_MCP_DASHBOARD_URL,
  EXA_MCP_DEFAULT_CONNECTION_MODE,
  EXA_MCP_DEFAULT_ENABLED_TOOLS_JSON,
  EXA_MCP_DEFAULT_FETCH_CONTENT_LIMIT,
  EXA_MCP_DEFAULT_MAX_RESULTS,
  EXA_MCP_DEFAULT_SERVER_KEY,
  EXA_MCP_DEFAULT_STARTUP_TIMEOUT_MS,
  EXA_MCP_DOCS_MARKDOWN_URL,
  EXA_MCP_DOCS_URL,
  EXA_MCP_GITHUB_URL,
  EXA_MCP_LOCAL_API_KEY_ENV,
  EXA_MCP_REMOTE_URL,
} from 'grph-shared/search/exaMcpSsot'
import {
  CLOUDFLARE_PAY_PER_CRAWL_DOC_URL,
  CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS,
  CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS,
  KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS,
  KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
  KNOWGRPH_STORAGE_ROUTE_PATHS,
  buildKnowgrphStorageLlmsPath,
  buildKnowgrphStorageSourceFilesIndexPath,
} from '@/lib/storage/knowgrphStorageSyncContract'

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

export function assertMcpHubSurfacesApiNativeBrowserMcpConfig(container: Element): void {
  const text = container.textContent || ''
  const searchableText = `${text}\n${readRenderedFormValues(container)}`
  ;[
    'browserMcp.server_key',
    'browserMcp.command',
    'browserMcp.args',
    'browserMcp.env',
    'browserMcp.runtime_url',
    'browserMcp.default_intent',
    'browserMcp.target_url',
    'browserMcp.dry_run',
    'browserMcp.confirm_unsafe',
    'browserMcp.confirm_third_party_terms',
    'browserMcp.confirm_cookie_import',
    'browserMcp.agent_config',
    'browserMcp.bridge_config',
    'mcpServers',
    'UNBROWSE_URL',
    'KNOWGRPH_BROWSER_API_RUNTIME_URL',
    'native browser actions',
    API_NATIVE_BROWSER_DEFAULT_MCP_SERVER_KEY,
    API_NATIVE_BROWSER_DEFAULT_MCP_COMMAND,
    API_NATIVE_BROWSER_DEFAULT_MCP_PACKAGE,
    API_NATIVE_BROWSER_DEFAULT_RUNTIME_URL,
    String(API_NATIVE_BROWSER_DEFAULT_MCP_STARTUP_TIMEOUT_MS),
    'Route cache, native browser actions, loopback runtime URL, dry-run, unsafe-action, third-party terms, and cookie-import confirmation stay configurable in MainPanel MCP.',
  ].forEach(token => {
    if (!searchableText.includes(token)) {
      throw new Error(`expected MCP hub to include API-native browser MCP config ${JSON.stringify(token)}, got ${JSON.stringify(searchableText)}`)
    }
  })
  const mcpAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-anchor]'))
    .map(el => String(el.dataset.kgAnchor || ''))
    .filter(Boolean)
  if (!mcpAnchors.some(anchor => anchor.startsWith('mcp-row-browser-'))) {
    throw new Error(`expected API-native browser MCP rows to use browser MCP anchors, got ${JSON.stringify(mcpAnchors)}`)
  }
}

export function assertMcpHubSurfacesStripeMcpPaymentReadiness(container: Element): void {
  const text = container.textContent || ''
  const searchableText = `${text}\n${readRenderedFormValues(container)}`
  ;[
    'Stripe MCP Configuration',
    'stripeMcp.server_key',
    'stripeMcp.remote.url',
    'stripeMcp.remote.connection',
    'stripeMcp.local.command',
    'stripeMcp.local.args',
    'stripeMcp.startup_timeout_ms',
    'stripeMcp.tool.confirmation_required',
    'stripeMcp.payment_tools',
    'stripeMcp.remote_config',
    'stripeMcp.local_config',
    'stripeMcp.restricted_key_scope',
    'stripeMcp.accept_payment_ready',
    'stripeMcp.registry.url',
    STRIPE_MCP_DEFAULT_SERVER_KEY,
    STRIPE_MCP_REMOTE_URL,
    STRIPE_MCP_DEFAULT_LOCAL_COMMAND,
    STRIPE_MCP_DEFAULT_LOCAL_PACKAGE,
    STRIPE_MCP_SECRET_ENV_KEY,
    STRIPE_MCP_RESTRICTED_KEY_ENV_REF,
    STRIPE_MCP_REGISTRY_URL,
    String(STRIPE_MCP_DEFAULT_STARTUP_TIMEOUT_MS),
    'create_payment_link',
    'create_price',
    'create_product',
    'create_refund',
    'human confirmation',
    'accept payment',
    'checkout handoff',
    'Payment-mutating MCP tools stay behind human confirmation and least-privilege authorization.',
    'Open MainPanel Commerce',
  ].forEach(token => {
    if (!searchableText.includes(token)) {
      throw new Error(`expected MCP hub to include Stripe MCP payment-readiness token ${JSON.stringify(token)}, got ${JSON.stringify(searchableText)}`)
    }
  })
  ;['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_'].forEach(token => {
    if (searchableText.includes(token)) {
      throw new Error(`expected Stripe MCP surface to avoid embedded secret key examples ${JSON.stringify(token)}`)
    }
  })
  const mcpAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-anchor]'))
    .map(el => String(el.dataset.kgAnchor || ''))
    .filter(Boolean)
  if (!mcpAnchors.some(anchor => anchor.startsWith('mcp-row-stripe-'))) {
    throw new Error(`expected Stripe MCP rows to use Stripe MCP anchors, got ${JSON.stringify(mcpAnchors)}`)
  }
}

export function assertMcpHubSurfacesCrawlerAccessAndPaymentReadiness(container: Element): void {
  const text = container.textContent || ''
  const searchableText = `${text}\n${readRenderedFormValues(container)}`
  const defaultIndexPath = buildKnowgrphStorageSourceFilesIndexPath(KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID)
  const defaultLlmsPath = buildKnowgrphStorageLlmsPath(KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID)
  ;[
    'Crawler Access MCP Configuration',
    'crawlerMcp.default_workspace_id',
    'crawlerMcp.route.source_files.index',
    'crawlerMcp.route.source_files.workspace_index',
    'crawlerMcp.route.llms.default',
    'crawlerMcp.route.llms.workspace',
    'crawlerMcp.route.doc_view.default',
    'crawlerMcp.route.doc_view',
    'crawlerMcp.headers.worker',
    'crawlerMcp.headers.cloudflare_pay_per_crawl',
    'crawlerMcp.policy.pay_per_crawl_boundary',
    'crawlerMcp.guard.read_only_source_files',
    'crawlerMcp.payment.handoff',
    'crawlerMcp.readiness_manifest',
    KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID,
    KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndex,
    KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndexPrefix,
    KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesLlms,
    KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix,
    KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix,
    KNOWGRPH_STORAGE_ROUTE_PATHS.exportPrefix,
    defaultIndexPath,
    defaultLlmsPath,
    KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.source,
    KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS.payPerCrawlPolicy,
    CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS.exactPrice,
    CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS.maxPrice,
    CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.price,
    CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.charged,
    CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS.error,
    CLOUDFLARE_PAY_PER_CRAWL_DOC_URL,
    'Web Bot Auth',
    'cloudflare-zone-policy',
    'read-only Source Files',
    'D1 document rows',
    'doc-view URLs',
    'Pay Per Crawl',
    'accept payment',
    'Stripe MCP',
    'MainPanel Commerce',
  ].forEach(token => {
    if (!searchableText.includes(token)) {
      throw new Error(`expected MCP hub to include crawler/payment readiness token ${JSON.stringify(token)}, got ${JSON.stringify(searchableText)}`)
    }
  })
  ;[
    'Worker sets crawler-price',
    'Worker sets crawler-charged',
    'app-local crawler price',
  ].forEach(token => {
    if (searchableText.includes(token)) {
      throw new Error(`expected crawler MCP readiness to avoid app-local Pay Per Crawl emulation ${JSON.stringify(token)}`)
    }
  })
  const mcpAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-anchor]'))
    .map(el => String(el.dataset.kgAnchor || ''))
    .filter(Boolean)
  if (!mcpAnchors.some(anchor => anchor.startsWith('mcp-row-crawler-'))) {
    throw new Error(`expected crawler MCP rows to use crawler MCP anchors, got ${JSON.stringify(mcpAnchors)}`)
  }
}

export function assertMcpHubSurfacesExaMcpConfig(container: Element): void {
  const text = container.textContent || ''
  const searchableText = `${text}\n${readRenderedFormValues(container)}`
  ;[
    'Exa MCP Configuration',
    'exaMcp.server_key',
    'exaMcp.remote.url',
    'exaMcp.tool_profile',
    'exaMcp.enabled_tools',
    'exaMcp.connection.mode',
    'exaMcp.startup_timeout_ms',
    'exaMcp.max_results',
    'exaMcp.fetch_content_limit',
    'exaMcp.require_fetch_review',
    'exaMcp.remote_config.codex',
    'exaMcp.remote_config.generic',
    'web_search_exa',
    'web_fetch_exa',
    'web_search_advanced_exa',
    'company_research_exa',
    'crawling_exa',
    'deprecated',
    'mcpServers',
    `codex mcp add ${EXA_MCP_DEFAULT_SERVER_KEY} --url '${EXA_MCP_REMOTE_URL}'`,
    EXA_MCP_DEFAULT_SERVER_KEY,
    EXA_MCP_REMOTE_URL,
    EXA_MCP_DEFAULT_ENABLED_TOOLS_JSON,
    EXA_MCP_DEFAULT_CONNECTION_MODE,
    String(EXA_MCP_DEFAULT_STARTUP_TIMEOUT_MS),
    String(EXA_MCP_DEFAULT_MAX_RESULTS),
    String(EXA_MCP_DEFAULT_FETCH_CONTENT_LIMIT),
    String(EXA_MCP_API_KEY_HEADER),
    String(EXA_MCP_LOCAL_API_KEY_ENV),
    EXA_MCP_DOCS_URL,
    EXA_MCP_DOCS_MARKDOWN_URL,
    EXA_MCP_GITHUB_URL,
    EXA_MCP_DASHBOARD_URL,
    'restart_mcp_client_after_config_change',
    'Open Exa MCP Docs',
    'Open FloatingPanel Chat UI',
  ].forEach(token => {
    if (!searchableText.includes(token)) {
      throw new Error(`expected MCP hub to include Exa MCP config token ${JSON.stringify(token)}, got ${JSON.stringify(searchableText)}`)
    }
  })
  ;[
    'YOUR_EXA_API_KEY',
    'your_api_key',
    'exaApiKey=',
    'sk_test_',
    'sk_live_',
  ].forEach(token => {
    if (searchableText.includes(token)) {
      throw new Error(`expected Exa MCP surface to avoid embedded secret examples ${JSON.stringify(token)}`)
    }
  })
  const mcpAnchors = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-anchor]'))
    .map(el => String(el.dataset.kgAnchor || ''))
    .filter(Boolean)
  if (!mcpAnchors.some(anchor => anchor.startsWith('mcp-row-exa-'))) {
    throw new Error(`expected Exa MCP rows to use Exa MCP anchors, got ${JSON.stringify(mcpAnchors)}`)
  }
}
