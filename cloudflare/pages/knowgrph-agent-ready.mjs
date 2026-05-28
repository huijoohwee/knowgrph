import {
  buildKnowgrphAgentReadyToolContracts,
  KNOWGRPH_AGENT_READY_TOOL_IDS,
} from "../../canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs";
import {
  buildAgentSurfaceInspectionPayload,
  createAgentSurfaceInspectionExecutor,
} from "../../canvas/src/features/agent-ready/agentSurfaceInspection.mjs";
import { createPublishedAgentReadyToolExecutors } from "../../canvas/src/features/agent-ready/publishedToolExecutors.mjs";
import { inspectSharedDocumentStructure } from "../../canvas/src/features/agent-ready/sharedDocumentStructureInspection.mjs";
import {
  AGENT_READY_AGENT_SKILL_DEFINITIONS,
  buildAgentReadyA2aSkills,
  buildAgentReadyAgentSkillsIndex,
  buildAgentReadyOpenApiPaths,
} from "./knowgrph-agent-ready-discovery.mjs";
import {
  PUBLISHED_DOC_IDENTITY_RESOLVER_BROWSER_SOURCE,
  createPublishedDocIdentityResolver,
  resolvePublishedDocIdentity,
} from "../../canvas/src/features/canvas/canvasDocShareToken.mjs";
import {
  buildKnowgrphStorageDefaultDocPath,
  buildKnowgrphStorageDocPath,
  buildKnowgrphStorageSourceFilesIndexPath,
} from "../../canvas/src/lib/storage/knowgrphStorageSyncContract.ts";
import {
  A2A_AGENT_CARD_PATH,
  A2A_AGENT_CARD_URL,
  agentReadyMarkdownBody,
  APP_A2A_AGENT_CARD_PATH,
  APP_BASE_PATH,
  APP_URL,
  DEFAULT_WORKSPACE_ID,
  HEALTH_PATH,
  HEALTH_URL,
  KNOWGRPH_AGENT_READY_ROUTE_OWNER,
  markdownResponse,
  ROOT_URL,
  SITE_ORIGIN,
  STORAGE_FETCH_ORIGIN,
  STORAGE_DEFAULT_DOC_PATTERN,
  STORAGE_SOURCE_FILES_URL,
  STORAGE_WORKSPACE_DOC_PATTERN,
  UPDATED_AT,
  withAgentReadyRouteHeaders,
  wantsMarkdown,
} from "./knowgrph-agent-ready-shared.mjs";
const AGENT_READY_TOOL_CONTRACTS = buildKnowgrphAgentReadyToolContracts({
  defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
});
const buildStorageDocPath = (canonicalPath, workspaceId = "") => {
  const normalizedCanonicalPath = String(canonicalPath || "").trim();
  const normalizedWorkspaceId = String(workspaceId || "").trim();
  return normalizedWorkspaceId
    ? buildKnowgrphStorageDocPath(normalizedWorkspaceId, normalizedCanonicalPath)
    : buildKnowgrphStorageDefaultDocPath(normalizedCanonicalPath);
};
const normalizeToolString = (value) => String(value || "").trim();
export const agentReadyHomepageLinkHeaderValue = [
  `</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `<${APP_BASE_PATH}/.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  `<${APP_BASE_PATH}/llms.txt>; rel="service-doc"; type="text/plain"`,
  `</auth.md>; rel="service-doc"; type="text/markdown"`,
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
  paths: buildAgentReadyOpenApiPaths({
    appBasePath: APP_BASE_PATH,
    appA2aAgentCardPath: APP_A2A_AGENT_CARD_PATH,
    healthPath: HEALTH_PATH,
  }),
};

const oauthProtectedResource = {
  resource: APP_URL,
  authorization_servers: [`${SITE_ORIGIN}/cdn-cgi/access`],
  scopes_supported: ["knowgrph:read", "knowgrph:source-files:read"],
  bearer_methods_supported: ["header"],
  resource_documentation: `${APP_URL}llms.txt`,
};
const agentAuthMetadata = { skill: `${SITE_ORIGIN}/auth.md`, register_uri: `${APP_URL}agent/auth`, claim_uri: `${APP_URL}agent/auth/claim`, revocation_uri: `${APP_URL}agent/auth/revoke`, identity_types_supported: ["anonymous", "identity_assertion"], anonymous: { credential_types_supported: ["api_key"] }, identity_assertion: { assertion_types_supported: ["urn:ietf:params:oauth:token-type:id-jag", "verified_email"], credential_types_supported: ["access_token", "api_key"] }, events_supported: ["https://schemas.workos.com/events/agent/auth/identity/assertion/revoked"], registration_status: "metadata_published_runtime_user_mediated" };
const oauthAuthorizationServer = {
  issuer: `${SITE_ORIGIN}/cdn-cgi/access`,
  authorization_endpoint: `${SITE_ORIGIN}/cdn-cgi/access/login`,
  token_endpoint: `${SITE_ORIGIN}/cdn-cgi/access/token`,
  jwks_uri: `${APP_URL}.well-known/http-message-signatures-directory`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "client_credentials"],
  token_endpoint_auth_methods_supported: ["client_secret_basic", "private_key_jwt"],
  scopes_supported: oauthProtectedResource.scopes_supported,
  agent_auth: agentAuthMetadata,
};
const authMd = `# Knowgrph auth.md\n\nKnowgrph publishes agent registration metadata for the read-only agent surface at ${APP_URL}. Agents should first fetch ${SITE_ORIGIN}/.well-known/oauth-protected-resource, then ${SITE_ORIGIN}/.well-known/oauth-authorization-server, and read the agent_auth block.\n\n## Registration\n\n- Register: ${agentAuthMetadata.register_uri}\n- Claim: ${agentAuthMetadata.claim_uri}\n- Revoke: ${agentAuthMetadata.revocation_uri}\n- Supported identity types: ${agentAuthMetadata.identity_types_supported.join(", ")}\n- Credential types: api_key, access_token\n- Current runtime policy: user-mediated access through the existing Cloudflare Access/OAuth boundary; no separate MCP-only auth stack.\n- Pipeline rule: agents must not bypass MainPanel -> FloatingPanel Chat -> KGC -> Canvas for user-mediated graph work; published HTTP MCP tools remain read-only until mutation auth and conflict semantics are implemented.`;

const a2aAgentCard = {
  name: "Knowgrph Agent",
  description: "Agent-readable discovery, published-document retrieval, and WebMCP-ready metadata surface for Knowgrph.",
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
  skills: buildAgentReadyA2aSkills(AGENT_READY_TOOL_CONTRACTS),
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
const findWebMcpToolName = (toolId) =>
  normalizeToolString(AGENT_READY_TOOL_CONTRACTS.find((tool) => tool.name === toolId)?.webName);
const LIST_SOURCE_FILES_WEB_TOOL_NAME = findWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles);
const READ_SOURCE_FILE_WEB_TOOL_NAME = findWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile);
const READ_SHARED_DOCUMENT_WEB_TOOL_NAME = findWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument);
const INSPECT_SHARED_DOCUMENT_STRUCTURE_WEB_TOOL_NAME = findWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure);
const INSPECT_AGENT_SURFACE_WEB_TOOL_NAME = findWebMcpToolName(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface);

export const webMcpScript = `(() => {
  const root = globalThis;
  const siteOrigin = ${JSON.stringify(SITE_ORIGIN)};
  const appBasePath = ${JSON.stringify(APP_BASE_PATH)};
  const defaultWorkspaceId = ${JSON.stringify(DEFAULT_WORKSPACE_ID)};
  const toolDefinitions = ${JSON.stringify(webMcpTools)};
  const toolNames = ${JSON.stringify(webMcpTools.map((tool) => tool.name))};
  const lateBindingRetryDelayMs = 500;
  const lateBindingMaxAttempts = 20;
  const inspectSharedDocumentStructure = (args = {}) => {
    const normalizeString = (value) => String(value || "").trim();
    const normalizeMarkdown = (value) => String(value || "").replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");
    const readIndent = (line) => {
      const match = String(line || "").match(/^\\s*/);
      return match ? match[0].length : 0;
    };
    const isYamlKeyLine = (line) => /^[A-Za-z0-9_:@-]+\\s*:/.test(normalizeString(line));
    const splitLines = (text) => normalizeMarkdown(text).split("\\n");
    const extractLeadingFrontmatter = (markdown) => {
      const lines = splitLines(markdown);
      let start = 0;
      while (start < lines.length && !normalizeString(lines[start])) start += 1;
      if (normalizeString(lines[start]) !== "---") return null;
      for (let i = start + 1; i < lines.length; i += 1) {
        if (normalizeString(lines[i]) !== "---") continue;
        return {
          frontmatter: lines.slice(start + 1, i).join("\\n"),
          body: lines.slice(i + 1).join("\\n"),
        };
      }
      return null;
    };
    const extractTopLevelFrontmatterKeys = (frontmatter) => {
      const keys = [];
      for (const line of splitLines(frontmatter)) {
        if (!normalizeString(line) || readIndent(line) !== 0) continue;
        const match = line.match(/^([A-Za-z0-9_:@-]+)\\s*:/);
        if (!match || !match[1]) continue;
        keys.push(match[1]);
      }
      return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
    };
    const extractYamlBlock = (text, key) => {
      const lines = splitLines(text);
      const expectedPrefix = key + ":";
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const trimmed = normalizeString(line);
        if (!trimmed.startsWith(expectedPrefix)) continue;
        const indent = readIndent(line);
        const inlineValue = trimmed.slice(expectedPrefix.length).trim();
        if (inlineValue) {
          return { indent, inlineValue, blockLines: [], blockText: "" };
        }
        const blockLines = [];
        for (let j = i + 1; j < lines.length; j += 1) {
          const nextLine = lines[j];
          const nextTrimmed = normalizeString(nextLine);
          const nextIndent = readIndent(nextLine);
          if (nextTrimmed && nextIndent <= indent && isYamlKeyLine(nextLine)) break;
          blockLines.push(nextLine);
        }
        return {
          indent,
          inlineValue: "",
          blockLines,
          blockText: blockLines.join("\\n"),
        };
      }
      return null;
    };
    const extractNestedYamlKeys = (blockText) => {
      const keys = [];
      for (const line of splitLines(blockText)) {
        const trimmed = normalizeString(line);
        if (!trimmed || trimmed.startsWith("- ")) continue;
        const match = trimmed.match(/^([A-Za-z0-9_:@-]+)\\s*:/);
        if (!match || !match[1]) continue;
        keys.push(match[1]);
      }
      return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
    };
    const countInlineSequenceEntries = (inlineValue) => {
      const trimmed = normalizeString(inlineValue);
      if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return 0;
      return inner.split(",").map((part) => normalizeString(part)).filter(Boolean).length;
    };
    const countYamlSequenceEntries = (text, key) => {
      const block = extractYamlBlock(text, key);
      if (!block) return null;
      if (block.inlineValue) return countInlineSequenceEntries(block.inlineValue);
      let count = 0;
      for (const line of block.blockLines) {
        if (!normalizeString(line)) continue;
        if (readIndent(line) <= block.indent) continue;
        if (/^\\s*-\\s+/.test(line)) count += 1;
      }
      return count;
    };
    const extractMarkdownHeadings = (body) => {
      const headings = [];
      for (const line of splitLines(body)) {
        const match = line.match(/^(#{1,6})\\s+(.+?)\\s*$/);
        if (!match || !match[2]) continue;
        headings.push({
          depth: match[1].length,
          text: normalizeString(match[2]),
        });
      }
      return headings;
    };
    const workspaceId = normalizeString(args.workspaceId);
    const canonicalPath = normalizeString(args.canonicalPath);
    const markdown = normalizeMarkdown(args.markdown);
    const parsed = extractLeadingFrontmatter(markdown);
    const topLevelKeys = parsed ? extractTopLevelFrontmatterKeys(parsed.frontmatter) : [];
    const flowBlock = parsed ? extractYamlBlock(parsed.frontmatter, "flow") : null;
    const flowKeys = flowBlock ? extractNestedYamlKeys(flowBlock.blockText) : [];
    const forbiddenGroupingAliasSet = new Set(["kg:subgraphs", "clusters", "groups", "layers"]);
    const forbiddenGroupingAliases = Array.from(new Set(topLevelKeys.concat(flowKeys).filter((key) => forbiddenGroupingAliasSet.has(key)))).sort((a, b) => a.localeCompare(b));
    const headings = extractMarkdownHeadings(parsed ? parsed.body : markdown);
    return {
      workspaceId,
      canonicalPath,
      markdownLength: markdown.length,
      lineCount: markdown ? splitLines(markdown).length : 0,
      hasFrontmatter: Boolean(parsed),
      topLevelKeys,
      hasFlowBlock: Boolean(flowBlock),
      flowKeys,
      flowNodeCount: flowBlock ? countYamlSequenceEntries(flowBlock.blockText, "nodes") : null,
      flowConnectionCount: flowBlock ? (countYamlSequenceEntries(flowBlock.blockText, "connections") ?? countYamlSequenceEntries(flowBlock.blockText, "edges")) : null,
      flowSubgraphCount: flowBlock ? countYamlSequenceEntries(flowBlock.blockText, "subgraphs") : null,
      forbiddenGroupingAliases,
      headingCount: headings.length,
      headings: headings.map((heading) => heading.text),
      bodyLength: normalizeString(parsed ? parsed.body : markdown).length,
    };
  };
  const fallbackState = {
    fallbackContext: null,
    activeRegisteredContext: null,
    registrations: new WeakMap(),
    lateBindingRetryId: null,
    lateBindingAttemptCount: 0,
  };
  const normalizeString = (value) => String(value || "").trim();
  const isLocalhostHost = (hostname) => {
    const normalized = normalizeString(hostname).toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "0.0.0.0";
  };
  const markWebMcpRuntime = (state = toolNames.join(",")) => {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.dataset.kgWebmcpTools = toolNames.join(",");
    document.documentElement.dataset.kgWebmcpContext = state;
  };
  const buildDocPath = (canonicalPath, workspaceId = "") => {
    const normalizedCanonicalPath = normalizeString(canonicalPath);
    const normalizedWorkspaceId = normalizeString(workspaceId);
    return normalizedWorkspaceId
      ? \`/api/storage/doc/\${encodeURIComponent(normalizedWorkspaceId)}/\${encodeURIComponent(normalizedCanonicalPath)}\`
      : \`/api/storage/doc-default/\${encodeURIComponent(normalizedCanonicalPath)}\`;
  };
  const createPublishedDocIdentityResolver = ${PUBLISHED_DOC_IDENTITY_RESOLVER_BROWSER_SOURCE};
  const resolvePublishedDocIdentity = createPublishedDocIdentityResolver({
    defaultAppBasePath: appBasePath,
  });
  const buildStorageRequestUrl = (path) => {
    const safePath = normalizeString(path);
    if (!safePath) return "";
    if (typeof window !== "undefined") {
      const hostname = normalizeString(window.location && window.location.hostname);
      if (isLocalhostHost(hostname) && safePath.startsWith("/api/storage/")) return safePath;
      const currentOrigin = normalizeString(window.location && window.location.origin);
      const baseUrl = currentOrigin || siteOrigin;
      return new URL(safePath, baseUrl.endsWith("/") ? baseUrl : \`\${baseUrl}/\`).toString();
    }
    return new URL(safePath, siteOrigin.endsWith("/") ? siteOrigin : \`\${siteOrigin}/\`).toString();
  };
  const resolveAgentReadyBaseUrl = () => {
    if (typeof window !== "undefined") {
      const currentOrigin = normalizeString(window.location && window.location.origin);
      if (currentOrigin) {
        return new URL(\`\${appBasePath}/\`, currentOrigin.endsWith("/") ? currentOrigin : \`\${currentOrigin}/\`)
          .toString()
          .replace(/\\/+$/, "");
      }
    }
    return new URL(\`\${appBasePath}/\`, siteOrigin.endsWith("/") ? siteOrigin : \`\${siteOrigin}/\`)
      .toString()
      .replace(/\\/+$/, "");
  };
  const fetchJson = async (url, accept = "application/json") => {
    const response = await fetch(url, {
      headers: { accept },
    });
    if (!response.ok) throw new Error(\`inspect_agent_surface failed with \${response.status} for \${url}\`);
    return response.json();
  };
  const buildAgentSurfaceInspectionPayload = (args = {}) => {
    const baseUrl = String(args.baseUrl || "").replace(/\\/+$/, "");
    return {
      baseUrl,
      healthUrl: baseUrl + "/health",
      mcpUrl: baseUrl + "/mcp",
      apiCatalogUrl: baseUrl + "/.well-known/api-catalog",
      openApiUrl: baseUrl + "/.well-known/openapi.json",
      mcpServerCardUrl: baseUrl + "/.well-known/mcp/server-card.json",
      agentCardUrl: baseUrl + "/.well-known/agent-card.json",
      agentSkillsUrl: baseUrl + "/.well-known/agent-skills/index.json",
      health: args.health,
      apiCatalog: args.apiCatalog,
      openApi: args.openApi,
      mcpServerCard: args.mcpServerCard,
      agentCard: args.agentCard,
      agentSkills: args.agentSkills,
    };
  };
  const createAgentSurfaceInspectionExecutor = (args = {}) => {
    const baseUrl = String(args.baseUrl || "").replace(/\\/+$/, "");
    const fetchJson = args.fetchJson;
    if (!baseUrl) {
      throw new Error("baseUrl is required");
    }
    if (typeof fetchJson !== "function") {
      throw new Error("fetchJson is required");
    }
    return async () => {
      const responses = await Promise.all([
        fetchJson(baseUrl + "/health", "application/health+json"),
        fetchJson(baseUrl + "/.well-known/api-catalog", "application/linkset+json"),
        fetchJson(baseUrl + "/.well-known/openapi.json", "application/json"),
        fetchJson(baseUrl + "/.well-known/mcp/server-card.json", "application/json"),
        fetchJson(baseUrl + "/.well-known/agent-card.json", "application/json"),
        fetchJson(baseUrl + "/.well-known/agent-skills/index.json", "application/json"),
      ]);
      return buildAgentSurfaceInspectionPayload({
        baseUrl,
        health: responses[0],
        apiCatalog: responses[1],
        openApi: responses[2],
        mcpServerCard: responses[3],
        agentCard: responses[4],
        agentSkills: responses[5],
      });
    };
  };
  const createPublishedAgentReadyToolExecutors = (args = {}) => {
    const toolNames = args.toolNames || {};
    const defaultWorkspaceId = String(args.defaultWorkspaceId || "").trim();
    const buildStorageDocPath = args.buildStorageDocPath;
    const fetchSourceFilesIndexResponse = args.fetchSourceFilesIndexResponse;
    const fetchStorageMarkdownResponse = args.fetchStorageMarkdownResponse;
    const resolveSharedDocumentInput = args.resolveSharedDocumentInput;
    const inspectSharedDocumentStructure = args.inspectSharedDocumentStructure;
    const buildAgentSurfaceInspection = args.buildAgentSurfaceInspection;
    const normalizeString = (value) => String(value || "").trim();
    if (typeof buildStorageDocPath !== "function") throw new Error("buildStorageDocPath is required");
    if (typeof fetchSourceFilesIndexResponse !== "function") throw new Error("fetchSourceFilesIndexResponse is required");
    if (typeof fetchStorageMarkdownResponse !== "function") throw new Error("fetchStorageMarkdownResponse is required");
    if (typeof resolveSharedDocumentInput !== "function") throw new Error("resolveSharedDocumentInput is required");
    if (typeof inspectSharedDocumentStructure !== "function") throw new Error("inspectSharedDocumentStructure is required");
    if (typeof buildAgentSurfaceInspection !== "function") throw new Error("buildAgentSurfaceInspection is required");
    const readSourceFile = async (input = {}) => {
      const canonicalPath = normalizeString(input.canonicalPath);
      if (!canonicalPath) {
        throw new Error("canonicalPath is required");
      }
      const workspaceId = normalizeString(input.workspaceId);
      const response = await fetchStorageMarkdownResponse(buildStorageDocPath(canonicalPath, workspaceId));
      if (!response.ok) {
        throw new Error("read_source_file failed with " + response.status);
      }
      return {
        workspaceId: workspaceId || defaultWorkspaceId,
        canonicalPath,
        markdown: await response.text(),
      };
    };
    const readSharedDocument = async (input = {}) => {
      const resolvedDocument = resolveSharedDocumentInput(input);
      if (!resolvedDocument) {
        throw new Error("shareToken or shareUrl must resolve to a published Knowgrph document");
      }
      const workspaceId = normalizeString(resolvedDocument.workspaceId);
      const canonicalPath = normalizeString(resolvedDocument.canonicalPath);
      const response = await fetchStorageMarkdownResponse(buildStorageDocPath(canonicalPath, workspaceId));
      if (!response.ok) {
        throw new Error("read_shared_document failed with " + response.status);
      }
      return {
        workspaceId: workspaceId || defaultWorkspaceId,
        canonicalPath,
        markdown: await response.text(),
      };
    };
    const inspectSharedDocument = async (input = {}) => {
      const sharedDocument = await readSharedDocument(input);
      return inspectSharedDocumentStructure(sharedDocument);
    };
    return {
      [toolNames.listSourceFiles]: async () => {
        const response = await fetchSourceFilesIndexResponse();
        if (!response.ok) {
          throw new Error("list_source_files failed with " + response.status);
        }
        return {
          workspaceId: defaultWorkspaceId,
          markdownIndex: await response.text(),
        };
      },
      [toolNames.readSourceFile]: readSourceFile,
      [toolNames.readSharedDocument]: readSharedDocument,
      [toolNames.inspectSharedDocumentStructure]: inspectSharedDocument,
      [toolNames.inspectAgentSurface]: async () => buildAgentSurfaceInspection(),
    };
  };
  const createWebMcpLifecycleController = (args = {}) => {
    const root = args.root, lifecycleState = args.state, tools = Array.isArray(args.tools) ? args.tools : [], toolNames = Array.isArray(args.toolNames) ? args.toolNames : [];
    const lateBindingRetryDelayMs = Number(args.lateBindingRetryDelayMs || 500), lateBindingMaxAttempts = Number(args.lateBindingMaxAttempts || 20), markRuntimeState = typeof args.markRuntimeState === "function" ? args.markRuntimeState : () => {};
    if (!root || !lifecycleState || typeof lifecycleState !== "object") throw new Error("root and state are required");
    const readGlobalNavigator = () => {
      const windowNavigator = root.window && root.window.navigator;
      if (windowNavigator && root.navigator !== windowNavigator) {
        try { Object.defineProperty(root, "navigator", { configurable: true, value: windowNavigator }); } catch { root.navigator = windowNavigator; }
        return windowNavigator;
      }
      if (root.navigator) return root.navigator;
      const navigatorObject = {};
      try { Object.defineProperty(root, "navigator", { configurable: true, value: navigatorObject }); } catch { root.navigator = navigatorObject; }
      return navigatorObject;
    };
    const getRegistrationState = (context) => {
      const existing = lifecycleState.registrations.get(context);
      if (existing) return existing;
      const created = { registeredToolNames: new Set(), abortControllers: new Map() };
      lifecycleState.registrations.set(context, created);
      return created;
    };
    const createFallbackModelContext = () => {
      const context = { tools: [] }, upsertTool = (tool) => {
        if (!tool || !tool.name) return;
        const existingIndex = context.tools.findIndex((entry) => entry && entry.name === tool.name);
        if (existingIndex >= 0) context.tools.splice(existingIndex, 1, tool); else context.tools.push(tool);
      };
      context.provideContext = (provided = {}) => {
        context.tools.splice(0, context.tools.length);
        for (const tool of Array.isArray(provided.tools) ? provided.tools : []) upsertTool(tool);
      };
      context.registerTool = (tool, options = {}) => {
        if (!tool || !tool.name) throw new Error("tool name is required");
        if (context.tools.some((entry) => entry && entry.name === tool.name)) {
          const error = new Error("tool already registered: " + tool.name);
          error.name = "InvalidStateError";
          throw error;
        }
        if (options.signal && options.signal.aborted) return;
        context.tools.push(tool);
        if (options.signal && typeof options.signal.addEventListener === "function") options.signal.addEventListener("abort", () => {
          const index = context.tools.findIndex((entry) => entry && entry.name === tool.name);
          if (index >= 0) context.tools.splice(index, 1);
        }, { once: true });
      };
      context.provideContext({ tools });
      return context;
    };
    const isDuplicateToolRegistrationError = (error) => !!error && typeof error === "object" && String(error.name || "").trim() === "InvalidStateError";
    const releasePreviousRegisteredContext = (nextContext) => {
      const active = lifecycleState.activeRegisteredContext;
      if (!active || active === nextContext) {
        lifecycleState.activeRegisteredContext = nextContext;
        return;
      }
      const registrationState = lifecycleState.registrations.get(active);
      if (registrationState) registrationState.abortControllers.forEach((controller) => {
        if (controller && typeof controller.abort === "function") controller.abort();
      });
      lifecycleState.activeRegisteredContext = nextContext;
    };
    const clearLateBindingRetry = () => {
      if (lifecycleState.lateBindingRetryId === null || !root.window || typeof root.window.clearTimeout !== "function") return;
      root.window.clearTimeout(lifecycleState.lateBindingRetryId);
      lifecycleState.lateBindingRetryId = null;
    };
    const installToolsIntoModelContext = (context) => {
      const registrationState = getRegistrationState(context);
      let providedContext = false;
      if (typeof context.provideContext === "function") {
        try { context.provideContext({ tools }); providedContext = true; } catch { void 0; }
      }
      if (typeof context.registerTool === "function") for (const tool of tools) {
        if (registrationState.registeredToolNames.has(tool.name)) continue;
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        try {
          context.registerTool(tool, controller ? { signal: controller.signal } : {});
          registrationState.registeredToolNames.add(tool.name);
          registrationState.abortControllers.set(tool.name, controller);
        } catch (error) {
          if (!isDuplicateToolRegistrationError(error)) continue;
          registrationState.registeredToolNames.add(tool.name);
          registrationState.abortControllers.set(tool.name, null);
        }
      }
      if (Array.isArray(context.tools)) for (const tool of tools) if (!context.tools.some((entry) => entry && entry.name === tool.name)) context.tools.push(tool);
      const allToolsRegistered = tools.every((tool) => registrationState.registeredToolNames.has(tool.name) || (Array.isArray(context.tools) && context.tools.some((entry) => entry && entry.name === tool.name)));
      if (allToolsRegistered) {
        releasePreviousRegisteredContext(context);
        return true;
      }
      return providedContext && typeof context.registerTool !== "function" && !Array.isArray(context.tools);
    };
    const tryInstallLateBoundModelContext = (nav) => {
      const context = nav.modelContext;
      if (!context || context === lifecycleState.fallbackContext) return false;
      if (!installToolsIntoModelContext(context)) return false;
      clearLateBindingRetry();
      markRuntimeState("installed");
      return true;
    };
    const scheduleLateBindingRetry = (nav) => {
      if (!root.window || typeof root.window.setTimeout !== "function" || lifecycleState.lateBindingRetryId !== null) return;
      if (lifecycleState.lateBindingAttemptCount >= lateBindingMaxAttempts) {
        markRuntimeState("retry-exhausted");
        return;
      }
      lifecycleState.lateBindingRetryId = root.window.setTimeout(() => {
        lifecycleState.lateBindingRetryId = null;
        lifecycleState.lateBindingAttemptCount += 1;
        if (!tryInstallLateBoundModelContext(nav)) scheduleLateBindingRetry(nav);
      }, lateBindingRetryDelayMs);
    };
    const defineFallbackModelContext = (nav, context) => {
      lifecycleState.fallbackContext = context;
      const doc = root.document;
      let currentContext = (doc && doc.modelContext && doc.modelContext !== context) ? doc.modelContext : nav.modelContext && nav.modelContext !== context ? nav.modelContext : context;
      const descriptor = { configurable: true, enumerable: false, get: () => currentContext, set: (value) => {
        currentContext = value || context;
        if (currentContext !== context) void tryInstallLateBoundModelContext(nav);
      } };
      try { Object.defineProperty(nav, "modelContext", descriptor); } catch { nav.modelContext = context; }
      if (doc && !doc.modelContext) try { Object.defineProperty(doc, "modelContext", descriptor); } catch { void 0; }
    };
    const install = () => {
      const nav = readGlobalNavigator(), docContext = root.document && root.document.modelContext;
      markRuntimeState("installing");
      if (docContext && !nav.modelContext) try {
        Object.defineProperty(nav, "modelContext", { configurable: true, enumerable: false, get: () => root.document && root.document.modelContext, set: (value) => {
          if (value && value !== docContext) void installToolsIntoModelContext(value);
        } });
      } catch { nav.modelContext = docContext; }
      if (docContext && installToolsIntoModelContext(docContext)) return markRuntimeState("installed");
      if (nav.modelContext && installToolsIntoModelContext(nav.modelContext)) return markRuntimeState("installed");
      if (!nav.modelContext) defineFallbackModelContext(nav, createFallbackModelContext());
      markRuntimeState(toolNames.every((toolName) => nav.modelContext && Array.isArray(nav.modelContext.tools) && nav.modelContext.tools.some((entry) => entry && entry.name === toolName)) ? "fallback-readable" : "awaiting-model-context");
      scheduleLateBindingRetry(nav);
    };
    return { install, clearLateBindingRetry, installToolsIntoModelContext, tryInstallLateBoundModelContext, scheduleLateBindingRetry, defineFallbackModelContext, readGlobalNavigator };
  };
  const toolExecutors = createPublishedAgentReadyToolExecutors({
    toolNames: {
      listSourceFiles: ${JSON.stringify(LIST_SOURCE_FILES_WEB_TOOL_NAME)},
      readSourceFile: ${JSON.stringify(READ_SOURCE_FILE_WEB_TOOL_NAME)},
      readSharedDocument: ${JSON.stringify(READ_SHARED_DOCUMENT_WEB_TOOL_NAME)},
      inspectSharedDocumentStructure: ${JSON.stringify(INSPECT_SHARED_DOCUMENT_STRUCTURE_WEB_TOOL_NAME)},
      inspectAgentSurface: ${JSON.stringify(INSPECT_AGENT_SURFACE_WEB_TOOL_NAME)},
    },
    defaultWorkspaceId,
    buildStorageDocPath: buildDocPath,
    fetchSourceFilesIndexResponse: () =>
      fetch(buildStorageRequestUrl("/api/storage/source-files"), {
        headers: { accept: "text/markdown" },
      }),
    fetchStorageMarkdownResponse: (path) =>
      fetch(buildStorageRequestUrl(path), {
        headers: { accept: "text/markdown" },
      }),
    resolveSharedDocumentInput: (input = {}) => resolvePublishedDocIdentity(input),
    inspectSharedDocumentStructure,
    buildAgentSurfaceInspection: createAgentSurfaceInspectionExecutor({
      baseUrl: resolveAgentReadyBaseUrl(),
      fetchJson,
    }),
  });
  const tools = toolDefinitions.map((tool) => {
    const execute = toolExecutors[tool.name];
    if (typeof execute !== "function") {
      throw new Error(\`Missing HTML WebMCP fallback executor for \${tool.name}\`);
    }
    return {
      ...tool,
      execute,
    };
  });
  const webMcpLifecycle = createWebMcpLifecycleController({
    root,
    state: fallbackState,
    tools,
    toolNames,
    lateBindingRetryDelayMs: lateBindingRetryDelayMs,
    lateBindingMaxAttempts: lateBindingMaxAttempts,
    markRuntimeState: markWebMcpRuntime,
  });
  webMcpLifecycle.install();
})();`;

const injectWebMcpScript = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;
  const html = await response.text();
  if (webMcpTools.every((tool) => html.includes(tool.name))) return new Response(html, response);
  const scriptTag = `<script>${webMcpScript}</script>`;
  const nextHtml = html.includes("</head>") ? html.replace("</head>", `${scriptTag}</head>`) : `${html}${scriptTag}`;
  const nextResponse = new Response(nextHtml, response);
  nextResponse.headers.delete("content-length");
  return nextResponse;
};

const publishedDocsSkillMarkdown = `# Knowgrph Published Documents Skill

Use this skill when an agent needs to discover, read, or inspect published Knowgrph Source Files and shared documents.

## Tools

- list_source_files: fetch ${SITE_ORIGIN}/api/storage/source-files.
- read_source_file: fetch ${SITE_ORIGIN}/api/storage/doc-default/{canonicalPath} by default, or ${SITE_ORIGIN}/api/storage/doc/{workspaceId}/{canonicalPath} for an explicit workspace.
- read_shared_document: resolve a Knowgrph share token or public share/document URL, then fetch the canonical published markdown document from storage.
- inspect_shared_document_structure: inspect published Knowgrph shared-document frontmatter/body structure from a share token or public share/document URL.

## Scope

- Shared read-only surface across HTTP MCP, MCP server-card metadata, and deployed HTML WebMCP fallback.
- Public/browser URLs stay canonical on ${SITE_ORIGIN}/api/storage/*.
- Server-side Pages reads use ${STORAGE_FETCH_ORIGIN} to avoid custom-domain self-fetch rewrite failures.
`;

const webMcpReadinessSkillMarkdown = `# Knowgrph WebMCP Readiness Skill

Use this skill when an agent or browser needs to inspect the deployed Knowgrph agent-ready surface and WebMCP lifecycle.

## Shared deployed tools

- inspect_agent_surface: inspect health, OpenAPI, API catalog, MCP server card, A2A card, and agent-skills metadata.

## WebMCP implementation notes

- Browser app runtime installs WebMCP on page load via navigator.modelContext in canvas/src/main.tsx.
- Runtime prefers provideContext({ tools }) when available and also registers each tool with registerTool(tool, { signal }) when supported.
- AbortController-backed registration is used so tools can be unregistered cleanly with the platform lifecycle.
- Deployed HTML fallback injects the shared five-tool WebMCP surface on /knowgrph HTML routes.
- Full app runtime additionally exposes browser-local inspect tools for Settings chat readiness, MainPanel state, Editor Workspace state, chat pipeline validation/finalize/apply state, the combined MainPanel -> Chat -> Markdown/frontmatter -> Canvas readiness path, the active workspace document, canvas topology, canvas snapshot, 3d camera pose, 3d layout positions, 2d zoom viewport, and Source Files snapshot.
`;

const PUBLISHED_TOOL_NAME_CONFIG = {
  listSourceFiles: KNOWGRPH_AGENT_READY_TOOL_IDS.listSourceFiles,
  readSourceFile: KNOWGRPH_AGENT_READY_TOOL_IDS.readSourceFile,
  readSharedDocument: KNOWGRPH_AGENT_READY_TOOL_IDS.readSharedDocument,
  inspectSharedDocumentStructure: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectSharedDocumentStructure,
  inspectAgentSurface: KNOWGRPH_AGENT_READY_TOOL_IDS.inspectAgentSurface,
};

const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const publishedDocsSkillMarkdownSha256 = sha256Hex(publishedDocsSkillMarkdown);
const webMcpReadinessSkillMarkdownSha256 = sha256Hex(webMcpReadinessSkillMarkdown);
const agentSkillSha256ByName = {
  [AGENT_READY_AGENT_SKILL_DEFINITIONS[0].name]: publishedDocsSkillMarkdownSha256,
  [AGENT_READY_AGENT_SKILL_DEFINITIONS[1].name]: webMcpReadinessSkillMarkdownSha256,
};

const agentSkillsIndex = async () => buildAgentReadyAgentSkillsIndex({
  appUrl: APP_URL,
  updatedAt: UPDATED_AT,
  sha256ByName: agentSkillSha256ByName,
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

const buildAgentSurfaceInspection = async () => buildAgentSurfaceInspectionPayload({
  baseUrl: APP_URL,
  health: buildHealthStatusBody(),
  apiCatalog,
  openApi,
  mcpServerCard,
  agentCard: a2aAgentCard,
  agentSkills: await agentSkillsIndex(),
});

const PUBLISHED_MCP_TOOL_EXECUTORS = createPublishedAgentReadyToolExecutors({
  toolNames: PUBLISHED_TOOL_NAME_CONFIG,
  defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
  buildStorageDocPath,
  fetchSourceFilesIndexResponse: () =>
    fetch(`${STORAGE_FETCH_ORIGIN}${buildKnowgrphStorageSourceFilesIndexPath()}`, {
      headers: { accept: "text/markdown" },
    }),
  fetchStorageMarkdownResponse: (path) =>
    fetch(`${STORAGE_FETCH_ORIGIN}${path}`, {
      headers: { accept: "text/markdown" },
    }),
  resolveSharedDocumentInput: (input = {}) =>
    resolvePublishedDocIdentity({
      shareToken: input?.shareToken,
      shareUrl: input?.shareUrl,
      appBasePath: APP_BASE_PATH,
      baseUrl: SITE_ORIGIN,
    }),
  inspectSharedDocumentStructure,
  buildAgentSurfaceInspection,
});

const resolvePublishedDocRequestIdentity = (requestUrl) => {
  try {
    const url = new URL(requestUrl, SITE_ORIGIN);
    return resolvePublishedDocIdentity({
      shareUrl: `${url.pathname}${url.search}`,
      baseUrl: SITE_ORIGIN,
      appBasePath: APP_BASE_PATH,
    });
  } catch {
    return null;
  }
};

const resolvePublishedDocPathIdentity = (pathname) =>
  resolvePublishedDocIdentity({
    shareUrl: String(pathname || ""),
    baseUrl: SITE_ORIGIN,
    appBasePath: APP_BASE_PATH,
  });

const proxyPublishedDocMarkdownResponse = async (request, pathArgs) => {
  const targetUrl = new URL(buildStorageDocPath(pathArgs.canonicalPath, pathArgs.workspaceId), STORAGE_FETCH_ORIGIN);
  const upstream = await fetch(targetUrl, {
    method: "GET",
    headers: {
      accept: "text/markdown, text/plain;q=0.9, */*;q=0.1",
    },
  });
  const headers = new Headers(upstream.headers);
  const vary = String(headers.get("vary") || "");
  headers.set("vary", vary ? `${vary}, Accept` : "Accept");
  return new Response(String(request.method || "").toUpperCase() === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};

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
  const execute = PUBLISHED_MCP_TOOL_EXECUTORS[name];
  if (typeof execute !== "function") {
    throw new Error(`unknown tool: ${name}`);
  }
  return execute(args);
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
  "auth.md": { contentType: "text/markdown; charset=utf-8", body: authMd },
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
    body: publishedDocsSkillMarkdown,
  },
  ".well-known/agent-skills/knowgrph-webmcp-readiness.md": {
    contentType: "text/markdown; charset=utf-8",
    body: webMcpReadinessSkillMarkdown,
  },
  ".well-known/http-message-signatures-directory": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(httpMessageSignaturesDirectory, null, 2),
  },
});

const handlesKnowgrphRoot = (pathname) => pathname === APP_BASE_PATH || pathname === `${APP_BASE_PATH}/`;
const handlesKnowgrphHtmlSurface = (pathname) =>
  handlesKnowgrphRoot(pathname) || Boolean(resolvePublishedDocPathIdentity(pathname));

const resolveAgentReadyRouteTag = (request) => {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const publishedDocIdentity = resolvePublishedDocRequestIdentity(request.url);
  if (pathname === HEALTH_PATH) return "health";
  if (pathname === `${APP_BASE_PATH}/mcp`) return "mcp";
  if (pathname === `${APP_BASE_PATH}/robots.txt`) return "robots";
  if (pathname === `${APP_BASE_PATH}/sitemap.xml`) return "sitemap";
  if (pathname === `${APP_BASE_PATH}/auth.md` || pathname === "/auth.md") return "auth-md";
  if (pathname.startsWith(`${APP_BASE_PATH}/.well-known/`)) return "well-known";
  if (publishedDocIdentity) {
    return wantsMarkdown(request) ? "shared-doc-markdown" : "shared-doc-html";
  }
  if (handlesKnowgrphRoot(url.pathname)) {
    return wantsMarkdown(request) ? "homepage-markdown" : "homepage-html";
  }
  return "app-surface";
};

const withKnowgrphRouteHeaders = (request, response) =>
  withAgentReadyRouteHeaders(response, {
    owner: KNOWGRPH_AGENT_READY_ROUTE_OWNER,
    tag: resolveAgentReadyRouteTag(request),
  });

const routeResponse = async (request) => {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const publishedDocIdentity = resolvePublishedDocRequestIdentity(request.url);

  if (publishedDocIdentity && wantsMarkdown(request)) {
    return proxyPublishedDocMarkdownResponse(request, publishedDocIdentity);
  }
  if (handlesKnowgrphRoot(url.pathname) && wantsMarkdown(request)) {
    return markdownResponse(agentReadyMarkdownBody);
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
    case `${APP_BASE_PATH}/auth.md`:
    case "/auth.md":
      return textResponse(authMd, "text/markdown; charset=utf-8");
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
      return textResponse(publishedDocsSkillMarkdown, "text/markdown; charset=utf-8");
    case `${APP_BASE_PATH}/.well-known/agent-skills/knowgrph-webmcp-readiness.md`:
      return textResponse(webMcpReadinessSkillMarkdown, "text/markdown; charset=utf-8");
    case `${APP_BASE_PATH}/.well-known/http-message-signatures-directory`:
      return jsonResponse(httpMessageSignaturesDirectory);
    default:
      return null;
  }
};

export async function onRequest(context) {
  const { env, request } = context;
  const method = String(request.method || "GET").toUpperCase();
  const url = new URL(request.url);

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

  if (method === "POST" && url.pathname.replace(/\/+$/, "") === `${APP_BASE_PATH}/mcp`) {
    return withKnowgrphRouteHeaders(request, await routeResponse(request));
  }

  if (method !== "GET" && method !== "HEAD") {
    return jsonStatusResponse(405, { ok: false, error: "unsupported_method" });
  }

  const routed = await routeResponse(request);
  if (routed) {
    const next = withKnowgrphRouteHeaders(request, routed);
    if (method === "HEAD") return new Response(null, next);
    return next;
  }

  const response = await context.next();
  if (!handlesKnowgrphHtmlSurface(url.pathname)) return response;
  const htmlResponse = method === "HEAD" ? response : await injectWebMcpScript(response);
  const nextResponse = new Response(method === "HEAD" ? null : htmlResponse.body, htmlResponse);
  nextResponse.headers.set("link", agentReadyHomepageLinkHeaderValue);
  return withKnowgrphRouteHeaders(request, nextResponse);
}
