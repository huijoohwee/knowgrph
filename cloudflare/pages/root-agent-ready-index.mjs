import {
  APP_BASE_PATH,
  agentReadyHomepageLinkHeaderValue,
  agentReadyMarkdownBody,
  ROOT_AGENT_READY_ROUTE_OWNER,
  markdownResponse,
  withAgentReadyRouteHeaders,
  wantsMarkdown,
} from "./knowgrph-agent-ready-shared.mjs";

const ROOT_DESCRIPTION = "Agent-actionable chat-to-canvas knowledge graph workspace";
const ROOT_MOUNT_MARKUP = '<main id="root"></main>';
const ROOT_MOUNT_PATTERN = /<(?:main|div)\s+id=["']root["']\s*><\/(?:main|div)>/i;

const extractWebMcpScript = (html) => {
  const scriptPattern = /<script>([\s\S]*?)<\/script>/g;
  for (const match of String(html || "").matchAll(scriptPattern)) {
    const script = match[1] || "";
    if (script.includes("createWebMcpLifecycleController") && script.includes("toolDefinitions")) {
      return script;
    }
  }
  return "";
};

const rootHtmlHeaders = () => ({
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store, no-cache, no-transform, must-revalidate, max-age=0",
  "access-control-allow-origin": "*",
  "link": agentReadyHomepageLinkHeaderValue,
});

const injectIntoHead = (html, markup) =>
  String(html || "").includes("</head>")
    ? String(html || "").replace("</head>", `${markup}</head>`)
    : `${String(html || "")}${markup}`;

const canonicalizeRootMount = (html) =>
  String(html || "").replace(ROOT_MOUNT_PATTERN, ROOT_MOUNT_MARKUP);

const rootNoscriptFallbackMarkup = () => `<noscript><a href="${APP_BASE_PATH}/">Open Knowgrph</a></noscript>`;

const rewriteRootAppHtml = (html) => {
  let next = canonicalizeRootMount(html);

  if (/<meta\s+name=["']description["'][^>]*>/i.test(next)) {
    next = next.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${ROOT_DESCRIPTION}" />`,
    );
  } else {
    next = injectIntoHead(next, `    <meta name="description" content="${ROOT_DESCRIPTION}" />\n`);
  }

  if (!/<link\s+rel=["']canonical["'][^>]*>/i.test(next)) {
    next = injectIntoHead(next, `    <link rel="canonical" href="${APP_BASE_PATH}/" />\n`);
  }

  if (!/<meta\s+name=["']x-knowgrph-root-alias["'][^>]*>/i.test(next)) {
    next = injectIntoHead(next, `    <meta name="x-knowgrph-root-alias" content="${APP_BASE_PATH}/" />\n`);
  }

  return next;
};

const loadWebMcpScript = async (request) => {
  const appUrl = new URL(`${APP_BASE_PATH}/?agentReadyRootWebMcp=1`, request.url);
  const response = await fetch(appUrl, { headers: { accept: "text/html" } });
  if (!response.ok) return "";
  return extractWebMcpScript(await response.text());
};

const loadKnowgrphAppShell = async (request) => {
  const appUrl = new URL(`${APP_BASE_PATH}/?agentReadyRootAlias=1`, request.url);
  const response = await fetch(appUrl, { headers: { accept: "text/html" } });
  if (!response.ok) return null;
  const html = rewriteRootAppHtml(await response.text());
  if (!html.includes(ROOT_MOUNT_MARKUP) || !html.includes(`${APP_BASE_PATH}/assets/`)) {
    return null;
  }
  return new Response(html, {
    status: 200,
    headers: rootHtmlHeaders(),
  });
};

const rootHtmlResponse = (webMcpScript = "") =>
  new Response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowgrph</title>
    <link rel="canonical" href="/knowgrph/" />
    ${webMcpScript ? `<script>${webMcpScript}</script>` : ""}
  </head>
  <body>
    <main id="root"></main>
    ${rootNoscriptFallbackMarkup()}
  </body>
</html>`, {
    status: 200,
    headers: rootHtmlHeaders(),
  });

export async function onRequest(context) {
  const { request } = context;
  const method = String(request.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return context.next();
  }

  if (wantsMarkdown(request)) {
    const markdown = withAgentReadyRouteHeaders(markdownResponse(agentReadyMarkdownBody), {
      owner: ROOT_AGENT_READY_ROUTE_OWNER,
      tag: "root-homepage-markdown",
    });
    if (method === "HEAD") {
      return new Response(null, markdown);
    }
    return markdown;
  }

  const rootAliasHtml = method === "HEAD" ? null : await loadKnowgrphAppShell(request);
  const html = withAgentReadyRouteHeaders(rootAliasHtml || rootHtmlResponse(method === "HEAD" ? "" : await loadWebMcpScript(request)), {
    owner: ROOT_AGENT_READY_ROUTE_OWNER,
    tag: "root-homepage-html",
  });
  if (method === "HEAD") return new Response(null, html);
  return html;
}
