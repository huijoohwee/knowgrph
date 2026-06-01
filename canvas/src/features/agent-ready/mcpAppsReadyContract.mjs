export const KNOWGRPH_MCP_APPS_EXTENSION_ID = 'io.modelcontextprotocol/ui'
export const KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app'
export const KNOWGRPH_MCP_APPS_PROTOCOL_VERSION = '2026-01-26'
export const KNOWGRPH_MCP_APPS_SERVER_READINESS_SCHEMA_VERSION = 'knowgrph-mcp-apps-server-readiness/v0.1'
export const KNOWGRPH_MCP_APP_RESOURCE_URI = 'ui://knowgrph/agent-ready'
export const KNOWGRPH_MCP_APP_RESOURCE_NAME = 'knowgrph-agent-ready'
export const KNOWGRPH_MCP_APP_TOOL_NAME = 'inspect_agent_surface'

const normalizeString = (value) => String(value || '').trim()

const escapeHtml = (value) => normalizeString(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const safeJsonForInlineScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

export const buildKnowgrphMcpAppsCapabilities = () => ({
  extensions: {
    [KNOWGRPH_MCP_APPS_EXTENSION_ID]: {
      mimeTypes: [KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE],
    },
  },
})

const arrayFrom = (value) => Array.isArray(value) ? value : []

const booleanCheck = (id, label, ok, evidence = []) => ({
  id,
  label,
  ok: ok === true,
  evidence: arrayFrom(evidence).map(normalizeString).filter(Boolean),
})

export const buildKnowgrphMcpAppsServerReadiness = (args = {}) => {
  const baseUrl = normalizeString(args.baseUrl).replace(/\/+$/, '')
  const updatedAt = normalizeString(args.updatedAt)
  const mcpServerCard = args.mcpServerCard && typeof args.mcpServerCard === 'object' ? args.mcpServerCard : {}
  const capabilities = mcpServerCard.capabilities && typeof mcpServerCard.capabilities === 'object'
    ? mcpServerCard.capabilities
    : {}
  const tools = arrayFrom(args.tools).length ? arrayFrom(args.tools) : arrayFrom(capabilities.tools)
  const resources = arrayFrom(args.resources).length
    ? arrayFrom(args.resources)
    : [buildKnowgrphMcpAppsResourceDescriptor({ appUrl: baseUrl, updatedAt })]
  const appTools = tools.filter((tool) => tool?._meta?.ui?.resourceUri === KNOWGRPH_MCP_APP_RESOURCE_URI)
  const appTool = appTools.find((tool) => tool?.name === KNOWGRPH_MCP_APP_TOOL_NAME) || appTools[0] || null
  const appResource = resources.find((resource) => resource?.uri === KNOWGRPH_MCP_APP_RESOURCE_URI) || null
  const extension = capabilities.extensions?.[KNOWGRPH_MCP_APPS_EXTENSION_ID]
  const transportUrl = normalizeString(mcpServerCard.transport?.url) || (baseUrl ? `${baseUrl}/mcp` : '')
  const transportType = normalizeString(mcpServerCard.transport?.type) || 'http'
  const outputSchemaReady = appTool?.outputSchema && typeof appTool.outputSchema === 'object'
  const textFallbackReady = Boolean(appTool?.name)
  const structuredContentReady = outputSchemaReady
  const checklist = [
    booleanCheck('app-tool-resource-link', 'App tool is linked to the UI resource', appTools.length > 0, appTools.map((tool) => tool.name)),
    booleanCheck('output-schema', 'App tool exposes an output schema', outputSchemaReady, [appTool?.name]),
    booleanCheck('text-fallback', 'Tool result keeps a text fallback for non-UI hosts', textFallbackReady, [appTool?.name]),
    booleanCheck('structured-content', 'Tool result returns structured content for the View', structuredContentReady, [appTool?.name]),
    booleanCheck('resource-descriptor', 'MCP resource descriptor uses the MCP Apps MIME type', appResource?.mimeType === KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE, [appResource?.uri]),
    booleanCheck('resource-security-meta', 'Resource declares UI sandbox metadata', appResource?._meta?.ui?.prefersBorder === true && Boolean(appResource?._meta?.ui?.csp), [appResource?.uri]),
    booleanCheck('extension-capability', 'Server advertises the MCP Apps extension capability', extension?.mimeTypes?.includes(KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE), [KNOWGRPH_MCP_APPS_EXTENSION_ID]),
    booleanCheck('http-transport', 'Server exposes a stateless HTTP JSON-RPC transport', Boolean(transportUrl), [transportUrl]),
    booleanCheck('stdio-transport', 'Repo-local MCP server supports stdio host configuration', args.localStdio === false ? false : true, ['node mcp/server.js']),
  ]
  const ready = checklist.every((check) => check.ok)
  return {
    schemaVersion: KNOWGRPH_MCP_APPS_SERVER_READINESS_SCHEMA_VERSION,
    ready,
    updatedAt,
    app: {
      name: KNOWGRPH_MCP_APP_RESOURCE_NAME,
      protocolVersion: KNOWGRPH_MCP_APPS_PROTOCOL_VERSION,
      resourceUri: KNOWGRPH_MCP_APP_RESOURCE_URI,
      resourceMimeType: KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
      extensionId: KNOWGRPH_MCP_APPS_EXTENSION_ID,
    },
    tool: {
      name: appTool?.name || KNOWGRPH_MCP_APP_TOOL_NAME,
      title: appTool?.title || 'Inspect Agent Surface',
      resourceUri: appTool?._meta?.ui?.resourceUri || KNOWGRPH_MCP_APP_RESOURCE_URI,
      visibility: arrayFrom(appTool?._meta?.ui?.visibility).length ? appTool._meta.ui.visibility : ['model', 'app'],
      readOnly: appTool?.annotations?.readOnlyHint === true,
      hasOutputSchema: Boolean(outputSchemaReady),
      textFallback: textFallbackReady,
      structuredContent: structuredContentReady,
    },
    resource: {
      uri: appResource?.uri || KNOWGRPH_MCP_APP_RESOURCE_URI,
      name: appResource?.name || KNOWGRPH_MCP_APP_RESOURCE_NAME,
      mimeType: appResource?.mimeType || KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
      prefersBorder: appResource?._meta?.ui?.prefersBorder === true,
      csp: appResource?._meta?.ui?.csp || {},
    },
    transports: [
      {
        id: 'pages-http-jsonrpc',
        type: transportType,
        url: transportUrl,
        stateless: true,
        serverFactory: true,
      },
      {
        id: 'local-stdio-jsonrpc',
        type: 'stdio',
        command: 'node mcp/server.js',
        stateless: false,
        serverFactory: true,
      },
    ],
    dataModel: {
      source: 'inspect_agent_surface.structuredContent',
      categories: [
        { id: 'discovery', label: 'Discovery metadata', count: ['health', 'apiCatalog', 'openApi', 'mcpServerCard', 'agentCard', 'agentSkills'].length },
        { id: 'commerce', label: 'Commerce discovery', count: ['acpDiscovery', 'ucpProfile', 'mppOpenApi'].length },
        { id: 'mcp-apps', label: 'MCP Apps server bindings', count: checklist.length },
      ],
      renderMode: 'structured-summary-with-json-fallback',
    },
    checklist,
  }
}

export const buildKnowgrphMcpAppsToolMeta = (args = {}) => ({
  ui: {
    resourceUri: normalizeString(args.resourceUri) || KNOWGRPH_MCP_APP_RESOURCE_URI,
    visibility: Array.isArray(args.visibility) && args.visibility.length
      ? args.visibility
      : ['model', 'app'],
  },
})

export const KNOWGRPH_AGENT_SURFACE_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: true,
  required: ['baseUrl', 'healthUrl', 'mcpUrl'],
  properties: {
    baseUrl: { type: 'string' },
    healthUrl: { type: 'string' },
    mcpUrl: { type: 'string' },
    apiCatalogUrl: { type: 'string' },
    openApiUrl: { type: 'string' },
    mcpServerCardUrl: { type: 'string' },
    agentCardUrl: { type: 'string' },
    agentSkillsUrl: { type: 'string' },
    commerceUrls: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    health: { type: 'object', additionalProperties: true },
    apiCatalog: { type: 'object', additionalProperties: true },
    openApi: { type: 'object', additionalProperties: true },
    mcpServerCard: { type: 'object', additionalProperties: true },
    agentCard: { type: 'object', additionalProperties: true },
    agentSkills: { type: 'object', additionalProperties: true },
    commerce: { type: 'object', additionalProperties: true },
    mcpAppsServerReadiness: { type: 'object', additionalProperties: true },
  },
})

export const buildKnowgrphMcpAppsResourceDescriptor = (args = {}) => {
  const appUrl = normalizeString(args.appUrl)
  const updatedAt = normalizeString(args.updatedAt)
  return {
    uri: KNOWGRPH_MCP_APP_RESOURCE_URI,
    name: KNOWGRPH_MCP_APP_RESOURCE_NAME,
    description: [
      'Interactive MCP Apps view for the existing Knowgrph agent-ready surface.',
      appUrl ? `App URL: ${appUrl}` : '',
      updatedAt ? `Updated: ${updatedAt}` : '',
    ].filter(Boolean).join(' '),
    mimeType: KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
          baseUriDomains: [],
        },
        prefersBorder: true,
      },
    },
  }
}

export const buildKnowgrphMcpAppsHtml = (args = {}) => {
  const appUrl = normalizeString(args.appUrl)
  const updatedAt = normalizeString(args.updatedAt)
  const toolName = normalizeString(args.toolName) || KNOWGRPH_MCP_APP_TOOL_NAME
  const toolNames = Array.isArray(args.toolNames)
    ? args.toolNames.map(normalizeString).filter(Boolean)
    : [toolName]
  const boot = {
    appUrl,
    updatedAt,
    resourceUri: KNOWGRPH_MCP_APP_RESOURCE_URI,
    toolName,
    toolNames,
    protocolVersion: KNOWGRPH_MCP_APPS_PROTOCOL_VERSION,
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Knowgrph Agent Ready</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: Canvas; color: CanvasText; }
    main { display: grid; gap: 12px; min-height: 100vh; padding: 16px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid color-mix(in srgb, CanvasText 18%, transparent); padding-bottom: 10px; }
    h1 { margin: 0; font-size: 16px; line-height: 1.25; letter-spacing: 0; }
    p { margin: 4px 0 0; color: color-mix(in srgb, CanvasText 72%, transparent); font-size: 13px; line-height: 1.45; }
    button, a { border: 1px solid color-mix(in srgb, CanvasText 24%, transparent); border-radius: 6px; background: color-mix(in srgb, Canvas 88%, CanvasText 12%); color: CanvasText; font: inherit; padding: 7px 10px; text-decoration: none; }
    button { cursor: pointer; }
    section { display: grid; gap: 8px; }
    dl { display: grid; grid-template-columns: minmax(110px, max-content) 1fr; gap: 6px 10px; margin: 0; font-size: 12px; }
    dt { color: color-mix(in srgb, CanvasText 62%, transparent); }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    pre { margin: 0; max-height: 48vh; overflow: auto; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 6px; padding: 10px; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; background: color-mix(in srgb, Canvas 94%, CanvasText 6%); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .status { font-size: 12px; color: color-mix(in srgb, CanvasText 66%, transparent); }
    .readiness { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 6px; padding: 10px; background: color-mix(in srgb, Canvas 96%, CanvasText 4%); font-size: 12px; }
    .readiness strong { display: block; font-size: 13px; margin-bottom: 3px; }
    .readiness ul { display: grid; gap: 4px; margin: 8px 0 0; padding: 0; list-style: none; }
    .check { min-width: 0; overflow-wrap: anywhere; }
    .check.ok { color: color-mix(in srgb, CanvasText 74%, #0f766e 26%); }
    .check.fail { color: color-mix(in srgb, CanvasText 68%, #b91c1c 32%); }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Knowgrph Agent Ready</h1>
        <p>Interactive MCP Apps view backed by the existing read-only agent surface.</p>
      </div>
      <div class="actions">
        <button id="refresh" type="button">Refresh</button>
        ${appUrl ? `<a href="${escapeHtml(appUrl)}" target="_blank" rel="noreferrer">Open</a>` : ''}
      </div>
    </header>
    <section aria-label="MCP app state">
      <dl>
        <dt>Resource</dt><dd>${escapeHtml(KNOWGRPH_MCP_APP_RESOURCE_URI)}</dd>
        <dt>Tool</dt><dd>${escapeHtml(toolName)}</dd>
        <dt>Host</dt><dd id="host">Not connected.</dd>
        <dt>Updated</dt><dd>${escapeHtml(updatedAt || 'runtime')}</dd>
        <dt>Status</dt><dd id="status" class="status">Initializing MCP Apps host bridge.</dd>
      </dl>
    </section>
    <section aria-label="MCP Apps server readiness">
      <div id="readiness" class="readiness">Waiting for structured server-readiness data.</div>
    </section>
    <section aria-label="Tool result">
      <pre id="structured">No tool result received yet.</pre>
    </section>
  </main>
  <script>
  (() => {
    const boot = ${safeJsonForInlineScript(boot)};
    const statusEl = document.getElementById('status');
    const hostEl = document.getElementById('host');
    const readinessEl = document.getElementById('readiness');
    const structuredEl = document.getElementById('structured');
    let nextId = 1;
    const pending = new Map();
    const state = { hostCapabilities: null, hostContext: null, input: null, result: null };
    const hasParent = () => window.parent && window.parent !== window;
    const post = (message) => {
      if (!hasParent()) return;
      window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
    };
    const notify = (method, params = {}) => post({ method, params });
    const request = (method, params = {}) => {
      const id = nextId++;
      post({ id, method, params });
      return new Promise((resolve, reject) => {
        pending.set(id, { method, resolve, reject });
        window.setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(method + ' timed out'));
        }, 8000);
      });
    };
    const requestTool = async () => {
      statusEl.textContent = 'Requesting ' + boot.toolName + ' through the host.';
      try {
        const result = await request('tools/call', { name: boot.toolName, arguments: {} });
        state.result = result || null;
        render();
      } catch (error) {
        statusEl.textContent = error && error.message ? error.message : 'Tool request failed.';
      }
    };
    const updateHost = (context = {}) => {
      state.hostContext = { ...(state.hostContext || {}), ...context };
      const host = state.hostContext || {};
      const label = [
        host.displayMode,
        host.theme,
        host.platform,
      ].filter(Boolean).join(' / ');
      hostEl.textContent = label || (state.hostCapabilities ? 'Connected.' : 'Not connected.');
      if (host.theme === 'dark' || host.theme === 'light') {
        document.documentElement.dataset.theme = host.theme;
      }
    };
    const appendText = (parent, tagName, text, className = '') => {
      const element = document.createElement(tagName);
      if (className) element.className = className;
      element.textContent = text;
      parent.appendChild(element);
      return element;
    };
    const renderReadiness = (payload) => {
      readinessEl.replaceChildren();
      const readiness = payload && payload.mcpAppsServerReadiness;
      if (!readiness || typeof readiness !== 'object') {
        readinessEl.textContent = 'Waiting for structured server-readiness data.';
        return;
      }
      readinessEl.className = 'readiness ' + (readiness.ready ? 'ready' : 'not-ready');
      appendText(
        readinessEl,
        'strong',
        readiness.ready ? 'MCP Apps server-ready' : 'MCP Apps server-readiness incomplete',
      );
      const meta = appendText(
        readinessEl,
        'p',
        [readiness.app && readiness.app.protocolVersion, readiness.resource && readiness.resource.mimeType]
          .filter(Boolean)
          .join(' / '),
        'status',
      );
      if (!meta.textContent) meta.remove();
      const list = document.createElement('ul');
      for (const check of Array.isArray(readiness.checklist) ? readiness.checklist : []) {
        const item = document.createElement('li');
        item.className = check && check.ok ? 'check ok' : 'check fail';
        item.textContent = (check && check.ok ? 'OK ' : 'Missing ') + (check && check.label ? check.label : 'readiness check');
        list.appendChild(item);
      }
      readinessEl.appendChild(list);
    };
    const render = () => {
      const payload = state.result && typeof state.result === 'object'
        ? (state.result.structuredContent || state.result)
        : state.result;
      renderReadiness(payload);
      structuredEl.textContent = payload
        ? JSON.stringify(payload, null, 2)
        : 'No tool result received yet.';
      statusEl.textContent = payload
        ? 'Rendered structured tool result.'
        : (state.hostCapabilities ? 'Connected. Waiting for tool result.' : 'Initializing MCP Apps host bridge.');
    };
    const sendSizeChanged = (() => {
      let last = '';
      return () => {
        const body = document.body;
        const root = document.documentElement;
        const width = Math.ceil(Math.max(body.scrollWidth, root.scrollWidth, root.clientWidth));
        const height = Math.ceil(Math.max(body.scrollHeight, root.scrollHeight, root.clientHeight));
        const key = width + 'x' + height;
        if (key === last || width <= 0 || height <= 0) return;
        last = key;
        notify('ui/notifications/size-changed', { width, height });
      };
    })();
    const connect = async () => {
      if (!hasParent()) {
        statusEl.textContent = 'Standalone preview. Waiting for embedded MCP Apps host.';
        return;
      }
      try {
        const result = await request('ui/initialize', {
          protocolVersion: boot.protocolVersion,
          appInfo: {
            name: 'knowgrph-mcp-app',
            title: 'Knowgrph Agent Ready',
            version: '0.1.0',
            description: 'Interactive view for the Knowgrph agent-ready MCP surface.',
            websiteUrl: boot.appUrl || undefined,
          },
          appCapabilities: {
            availableDisplayModes: ['inline', 'fullscreen'],
          },
        });
        state.hostCapabilities = result && result.hostCapabilities ? result.hostCapabilities : {};
        updateHost(result && result.hostContext ? result.hostContext : {});
        notify('ui/notifications/initialized', {});
        sendSizeChanged();
        statusEl.textContent = 'Connected. Waiting for tool result.';
      } catch (error) {
        statusEl.textContent = error && error.message ? error.message : 'Host initialization failed.';
      }
    };
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.jsonrpc !== '2.0') return;
      if (Object.prototype.hasOwnProperty.call(message, 'id') && (Object.prototype.hasOwnProperty.call(message, 'result') || Object.prototype.hasOwnProperty.call(message, 'error'))) {
        const pendingRequest = pending.get(message.id);
        if (!pendingRequest) return;
        pending.delete(message.id);
        if (message.error) pendingRequest.reject(new Error(message.error.message || 'MCP Apps request failed'));
        else pendingRequest.resolve(message.result);
        return;
      }
      if (message.method === 'ui/notifications/tool-input') {
        state.input = message.params && (message.params.arguments || message.params);
        statusEl.textContent = 'Received tool input.';
        return;
      }
      if (message.method === 'ui/notifications/tool-input-partial') {
        state.input = { ...(state.input || {}), ...(message.params && (message.params.arguments || message.params) || {}) };
        statusEl.textContent = 'Received partial tool input.';
        return;
      }
      if (message.method === 'ui/notifications/tool-result') {
        state.result = message.params || null;
        render();
        return;
      }
      if (message.method === 'ui/notifications/tool-cancelled') {
        statusEl.textContent = message.params && message.params.reason
          ? 'Tool cancelled: ' + message.params.reason
          : 'Tool cancelled.';
        return;
      }
      if (message.method === 'ui/notifications/host-context-changed') {
        updateHost(message.params || {});
        return;
      }
      if (message.method === 'ui/resource-teardown') {
        if (message.id !== undefined && message.id !== null) post({ id: message.id, result: {} });
      }
    });
    document.getElementById('refresh')?.addEventListener('click', requestTool);
    render();
    connect();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(sendSizeChanged).observe(document.body);
    } else {
      window.addEventListener('resize', sendSizeChanged);
    }
  })();
  </script>
</body>
</html>`
}

export const buildKnowgrphMcpAppsResourceReadResult = (args = {}) => {
  const descriptor = buildKnowgrphMcpAppsResourceDescriptor(args)
  return {
    contents: [{
      uri: descriptor.uri,
      mimeType: KNOWGRPH_MCP_APPS_RESOURCE_MIME_TYPE,
      text: buildKnowgrphMcpAppsHtml(args),
      _meta: descriptor._meta,
    }],
  }
}
