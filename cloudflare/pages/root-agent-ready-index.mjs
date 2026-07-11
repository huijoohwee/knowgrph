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
      .veil { position: fixed; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(7,16,25,.96) 0%, rgba(7,16,25,.82) 34%, rgba(7,16,25,.16) 60%, transparent 72%); }
      .glow { position: fixed; z-index: 1; left: -12rem; top: 50%; width: 46rem; height: 46rem; transform: translateY(-50%); border-radius: 999px; background: rgba(79,209,197,.1); filter: blur(64px); pointer-events: none; }
      .launch { position: fixed; z-index: 2; left: clamp(2rem, 4vw, 3rem); top: 50%; width: min(34rem, calc(100% - 4rem)); max-height: calc(100dvh - 2.5rem); overflow-y: auto; transform: translateY(-50%); }
      .eyebrow { display: flex; align-items: center; gap: .5rem; margin: 0; color: #a7b4c4; font-size: .625rem; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; }
      .pulse { width: .5rem; height: .5rem; border-radius: 999px; background: #4fd1c5; box-shadow: 0 0 18px #4fd1c5; }
      h1 { margin: 1rem 0 0; font-size: clamp(3rem, 4.5vw, 3.5rem); font-weight: 600; line-height: 1.02; letter-spacing: -.045em; text-wrap: balance; }
      h1 span { display: block; }
      h1 .accent { color: #4fd1c5; }
      .lede { max-width: 34rem; margin: 1rem 0 0; color: #a7b4c4; font-size: 1rem; line-height: 1.5rem; }
      .lede code { color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .deck { margin-top: 1.5rem; padding: 1rem; border: 1px solid rgba(148,163,184,.28); border-radius: 1rem; background: rgba(15,23,34,.72); box-shadow: 0 18px 64px rgba(7,16,25,.72); backdrop-filter: blur(20px); }
      .deck label { display: block; color: #a7b4c4; font-size: .625rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
      textarea { display: block; width: 100%; min-height: 4rem; margin-top: .5rem; resize: vertical; border: 1px solid rgba(148,163,184,.28); border-radius: .75rem; padding: .625rem .75rem; outline: 0; background: rgba(3,10,18,.88); color: #d9f4f1; font: .75rem/1.25rem ui-monospace, SFMono-Regular, Menlo, monospace; }
      textarea:focus { border-color: #4fd1c5; box-shadow: 0 0 0 1px #4fd1c5; }
      .chips, .actions, .posture { display: flex; flex-wrap: wrap; gap: .375rem; }
      .chips { margin-top: .75rem; }
      .chip, .secondary { border: 1px solid rgba(148,163,184,.28); background: rgba(15,23,34,.72); color: #a7b4c4; }
      .chip { border-radius: 999px; padding: .25rem .625rem; font: .625rem ui-monospace, SFMono-Regular, Menlo, monospace; cursor: pointer; }
      .chip.active { border-color: #4fd1c5; background: rgba(79,209,197,.16); color: #f8fafc; }
      .actions { align-items: center; margin-top: 1rem; gap: .5rem; }
      .enter, .secondary { display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; border-radius: .5rem; padding: 0 1rem; font-size: .875rem; font-weight: 650; text-decoration: none; }
      .enter { border: 1px solid #4fd1c5; background: #4fd1c5; color: #071019; }
      .shortcut { color: #a7b4c4; font-size: .6875rem; }
      .enter:focus-visible, .secondary:focus-visible, .chip:focus-visible { outline: 2px solid #4fd1c5; outline-offset: 2px; }
      .posture { margin: .75rem 0 0; padding: 0; list-style: none; }
      .posture li { border: 1px solid rgba(148,163,184,.28); border-radius: 999px; padding: .25rem .625rem; background: rgba(15,23,34,.54); color: #a7b4c4; font-size: .625rem; backdrop-filter: blur(12px); }
      @media (max-width: 720px) { .veil { background: linear-gradient(180deg, transparent 0%, rgba(7,16,25,.14) 25%, rgba(7,16,25,.92) 56%, #071019 100%); } .glow { left: -12rem; top: auto; bottom: -18rem; width: 38rem; height: 38rem; transform: none; } .launch { inset: auto 1rem 4rem; width: auto; max-height: calc(100dvh - 8rem); transform: none; } h1 { margin-top: .75rem; font-size: 1.875rem; } .lede { font-size: .875rem; } .deck { margin-top: 1rem; padding: .75rem; } .posture { display: none; } }
    </style>
    ${webMcpScript ? `<script>${webMcpScript}</script>` : ""}
  </head>
  <body>
    <iframe class="live-canvas" src="${APP_BASE_PATH}/" title="Interactive Knowgrph canvas"></iframe>
    <div class="veil" aria-hidden="true"></div>
    <div class="glow" aria-hidden="true"></div>
    <main class="launch" data-kg-live-canvas-launch="true">
      <p class="eyebrow"><span class="pulse" aria-hidden="true"></span>Knowgrph · Live canvas</p>
      <h1><span>Map intent.</span><span>Orchestrate agents.</span><span class="accent">Prove outcomes.</span></h1>
      <p class="lede">A source-backed canvas where <code>/</code> routes work, <code>#</code> sets meaning, and <code>@</code> binds context.</p>
      <form class="deck" action="${APP_BASE_PATH}/" data-kg-live-canvas-hero-command-deck="true">
        <label for="knowgrph-live-canvas-hero-query">Agent-ready query</label>
        <textarea id="knowgrph-live-canvas-hero-query" name="query" spellcheck="false" data-kg-live-canvas-hero-query="true">/runtime-ready.check #token-economics @dev-only</textarea>
        <nav class="chips" aria-label="Live Canvas Hero invocation grammar">
          ${["/runtime-ready.check", "/cost.audit", "#token-economics", "#runtime-ready", "@runtime-proof", "@dev-only"].map((token) => `<button class="chip" type="button" data-token="${token}">${token}</button>`).join("")}
        </nav>
        <div class="actions">
          <a class="enter" href="${APP_BASE_PATH}/" data-kg-live-canvas-hero-enter="true">Enter Knowgrph</a>
          <button class="secondary" type="submit" data-kg-live-canvas-hero-start="true">Start locally</button>
          <span class="shortcut">Ctrl/⌘ + Enter</span>
        </div>
      </form>
      <ul class="posture" aria-label="Agent-ready execution posture"><li>0 model calls before Run</li><li>Frontmatter SSOT</li><li>Approval-gated</li></ul>
    </main>
    <script>
      (() => {
        const query = document.querySelector('[data-kg-live-canvas-hero-query="true"]');
        const normalize = (value) => String(value || '').trim().replace(/\\s+/g, ' ');
        const sync = () => document.querySelectorAll('[data-token]').forEach((button) => {
          const tokens = normalize(query.value).toLowerCase().split(' ');
          button.classList.toggle('active', tokens.includes(button.dataset.token.toLowerCase()));
        });
        document.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => {
          const token = button.dataset.token;
          const tokens = normalize(query.value).split(' ');
          if (!tokens.some((value) => value.toLowerCase() === token.toLowerCase())) query.value = normalize(query.value + ' ' + token);
          sync();
          query.focus();
        }));
        query.addEventListener('input', sync);
        query.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.form.requestSubmit();
        });
        sync();
      })();
    </script>
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
