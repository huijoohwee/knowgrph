import {
  buildKnowgrphAgentReadyToolContracts,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
} from "../../canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs";

const SITE_ORIGIN = "https://airvio.co";
const APP_BASE_PATH = "/knowgrph";
const APP_URL = `${SITE_ORIGIN}${APP_BASE_PATH}/`;
const ROOT_URL = `${SITE_ORIGIN}/`;
const DEFAULT_WORKSPACE_ID = "kgws:canonical-docs";
const UPDATED_AT = "2026-05-21";
const HEALTH_PATH = `${APP_BASE_PATH}/health`;
const HEALTH_URL = `${SITE_ORIGIN}${HEALTH_PATH}`;
const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";
const APP_A2A_AGENT_CARD_PATH = `${APP_BASE_PATH}/.well-known/agent-card.json`;
const A2A_AGENT_CARD_URL = `${SITE_ORIGIN}${A2A_AGENT_CARD_PATH}`;
const STORAGE_SOURCE_FILES_URL = `${SITE_ORIGIN}/api/storage/source-files`;
const STORAGE_DEFAULT_DOC_PATTERN = `${SITE_ORIGIN}/api/storage/doc-default/{canonicalPath}`;
const STORAGE_WORKSPACE_DOC_PATTERN = `${SITE_ORIGIN}/api/storage/doc/{workspaceId}/{canonicalPath}`;
const AGENT_READY_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
});

const buildStorageDocPath = (canonicalPath, workspaceId = "") => {
  const normalizedCanonicalPath = String(canonicalPath || "").trim();
  const normalizedWorkspaceId = String(workspaceId || "").trim();
  return normalizedWorkspaceId
    ? `/api/storage/doc/${encodeURIComponent(normalizedWorkspaceId)}/${encodeURIComponent(normalizedCanonicalPath)}`
    : `/api/storage/doc-default/${encodeURIComponent(normalizedCanonicalPath)}`;
};

const normalizeToolString = (value) => String(value || "").trim();

export const agentReadyHomepageLinkHeaderValue = [
  `</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `<${APP_BASE_PATH}/.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  `<${APP_BASE_PATH}/llms.txt>; rel="service-doc"; type="text/plain"`,
  `<${HEALTH_PATH}>; rel="status"; type="application/health+json"`,
  `<${APP_BASE_PATH}/.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`,
  `<${A2A_AGENT_CARD_PATH}>; rel="describedby"; type="application/json"`,
].join(", ");

const jsonResponse = (body, contentType = "application/json; charset=utf-8") =>
  new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });

const jsonStatusResponse = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

const textResponse = (body, contentType) =>
  new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });

const markdownResponse = (body) =>
  new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
      "vary": "Accept",
      "x-markdown-tokens": String(Math.ceil(String(body || "").length / 4)),
    },
  });

const healthResponse = (body) =>
  new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/health+json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });

const buildRobotsTxt = (sitemapUrl) => `User-agent: *
Allow: /knowgrph/
Disallow: /api/payments/

User-agent: GPTBot
Allow: /knowgrph/
Disallow: /api/payments/

User-agent: Claude-Web
Allow: /knowgrph/
Disallow: /api/payments/

User-agent: Google-Extended
Allow: /knowgrph/
Disallow: /api/payments/

User-agent: OAI-SearchBot
Allow: /knowgrph/
Disallow: /api/payments/

Content-Signal: ai-train=no, search=yes, ai-input=yes
Sitemap: ${sitemapUrl}
`;

const buildSitemapXml = (baseUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${APP_URL}</loc>
    <lastmod>${UPDATED_AT}</lastmod>
  </url>
  <url>
    <loc>${APP_URL}llms.txt</loc>
    <lastmod>${UPDATED_AT}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}.well-known/mcp/server-card.json</loc>
    <lastmod>${UPDATED_AT}</lastmod>
  </url>
</urlset>
`;

const robotsTxt = buildRobotsTxt(`${APP_URL}sitemap.xml`);
const sitemapXml = buildSitemapXml(APP_URL);

const markdownForAgents = `# Knowgrph

Knowgrph is an agent-readable knowledge graph workspace served at ${APP_URL}.

## Discovery

- Crawl policy: ${APP_URL}robots.txt
- Sitemap: ${APP_URL}sitemap.xml
- API catalog: ${APP_URL}.well-known/api-catalog
- Health: ${HEALTH_URL}
- MCP server card: ${APP_URL}.well-known/mcp/server-card.json
- A2A Agent Card: ${A2A_AGENT_CARD_URL}
- Agent skills: ${APP_URL}.well-known/agent-skills/index.json
- LLM reference: ${APP_URL}llms.txt

## APIs

- Agent-ready status: ${HEALTH_URL}
- HTTP MCP: ${APP_URL}mcp
- Storage API: ${SITE_ORIGIN}/api/storage/
- Source Files index: ${STORAGE_SOURCE_FILES_URL}
- Default Source File documents: ${STORAGE_DEFAULT_DOC_PATTERN}
- Workspace Source File documents: ${STORAGE_WORKSPACE_DOC_PATTERN}
`;

const apiCatalog = {
  linkset: [
    {
      anchor: APP_URL,
      "service-desc": [
        {
          href: `${APP_URL}.well-known/openapi.json`,
          type: "application/vnd.oai.openapi+json;version=3.1",
        },
      ],
      "service-doc": [
        {
          href: `${APP_URL}llms.txt`,
          type: "text/plain",
        },
      ],
      status: [
        {
          href: HEALTH_URL,
          type: "application/health+json",
        },
      ],
      "service-meta": [
        {
          href: `${APP_URL}.well-known/mcp/server-card.json`,
          type: "application/json",
        },
        {
          href: A2A_AGENT_CARD_URL,
          type: "application/json",
        },
      ],
    },
  ],
};

const openApi = {
  openapi: "3.1.0",
  info: {
    title: "Knowgrph API",
    version: "0.1.0",
    description: "Agent discovery surface for the Knowgrph Cloudflare deployment.",
  },
  servers: [
    { url: SITE_ORIGIN, description: "Knowgrph Cloudflare deployment" },
  ],
  paths: {
    [HEALTH_PATH]: {
      get: {
        summary: "Read the Knowgrph agent-ready health status",
        responses: {
          "200": { description: "Health status in application/health+json format" },
        },
      },
    },
    [`${APP_BASE_PATH}/mcp`]: {
      get: {
        summary: "Read MCP transport metadata",
        responses: {
          "200": { description: "MCP transport metadata" },
        },
      },
      post: {
        summary: "Send a JSON-RPC MCP request",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": { description: "JSON-RPC result payload" },
        },
      },
    },
    [APP_A2A_AGENT_CARD_PATH]: {
      get: {
        summary: "Read the Knowgrph A2A Agent Card",
        responses: {
          "200": { description: "A2A Agent Card JSON" },
        },
      },
    },
    "/api/storage/llms.txt": {
      get: {
        summary: "Read the Source Files LLM index",
        responses: {
          "200": { description: "Plain-text LLM index" },
        },
      },
    },
    "/api/storage/source-files": {
      get: {
        summary: "List published Source Files",
        responses: {
          "200": { description: "Source Files index" },
        },
      },
    },
    "/api/storage/doc-default/{canonicalPath}": {
      get: {
        summary: "Read a default-workspace Source File markdown document",
        parameters: [
          { name: "canonicalPath", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Markdown document from the default Editor Workspace" },
          "404": { description: "Document not found" },
        },
      },
    },
    "/api/storage/doc/{workspaceId}/{canonicalPath}": {
      get: {
        summary: "Read a Source File markdown document",
        parameters: [
          { name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
          { name: "canonicalPath", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Markdown document" },
          "404": { description: "Document not found" },
        },
      },
    },
  },
};

const oauthProtectedResource = {
  resource: APP_URL,
  authorization_servers: [`${SITE_ORIGIN}/cdn-cgi/access`],
  scopes_supported: ["knowgrph:read", "knowgrph:source-files:read"],
  bearer_methods_supported: ["header"],
  resource_documentation: `${APP_URL}llms.txt`,
};

const oauthAuthorizationServer = {
  issuer: `${SITE_ORIGIN}/cdn-cgi/access`,
  authorization_endpoint: `${SITE_ORIGIN}/cdn-cgi/access/login`,
  token_endpoint: `${SITE_ORIGIN}/cdn-cgi/access/token`,
  jwks_uri: `${APP_URL}.well-known/http-message-signatures-directory`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "client_credentials"],
  token_endpoint_auth_methods_supported: ["client_secret_basic", "private_key_jwt"],
  scopes_supported: oauthProtectedResource.scopes_supported,
};

const a2aAgentCard = {
  name: "Knowgrph Agent",
  description: "Agent-readable discovery and published source-file retrieval surface for Knowgrph.",
  version: "0.1.0",
  provider: {
    organization: "airvio / joohwee",
    url: APP_URL,
  },
  url: `${APP_URL}mcp`,
  preferredTransport: "JSONRPC",
  supportedInterfaces: [
    {
      url: `${APP_URL}mcp`,
      protocolBinding: "JSONRPC",
      transportProtocol: "JSONRPC",
      description: "Primary machine interface for read-only discovery and source-file document access.",
    },
    {
      url: STORAGE_SOURCE_FILES_URL,
      protocolBinding: "HTTP+JSON/REST",
      transportProtocol: "HTTP+JSON/REST",
      description: "Published source-files index and storage-backed document read surface.",
    },
  ],
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
    extendedAgentCard: false,
  },
  defaultInputModes: [
    "text/plain",
    "text/markdown",
    "application/json",
  ],
  defaultOutputModes: [
    "text/plain",
    "text/markdown",
    "application/json",
  ],
  skills: [
    {
      id: "discover-source-files",
      name: "Discover Source Files",
      description: "Lists published Knowgrph Source Files for downstream agent navigation and retrieval.",
      tags: ["discovery", "source-files", "markdown"],
      examples: ["List the published Knowgrph source files."],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["text/markdown", "application/json"],
    },
    {
      id: "read-source-file",
      name: "Read Source File",
      description: "Reads published Knowgrph markdown documents from the default or explicit workspace.",
      tags: ["read", "markdown", "workspace"],
      examples: ["Read the published source file for docs/getting-started.md."],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["text/markdown", "application/json"],
    },
    {
      id: "inspect-agent-surface",
      name: "Inspect Agent Surface",
      description: "Provides machine-readable discovery for health, MCP, OpenAPI, and related service metadata.",
      tags: ["agent-ready", "discovery", "metadata"],
      examples: ["Show the Knowgrph agent discovery metadata."],
      inputModes: ["application/json", "text/plain"],
      outputModes: ["application/json", "text/markdown"],
    },
  ],
};

const mcpServerCard = {
  serverInfo: {
    name: "knowgrph",
    version: "0.1.0",
  },
  transport: {
    type: "http",
    url: `${APP_URL}mcp`,
  },
  capabilities: {
    tools: AGENT_READY_TOOL_CONTRACTS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  },
  links: {
    apiCatalog: `${APP_URL}.well-known/api-catalog`,
    skills: `${APP_URL}.well-known/agent-skills/index.json`,
    status: HEALTH_URL,
    agentCard: A2A_AGENT_CARD_URL,
  },
};

const webMcpTools = AGENT_READY_TOOL_CONTRACTS.map((tool) => ({
  name: tool.webName,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.inputSchema,
  annotations: tool.annotations,
}));

const webMcpScript = `(() => {
  const root = globalThis;
  const nav = root.navigator || {};
  const siteOrigin = ${JSON.stringify(SITE_ORIGIN)};
  const defaultWorkspaceId = ${JSON.stringify(DEFAULT_WORKSPACE_ID)};
  const buildDocPath = (canonicalPath, workspaceId = "") => {
    const normalizedCanonicalPath = String(canonicalPath || "").trim();
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    return normalizedWorkspaceId
      ? \`/api/storage/doc/\${encodeURIComponent(normalizedWorkspaceId)}/\${encodeURIComponent(normalizedCanonicalPath)}\`
      : \`/api/storage/doc-default/\${encodeURIComponent(normalizedCanonicalPath)}\`;
  };
  if (!root.navigator) {
    try {
      Object.defineProperty(root, "navigator", { configurable: true, value: nav });
    } catch {
      root.navigator = nav;
    }
  }
  const tools = [
    {
      name: ${JSON.stringify(webMcpTools[0].name)},
      title: ${JSON.stringify(webMcpTools[0].title)},
      description: ${JSON.stringify(webMcpTools[0].description)},
      inputSchema: ${JSON.stringify(webMcpTools[0].inputSchema)},
      annotations: ${JSON.stringify(webMcpTools[0].annotations)},
      execute: async () => {
        const response = await fetch(\`\${siteOrigin}/api/storage/source-files\`, { headers: { accept: "text/markdown" } });
        if (!response.ok) throw new Error(\`list_source_files failed with \${response.status}\`);
        return {
          workspaceId: defaultWorkspaceId,
          markdownIndex: await response.text(),
        };
      }
    },
    {
      name: ${JSON.stringify(webMcpTools[1].name)},
      title: ${JSON.stringify(webMcpTools[1].title)},
      description: ${JSON.stringify(webMcpTools[1].description)},
      inputSchema: ${JSON.stringify(webMcpTools[1].inputSchema)},
      annotations: ${JSON.stringify(webMcpTools[1].annotations)},
      execute: async (input = {}) => {
        const canonicalPath = String(input.canonicalPath || "").trim();
        if (!canonicalPath) throw new Error("canonicalPath is required");
        const workspaceId = String(input.workspaceId || "").trim();
        const response = await fetch(\`\${siteOrigin}\${buildDocPath(canonicalPath, workspaceId)}\`, { headers: { accept: "text/markdown" } });
        if (!response.ok) throw new Error(\`read_source_file failed with \${response.status}\`);
        return {
          workspaceId: workspaceId || defaultWorkspaceId,
          canonicalPath,
          markdown: await response.text(),
        };
      }
    }
  ];
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.kgWebmcpTools = tools.map((tool) => tool.name).join(",");
    document.documentElement.dataset.kgWebmcpContext = tools.map((tool) => tool.name).join(",");
  }
  const existing = nav.modelContext;
  let installed = false;
  if (existing && typeof existing.provideContext === "function") {
    existing.provideContext({ tools });
    installed = true;
  }
  if (existing && typeof existing.registerTool === "function") {
    for (const tool of tools) {
      try {
        existing.registerTool(tool);
        installed = true;
      } catch {
        installed = true;
      }
    }
  }
  if (existing && Array.isArray(existing.tools)) {
    for (const tool of tools) {
      if (!existing.tools.some((entry) => entry && entry.name === tool.name)) existing.tools.push(tool);
    }
    installed = true;
  }
  if (installed) {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.kgWebmcpContext = "installed";
    }
    return;
  }
  const fallback = { tools };
  try {
    Object.defineProperty(nav, "modelContext", {
      configurable: true,
      enumerable: false,
      value: fallback,
      writable: true
    });
  } catch {
    nav.modelContext = fallback;
  }
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.kgWebmcpContext = nav.modelContext && Array.isArray(nav.modelContext.tools) ? "fallback-readable" : "fallback-defined";
  }
})();`;

const injectWebMcpScript = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;
  const html = await response.text();
  if (html.includes("knowgrph.list_source_files") && html.includes("knowgrph.read_source_file")) return new Response(html, response);
  const scriptTag = `<script>${webMcpScript}</script>`;
  const nextHtml = html.includes("</head>") ? html.replace("</head>", `${scriptTag}</head>`) : `${html}${scriptTag}`;
  const nextResponse = new Response(nextHtml, response);
  nextResponse.headers.delete("content-length");
  return nextResponse;
};

const skillMarkdown = `# Knowgrph Source Files Skill

Use this skill when an agent needs to discover and read published Knowgrph Source Files from the Cloudflare storage API.

## Tools

- list_source_files: fetch ${SITE_ORIGIN}/api/storage/source-files.
- read_source_file: fetch ${SITE_ORIGIN}/api/storage/doc-default/{canonicalPath} by default, or ${SITE_ORIGIN}/api/storage/doc/{workspaceId}/{canonicalPath} for an explicit workspace.
`;

const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const skillMarkdownSha256 = sha256Hex(skillMarkdown);

const agentSkillsIndex = async () => ({
  $schema: "https://agent-skills.dev/schemas/skills-index.v0.2.json",
  updated_at: UPDATED_AT,
  skills: [
    {
      name: "knowgrph-source-files",
      type: "markdown",
      description: "Discover and read published Knowgrph Source Files.",
      url: `${APP_URL}.well-known/agent-skills/knowgrph-source-files.md`,
      sha256: await skillMarkdownSha256,
    },
  ],
});

const httpMessageSignaturesDirectory = {
  keys: [
    {
      kty: "OKP",
      crv: "Ed25519",
      kid: "knowgrph-agent-ready-2026-05-21",
      use: "sig",
      alg: "EdDSA",
      x: "11qYAYdkVKxA4G0wV47IxPtYfFVH_H7zmC2Di2PcvLU",
    },
  ],
};

const mcpInitializeResult = {
  protocolVersion: "2025-06-18",
  capabilities: {
    tools: {},
  },
  serverInfo: mcpServerCard.serverInfo,
};

const mcpTools = mcpServerCard.capabilities.tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
}));

const buildHealthStatusBody = () => ({
  status: "pass",
  service: "knowgrph-agent-ready-pages",
  homepage: APP_URL,
  health: HEALTH_URL,
  updatedAt: UPDATED_AT,
  checks: {
    linkHeaders: true,
    markdownNegotiation: true,
    httpMcp: true,
    webMcp: true,
    defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
  },
});

const readJsonRpcRequest = async (request) => {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
};

const jsonRpcResult = (id, result) => jsonResponse({
  jsonrpc: "2.0",
  id: id ?? null,
  result,
});

const jsonRpcError = (id, code, message) => jsonResponse({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

const executeMcpTool = async (name, args) => {
  switch (name) {
    case KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles: {
      const response = await fetch(STORAGE_SOURCE_FILES_URL, {
        headers: { accept: "text/markdown" },
      });
      if (!response.ok) throw new Error(`list_source_files upstream failed with ${response.status}`);
      return {
        workspaceId: DEFAULT_WORKSPACE_ID,
        markdownIndex: await response.text(),
      };
    }
    case KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile: {
      const canonicalPath = normalizeToolString(args?.canonicalPath);
      if (!canonicalPath) throw new Error("canonicalPath is required");
      const workspaceId = normalizeToolString(args?.workspaceId);
      const response = await fetch(`${SITE_ORIGIN}${buildStorageDocPath(canonicalPath, workspaceId)}`, {
        headers: { accept: "text/markdown" },
      });
      if (!response.ok) throw new Error(`read_source_file upstream failed with ${response.status}`);
      return {
        workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
        canonicalPath,
        markdown: await response.text(),
      };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
};

const handleMcpTransport = async (request) => {
  const method = String(request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return jsonResponse({
      ok: true,
      transport: mcpServerCard.transport,
      serverInfo: mcpServerCard.serverInfo,
      capabilities: mcpServerCard.capabilities,
    });
  }
  if (method !== "POST") return jsonStatusResponse(405, { ok: false, error: "unsupported_method" });
  const rpc = await readJsonRpcRequest(request);
  if (!rpc) return jsonRpcError(null, -32700, "Parse error");
  switch (rpc.method) {
    case "initialize":
      return jsonRpcResult(rpc.id, mcpInitializeResult);
    case "tools/list":
      return jsonRpcResult(rpc.id, { tools: mcpTools });
    case "tools/call": {
      const toolName = normalizeToolString(rpc.params?.name);
      const toolArgs = rpc.params?.arguments && typeof rpc.params.arguments === "object" ? rpc.params.arguments : {};
      if (!toolName) return jsonRpcError(rpc.id, -32602, "Tool name is required");
      try {
        const result = await executeMcpTool(toolName, toolArgs);
        return jsonRpcResult(rpc.id, {
          content: [
            {
              type: "text",
              text: typeof result?.markdown === "string"
                ? result.markdown
                : JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
          isError: false,
        });
      } catch (error) {
        return jsonRpcResult(rpc.id, {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        });
      }
    }
    default:
      return jsonRpcError(rpc.id, -32601, "Method not found");
  }
};

export const buildAgentReadyStaticFiles = async () => ({
  "robots.txt": {
    contentType: "text/plain; charset=utf-8",
    body: buildRobotsTxt(`${ROOT_URL}sitemap.xml`),
  },
  "sitemap.xml": {
    contentType: "application/xml; charset=utf-8",
    body: buildSitemapXml(ROOT_URL),
  },
  ".well-known/api-catalog": {
    contentType: "application/linkset+json; charset=utf-8",
    body: JSON.stringify(apiCatalog, null, 2),
  },
  ".well-known/openapi.json": {
    contentType: "application/vnd.oai.openapi+json; charset=utf-8",
    body: JSON.stringify(openApi, null, 2),
  },
  ".well-known/agent-card.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(a2aAgentCard, null, 2),
  },
  ".well-known/oauth-protected-resource": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(oauthProtectedResource, null, 2),
  },
  ".well-known/oauth-authorization-server": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(oauthAuthorizationServer, null, 2),
  },
  ".well-known/openid-configuration": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(oauthAuthorizationServer, null, 2),
  },
  ".well-known/mcp/server-card.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(mcpServerCard, null, 2),
  },
  ".well-known/mcp.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(mcpServerCard, null, 2),
  },
  ".well-known/agent-skills/index.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(await agentSkillsIndex(), null, 2),
  },
  ".well-known/agent-skills/knowgrph-source-files.md": {
    contentType: "text/markdown; charset=utf-8",
    body: skillMarkdown,
  },
  ".well-known/http-message-signatures-directory": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(httpMessageSignaturesDirectory, null, 2),
  },
});

const handlesKnowgrphRoot = (pathname) => pathname === APP_BASE_PATH || pathname === `${APP_BASE_PATH}/`;

const wantsMarkdown = (request) => {
  const accept = request.headers.get("accept") || "";
  return accept.toLowerCase().split(",").some((part) => part.trim().startsWith("text/markdown"));
};

const routeResponse = async (request) => {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (handlesKnowgrphRoot(url.pathname) && wantsMarkdown(request)) {
    return markdownResponse(markdownForAgents);
  }

  switch (pathname) {
    case HEALTH_PATH:
      return healthResponse(buildHealthStatusBody());
    case `${APP_BASE_PATH}/mcp`:
      return handleMcpTransport(request);
    case `${APP_BASE_PATH}/robots.txt`:
      return textResponse(robotsTxt, "text/plain; charset=utf-8");
    case `${APP_BASE_PATH}/sitemap.xml`:
      return textResponse(sitemapXml, "application/xml; charset=utf-8");
    case `${APP_BASE_PATH}/.well-known/api-catalog`:
      return jsonResponse(apiCatalog, "application/linkset+json; charset=utf-8");
    case `${APP_BASE_PATH}/.well-known/openapi.json`:
      return jsonResponse(openApi, "application/vnd.oai.openapi+json; charset=utf-8");
    case APP_A2A_AGENT_CARD_PATH:
      return jsonResponse(a2aAgentCard);
    case `${APP_BASE_PATH}/.well-known/oauth-protected-resource`:
      return jsonResponse(oauthProtectedResource);
    case `${APP_BASE_PATH}/.well-known/oauth-authorization-server`:
      return jsonResponse(oauthAuthorizationServer);
    case `${APP_BASE_PATH}/.well-known/openid-configuration`:
      return jsonResponse(oauthAuthorizationServer);
    case `${APP_BASE_PATH}/.well-known/mcp/server-card.json`:
      return jsonResponse(mcpServerCard);
    case `${APP_BASE_PATH}/.well-known/mcp.json`:
      return jsonResponse(mcpServerCard);
    case `${APP_BASE_PATH}/.well-known/agent-skills/index.json`:
      return jsonResponse(await agentSkillsIndex());
    case `${APP_BASE_PATH}/.well-known/agent-skills/knowgrph-source-files.md`:
      return textResponse(skillMarkdown, "text/markdown; charset=utf-8");
    case `${APP_BASE_PATH}/.well-known/http-message-signatures-directory`:
      return jsonResponse(httpMessageSignaturesDirectory);
    default:
      return null;
  }
};

export async function onRequest(context) {
  const { request } = context;
  const method = String(request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "*",
        "access-control-max-age": "86400",
      },
    });
  }

  if (method === "POST" && new URL(request.url).pathname.replace(/\/+$/, "") === `${APP_BASE_PATH}/mcp`) {
    return routeResponse(request);
  }

  if (method !== "GET" && method !== "HEAD") {
    return jsonStatusResponse(405, { ok: false, error: "unsupported_method" });
  }

  const routed = await routeResponse(request);
  if (routed) {
    if (method === "HEAD") return new Response(null, routed);
    return routed;
  }

  const response = await context.next();
  if (!handlesKnowgrphRoot(new URL(request.url).pathname)) return response;
  const htmlResponse = method === "HEAD" ? response : await injectWebMcpScript(response);
  const nextResponse = new Response(method === "HEAD" ? null : htmlResponse.body, htmlResponse);
  nextResponse.headers.set("link", agentReadyHomepageLinkHeaderValue);
  return nextResponse;
}
