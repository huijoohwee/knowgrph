import {
  APP_BASE_PATH,
  agentReadyHomepageLinkHeaderValue,
  agentReadyMarkdownBody,
  ROOT_AGENT_READY_ROUTE_OWNER,
  markdownResponse,
  withAgentReadyRouteHeaders,
  wantsMarkdown,
} from "./knowgrph-agent-ready-shared.mjs";

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

const loadWebMcpScript = async (request) => {
  const appUrl = new URL(`${APP_BASE_PATH}/?agentReadyRootWebMcp=1`, request.url);
  const response = await fetch(appUrl, { headers: { accept: "text/html" } });
  if (!response.ok) return "";
  return extractWebMcpScript(await response.text());
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
    <main>
      <h1>Knowgrph</h1>
      <p>Agent-readable knowledge graph workspace.</p>
      <p><a href="/knowgrph/">Open Knowgrph</a></p>
    </main>
  </body>
</html>`, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, no-transform, must-revalidate, max-age=0",
      "access-control-allow-origin": "*",
      "link": agentReadyHomepageLinkHeaderValue,
    },
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

  const html = withAgentReadyRouteHeaders(rootHtmlResponse(method === "HEAD" ? "" : await loadWebMcpScript(request)), {
    owner: ROOT_AGENT_READY_ROUTE_OWNER,
    tag: "root-homepage-html",
  });
  if (method === "HEAD") return new Response(null, html);
  return html;
}
