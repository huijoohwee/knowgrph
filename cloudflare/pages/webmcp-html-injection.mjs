export const hasWebMcpLifecycleContract = (html) => {
  const body = String(html || "");
  return body.includes("createWebMcpLifecycleController")
    && body.includes("kgWebmcpContext")
    && body.includes("toolDefinitions")
    && body.includes("toolExecutors");
};

export const injectWebMcpScript = async (response, webMcpScript) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const html = await response.text();
  if (hasWebMcpLifecycleContract(html)) return new Response(html, response);

  const scriptTag = `<script>${webMcpScript}</script>`;
  const nextHtml = html.includes("</head>")
    ? html.replace("</head>", `${scriptTag}</head>`)
    : `${html}${scriptTag}`;
  const nextResponse = new Response(nextHtml, response);
  nextResponse.headers.delete("content-length");
  return nextResponse;
};
