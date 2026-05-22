import {
  agentReadyMarkdownBody,
  ROOT_AGENT_READY_ROUTE_OWNER,
  markdownResponse,
  withAgentReadyRouteHeaders,
  wantsMarkdown,
} from "./knowgrph-agent-ready-shared.mjs";

export async function onRequest(context) {
  const { request } = context;
  const method = String(request.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return context.next();
  }

  if (!wantsMarkdown(request)) {
    return context.next();
  }

  const markdown = withAgentReadyRouteHeaders(markdownResponse(agentReadyMarkdownBody), {
    owner: ROOT_AGENT_READY_ROUTE_OWNER,
    tag: "root-homepage-markdown",
  });
  if (method === "HEAD") {
    return new Response(null, markdown);
  }
  return markdown;
}
