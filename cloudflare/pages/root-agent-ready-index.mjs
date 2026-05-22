import {
  agentReadyMarkdownBody,
  markdownResponse,
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

  const markdown = markdownResponse(agentReadyMarkdownBody);
  if (method === "HEAD") {
    return new Response(null, markdown);
  }
  return markdown;
}
