export const SITE_ORIGIN = "https://airvio.co";
export const STORAGE_FETCH_ORIGIN = "https://knowgrph-storage.huijoohwee.workers.dev";
export const APP_BASE_PATH = "/knowgrph";
export const APP_URL = `${SITE_ORIGIN}${APP_BASE_PATH}/`;
export const ROOT_URL = `${SITE_ORIGIN}/`;
export const DEFAULT_WORKSPACE_ID = "kgws:canonical-docs";
export const UPDATED_AT = "2026-05-21";
export const HEALTH_PATH = `${APP_BASE_PATH}/health`;
export const HEALTH_URL = `${SITE_ORIGIN}${HEALTH_PATH}`;
export const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";
export const APP_A2A_AGENT_CARD_PATH = `${APP_BASE_PATH}/.well-known/agent-card.json`;
export const A2A_AGENT_CARD_URL = `${SITE_ORIGIN}${A2A_AGENT_CARD_PATH}`;
export const STORAGE_SOURCE_FILES_URL = `${SITE_ORIGIN}/api/storage/source-files`;
export const STORAGE_DEFAULT_DOC_PATTERN = `${SITE_ORIGIN}/api/storage/doc-default/{canonicalPath}`;
export const STORAGE_WORKSPACE_DOC_PATTERN = `${SITE_ORIGIN}/api/storage/doc/{workspaceId}/{canonicalPath}`;
export const KNOWGRPH_AGENT_READY_ROUTE_OWNER = "knowgrph-agent-ready-pages";
export const ROOT_AGENT_READY_ROUTE_OWNER = "root-agent-ready-pages";

export const agentReadyMarkdownBody = `# Knowgrph

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

export const markdownResponse = (body) =>
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

export const wantsMarkdown = (request) => {
  const accept = request.headers.get("accept") || "";
  return accept.toLowerCase().split(",").some((part) => part.trim().startsWith("text/markdown"));
};

export const withAgentReadyRouteHeaders = (response, args) => {
  const next = new Response(response.body, response);
  const owner = String(args?.owner || "").trim();
  const tag = String(args?.tag || "").trim();
  if (owner) {
    next.headers.set("x-knowgrph-route-owner", owner);
  }
  if (tag) {
    next.headers.set("x-knowgrph-route-tag", tag);
  }
  return next;
};
