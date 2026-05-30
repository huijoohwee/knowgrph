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
const LEGACY_ROOT_DESCRIPTION_PATTERN = new RegExp(
  ["Agent-readable", "knowledge", "graph", "workspace"].join("\\s+") + "\\.?",
  "g",
);

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

const rootVisibleFallbackMarkup = () => `<main id="knowgrph-root-fallback" data-knowgrph-root-fallback="visible" aria-label="Knowgrph root alias" style="position:fixed;inset:0;z-index:2147483000;display:grid;place-content:center;gap:1rem;padding:2rem;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#101820;color:#f4f7fb;text-align:center">
      <h1 style="margin:0;font-size:clamp(2.25rem,8vw,5.5rem);line-height:1;font-weight:760">Knowgrph</h1>
      <p style="margin:0 auto;max-width:42rem;font-size:clamp(1rem,2.2vw,1.35rem);line-height:1.55;color:#d6e1ea">${ROOT_DESCRIPTION}</p>
      <p style="margin:0"><a href="${APP_BASE_PATH}/" style="display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:0 1.05rem;border:1px solid #7db3ff;border-radius:8px;color:#f8fbff;text-decoration:none;background:#1f5fa8">Open Knowgrph</a></p>
    </main>
    <script>
      (() => {
        const root = document.getElementById("root");
        const fallback = document.getElementById("knowgrph-root-fallback");
        if (!root || !fallback || typeof MutationObserver === "undefined") return;
        const sync = () => {
          const mounted = root.childElementCount > 0;
          fallback.hidden = mounted;
          fallback.style.display = mounted ? "none" : "grid";
          fallback.dataset.knowgrphRootFallback = mounted ? "hidden" : "visible";
        };
        new MutationObserver(sync).observe(root, { childList: true });
        sync();
      })();
    </script>`;

const injectRootVisibleFallback = (html) => {
  const next = String(html || "");
  if (/<main\s+id=["']knowgrph-root-fallback["']/i.test(next)) return next;
  const rootPattern = /<div\s+id=["']root["']\s*><\/div>/i;
  if (rootPattern.test(next)) {
    return next.replace(rootPattern, (root) => `${root}\n    ${rootVisibleFallbackMarkup()}`);
  }
  if (next.includes("</body>")) {
    return next.replace("</body>", `    ${rootVisibleFallbackMarkup()}\n  </body>`);
  }
  return `${next}\n${rootVisibleFallbackMarkup()}`;
};

const rewriteRootAppHtml = (html) => {
  let next = String(html || "")
    .replace(LEGACY_ROOT_DESCRIPTION_PATTERN, ROOT_DESCRIPTION);

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

  return injectRootVisibleFallback(next);
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
  if (!html.includes("<div id=\"root\"></div>") || !html.includes(`${APP_BASE_PATH}/assets/`)) {
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
    <div id="root"></div>
    ${rootVisibleFallbackMarkup()}
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
