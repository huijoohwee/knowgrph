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

const rootNoscriptFallbackMarkup = () => `<noscript><a href="${APP_BASE_PATH}/">Enter Knowgrph</a></noscript>`;

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
    <meta name="description" content="${ROOT_DESCRIPTION}" />
    <title>Knowgrph</title>
    <link rel="canonical" href="/knowgrph/" />
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100dvh; overflow: hidden; background: #071019; color: #f8fafc; }
      .live-canvas { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #071019; }
      .veil { position: fixed; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(7,16,25,.96) 0%, rgba(7,16,25,.78) 38%, rgba(7,16,25,.12) 68%, transparent 82%); }
      .launch { position: fixed; z-index: 2; left: clamp(1.25rem, 4vw, 4rem); top: 50%; width: min(36rem, calc(100% - 2.5rem)); transform: translateY(-50%); }
      .eyebrow { margin: 0 0 1rem; color: #a7b4c4; font-size: .72rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(2.8rem, 6vw, 5.8rem); line-height: .94; letter-spacing: -.055em; }
      h1 span { display: block; color: #4fd1c5; }
      .lede { max-width: 34rem; margin: 1.5rem 0 0; color: #cbd5e1; font-size: clamp(1rem, 1.7vw, 1.2rem); line-height: 1.65; }
      .enter { display: inline-flex; min-height: 3rem; align-items: center; margin-top: 1.75rem; padding: 0 1.25rem; border: 1px solid #4fd1c5; border-radius: .75rem; background: #4fd1c5; color: #071019; font-weight: 750; text-decoration: none; box-shadow: 0 16px 50px rgba(79,209,197,.22); }
      .enter:focus-visible { outline: 3px solid white; outline-offset: 3px; }
      @media (max-width: 720px) { .veil { background: linear-gradient(180deg, rgba(7,16,25,.35), rgba(7,16,25,.96) 52%); } .launch { top: auto; bottom: 2rem; transform: none; } }
    </style>
    ${webMcpScript ? `<script>${webMcpScript}</script>` : ""}
  </head>
  <body>
    <iframe class="live-canvas" src="${APP_BASE_PATH}/" title="Interactive Knowgrph canvas"></iframe>
    <div class="veil" aria-hidden="true"></div>
    <main class="launch" data-kg-live-canvas-launch="true">
      <p class="eyebrow">Knowgrph · Live canvas</p>
      <h1>Map intent.<span>Orchestrate agents.</span>Prove outcomes.</h1>
      <p class="lede">A source-backed canvas where / routes work, # sets meaning, and @ binds context.</p>
      <a class="enter" href="${APP_BASE_PATH}/" data-kg-live-canvas-hero-enter="true">Enter Knowgrph</a>
    </main>
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

  const html = withAgentReadyRouteHeaders(rootHtmlResponse(method === "HEAD" ? "" : await loadWebMcpScript(request)), {
    owner: ROOT_AGENT_READY_ROUTE_OWNER,
    tag: "root-homepage-html",
  });
  if (method === "HEAD") return new Response(null, html);
  return html;
}
